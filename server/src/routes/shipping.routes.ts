import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as shippingService from "../services/shipping.service";

const createShippingBoxSchema = z.object({
  retailerId: z.string().uuid(),
});

const addShippingBoxItemSchema = z.object({
  orderItemComponentId: z.string().uuid(),
});

const listShippingBoxesQuerySchema = z
  .object({
    retailerId: z.string().uuid().optional(),
    isClosed: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  })
  .merge(paginationQuerySchema);

/** Reads are gated by `shipping.view` OR `shipping.manage` (retailers hold only the former); writes require `shipping.manage`, mirroring `invoices.manage`/`invoices.view`'s split. */
export const shippingRouter = Router();

const requireShippingRead = requirePermission(["shipping.view", "shipping.manage"]);

shippingRouter.get("/shipping-boxes", authenticate, requireShippingRead, async (req, res, next) => {
  try {
    const { page, pageSize, ...filter } = listShippingBoxesQuerySchema.parse(req.query);
    const { data, total } = await shippingService.listShippingBoxes(req.actor!.tenantId, filter, { page, pageSize }, req.actor!.retailerId);
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

shippingRouter.get("/shipping-boxes/:id", authenticate, requireShippingRead, async (req, res, next) => {
  try {
    const box = await shippingService.getShippingBox(req.actor!.tenantId, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: box });
  } catch (err) {
    next(err);
  }
});

shippingRouter.post(
  "/shipping-boxes",
  authenticate,
  requirePermission("shipping.manage"),
  validateBody(createShippingBoxSchema),
  async (req, res, next) => {
    try {
      const box = await shippingService.createShippingBox(req.actor!.tenantId, req.body);
      res.status(201).json({ data: box });
    } catch (err) {
      next(err);
    }
  }
);

shippingRouter.post(
  "/shipping-boxes/:id/items",
  authenticate,
  requirePermission("shipping.manage"),
  validateBody(addShippingBoxItemSchema),
  async (req, res, next) => {
    try {
      const item = await shippingService.addItemToBox(
        req.actor!.tenantId,
        requireParam(req, "id"),
        req.body.orderItemComponentId,
        req.actor!.retailerId
      );
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  }
);

shippingRouter.delete(
  "/shipping-boxes/:id/items/:componentId",
  authenticate,
  requirePermission("shipping.manage"),
  async (req, res, next) => {
    try {
      await shippingService.removeItemFromBox(
        req.actor!.tenantId,
        requireParam(req, "id"),
        requireParam(req, "componentId"),
        req.actor!.retailerId
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

shippingRouter.post("/shipping-boxes/:id/close", authenticate, requirePermission("shipping.manage"), async (req, res, next) => {
  try {
    const box = await shippingService.closeShippingBox(req.actor!.tenantId, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: box });
  } catch (err) {
    next(err);
  }
});
