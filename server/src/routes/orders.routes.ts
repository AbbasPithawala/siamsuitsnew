import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { resolveUserPermissions } from "../services/permissions.service";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as ordersService from "../services/orders.service";
import * as orderPdfService from "../services/orderPdf.service";

const measurementSchema = z.object({
  measurementDefinitionId: z.string().uuid(),
  value: z.string().min(1).optional(),
  adjustmentValue: z.string().min(1).optional(),
});

const featureInputSchema = z.object({
  featureId: z.string().uuid(),
  styleId: z.string().uuid().optional(),
  styleOptionId: z.string().uuid().optional(),
  textValue: z.string().min(1).optional(),
  structuredValue: z.unknown().optional(),
});

const componentInputSchema = z.object({
  superProductComponentId: z.string().uuid(),
  measurements: z.array(measurementSchema).optional(),
  features: z.array(featureInputSchema).optional(),
  measurementNote: z.string().min(1).optional(),
  stylingNote: z.string().min(1).optional(),
  referenceImage: z.string().min(1).optional(),
});

export const orderItemInputSchema = z.object({
  superProductId: z.string().uuid(),
  components: z.array(componentInputSchema).min(1),
});

const editComponentInputSchema = componentInputSchema.extend({
  id: z.string().uuid().optional(),
  manualSizeImage: z.string().min(1).optional(),
});

const editOrderItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  superProductId: z.string().uuid(),
  components: z.array(editComponentInputSchema).min(1),
});

const editOrderSchema = z.object({
  items: z.array(editOrderItemInputSchema).min(1),
});

const setOrderStatusSchema = z.object({
  status: z.string().min(1),
});

const reassignOrderRetailerSchema = z.object({
  retailerId: z.string().uuid(),
});

const createOrderSchema = z
  .object({
    retailerId: z.string().uuid(),
    customerId: z.string().uuid(),
    isRush: z.boolean().optional(),
    repeatOfOrderId: z.string().uuid().optional(),
    items: z.array(orderItemInputSchema).optional(),
  })
  .refine((data) => data.repeatOfOrderId !== undefined || (data.items !== undefined && data.items.length > 0), {
    message: "items must be a non-empty array unless repeatOfOrderId is provided",
  });

const listOrdersQuerySchema = z
  .object({
    retailerId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    status: z.string().min(1).optional(),
  })
  .merge(paginationQuerySchema);

/** Must run after `authenticate`/`requirePermission("orders.create")`. Gates a specific capability within an already-permitted create request — an explicit 403 rather than silently dropping the flag when the actor lacks it. */
async function assertPermission(actorId: string, key: string): Promise<void> {
  const granted = await resolveUserPermissions(actorId);
  if (!granted.has(key)) throw new HttpError(403, "FORBIDDEN", `Missing required permission: ${key}`);
}

export const ordersRouter = Router();

ordersRouter.get("/orders", authenticate, requirePermission("orders.view"), async (req, res, next) => {
  try {
    const { page, pageSize, ...filter } = listOrdersQuerySchema.parse(req.query);
    const { data, total } = await ordersService.listOrders(req.actor!.tenantId, filter, { page, pageSize }, req.actor!.retailerId);
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

ordersRouter.get("/orders/:id", authenticate, requirePermission("orders.view"), async (req, res, next) => {
  try {
    const order = await ordersService.getOrder(req.actor!.tenantId, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
});

/**
 * `orders.create` gates the request at all; `orders.rush`/`orders.repeat` additionally
 * gate their specific flags, checked explicitly here rather than folded into
 * `orders.create` — an actor who can create plain orders but not rush/repeat ones gets a
 * clear 403 instead of the flag being silently dropped.
 */
ordersRouter.post(
  "/orders",
  authenticate,
  requirePermission("orders.create"),
  validateBody(createOrderSchema),
  async (req, res, next) => {
    try {
      if (req.body.isRush) await assertPermission(req.actor!.id, "orders.rush");
      if (req.body.repeatOfOrderId) await assertPermission(req.actor!.id, "orders.repeat");

      const order = await ordersService.createOrder(req.actor!.tenantId, req.body);
      res.status(201).json({ data: order });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Gated on `orders.view`, not `orders.create`: generating a PDF doesn't create or alter
 * any order data — it renders the exact same nested tree `GET /orders/:id` already
 * exposes to anyone holding `orders.view`. Gating it on `orders.create` would wrongly
 * block staff who only view/print orders (e.g. front desk) but never create them.
 */
ordersRouter.post("/orders/:id/pdf", authenticate, requirePermission("orders.view"), async (req, res, next) => {
  try {
    const result = await orderPdfService.generateOrderPdf(req.actor!.tenantId, requireParam(req, "id"), req.actor!.retailerId);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * The full edit-wizard surface (PHASE_10_TASKS.md Workstream E Group 6.2) — add/remove
 * line items or units, re-submit measurements/styling/Manual Size for any unit. Gated by
 * `orders.edit` (granted to Admin/Owner, not Retailer — Retailer keeps `orders.create`
 * instead, per Group 5). Deliberately separate from the narrower status/cancel/reassign
 * actions below, which never touch `items[]`.
 */
ordersRouter.patch(
  "/orders/:id",
  authenticate,
  requirePermission("orders.edit"),
  validateBody(editOrderSchema),
  async (req, res, next) => {
    try {
      const order = await ordersService.editOrderItems(req.actor!.tenantId, requireParam(req, "id"), req.body, req.actor!.retailerId);
      res.status(200).json({ data: order });
    } catch (err) {
      next(err);
    }
  }
);

ordersRouter.patch(
  "/orders/:id/status",
  authenticate,
  requirePermission("orders.edit"),
  validateBody(setOrderStatusSchema),
  async (req, res, next) => {
    try {
      const order = await ordersService.setOrderStatus(req.actor!.tenantId, requireParam(req, "id"), req.body.status, req.actor!.retailerId);
      res.status(200).json({ data: order });
    } catch (err) {
      next(err);
    }
  }
);

ordersRouter.patch(
  "/orders/:id/retailer",
  authenticate,
  requirePermission("orders.edit"),
  validateBody(reassignOrderRetailerSchema),
  async (req, res, next) => {
    try {
      const order = await ordersService.reassignOrderRetailer(
        req.actor!.tenantId,
        requireParam(req, "id"),
        req.body.retailerId,
        req.actor!.retailerId
      );
      res.status(200).json({ data: order });
    } catch (err) {
      next(err);
    }
  }
);
