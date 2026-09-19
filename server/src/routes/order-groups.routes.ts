import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as orderGroupsService from "../services/order-groups.service";
import { orderItemInputSchema } from "./orders.routes";

const createOrderGroupOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(orderItemInputSchema).min(1),
});

const createOrderGroupSchema = z.object({
  retailerId: z.string().uuid(),
  orders: z.array(createOrderGroupOrderSchema).min(1),
});

const listOrderGroupsQuerySchema = z
  .object({
    retailerId: z.string().uuid().optional(),
  })
  .merge(paginationQuerySchema);

export const orderGroupsRouter = Router();

orderGroupsRouter.get("/order-groups", authenticate, requirePermission("orders.view"), async (req, res, next) => {
  try {
    const { page, pageSize, ...filter } = listOrderGroupsQuerySchema.parse(req.query);
    const { data, total } = await orderGroupsService.listOrderGroups(req.actor!.tenantId!, filter, { page, pageSize }, req.actor!.retailerId);
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

orderGroupsRouter.get("/order-groups/:id", authenticate, requirePermission("orders.view"), async (req, res, next) => {
  try {
    const group = await orderGroupsService.getOrderGroup(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: group });
  } catch (err) {
    next(err);
  }
});

orderGroupsRouter.post(
  "/order-groups",
  authenticate,
  requirePermission("orders.group.create"),
  validateBody(createOrderGroupSchema),
  async (req, res, next) => {
    try {
      const group = await orderGroupsService.createOrderGroup(req.actor!.tenantId!, req.body, req.actor!.retailerId);
      res.status(201).json({ data: group });
    } catch (err) {
      next(err);
    }
  }
);
