import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as customersService from "../services/customers.service";

const createCustomerSchema = z.object({
  retailerId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  contactNumber: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

const listCustomersQuerySchema = z
  .object({
    retailerId: z.string().uuid().optional(),
  })
  .merge(paginationQuerySchema);

/**
 * Reads are gated by `authenticate` only, same convention as Phase 2's catalog routes —
 * `customers.manage` (seeded under the Retailers module) only gates writes.
 */
export const customersRouter = Router();

customersRouter.get("/customers", authenticate, async (req, res, next) => {
  try {
    const { page, pageSize, ...filter } = listCustomersQuerySchema.parse(req.query);
    const { data, total } = await customersService.listCustomers(req.actor!.tenantId!, filter, { page, pageSize }, req.actor!.retailerId);
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

customersRouter.get("/customers/:id", authenticate, async (req, res, next) => {
  try {
    const customer = await customersService.getCustomer(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: customer });
  } catch (err) {
    next(err);
  }
});

customersRouter.post(
  "/customers",
  authenticate,
  requirePermission("customers.manage"),
  validateBody(createCustomerSchema),
  async (req, res, next) => {
    try {
      const customer = await customersService.createCustomer(req.actor!.tenantId!, req.body);
      res.status(201).json({ data: customer });
    } catch (err) {
      next(err);
    }
  }
);

customersRouter.patch(
  "/customers/:id",
  authenticate,
  requirePermission("customers.manage"),
  validateBody(updateCustomerSchema),
  async (req, res, next) => {
    try {
      const customer = await customersService.updateCustomer(req.actor!.tenantId!, requireParam(req, "id"), req.body, req.actor!.retailerId);
      res.status(200).json({ data: customer });
    } catch (err) {
      next(err);
    }
  }
);

customersRouter.delete("/customers/:id", authenticate, requirePermission("customers.manage"), async (req, res, next) => {
  try {
    await customersService.softDeleteCustomer(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
