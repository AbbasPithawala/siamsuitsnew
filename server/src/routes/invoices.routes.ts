import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as invoicesService from "../services/invoices.service";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const createInvoiceSchema = z.object({
  retailerId: z.string().uuid(),
  lineItems: z.array(lineItemSchema).min(1),
  discount: z.number().nonnegative().optional(),
  shippingCharge: z.number().nonnegative().optional(),
});

const updateInvoiceStatusSchema = z.object({
  status: z.enum(invoicesService.INVOICE_STATUSES),
});

const listInvoicesQuerySchema = z
  .object({
    retailerId: z.string().uuid().optional(),
    status: z.string().min(1).optional(),
  })
  .merge(paginationQuerySchema);

/**
 * Mounted at `/api/invoices` (not `/api/retailer-invoices`) to match the
 * `invoices.manage`/`invoices.view` permission key naming and
 * `REWRITE_ARCHITECTURE.md`'s terminology, even though the underlying table is
 * `retailer_invoices`.
 *
 * Reads are gated by `invoices.view`, not `authenticate`-only like Phase 5's catalog
 * convention (products/processes/etc. are shared reference data anyone logged in can
 * browse). An invoice is financial data about one specific retailer's billing — dollar
 * amounts, discounts, payment status — so any authenticated staff member browsing every
 * retailer's invoice history by default is the wrong default. `orders.view` already
 * establishes this same "gate reads with a permission" precedent for orders, which are
 * comparably sensitive; invoices follow it too. Writes require `invoices.manage`.
 */
export const invoicesRouter = Router();

invoicesRouter.get("/invoices", authenticate, requirePermission("invoices.view"), async (req, res, next) => {
  try {
    const { page, pageSize, ...filter } = listInvoicesQuerySchema.parse(req.query);
    const { data, total } = await invoicesService.listInvoices(req.actor!.tenantId, filter, { page, pageSize }, req.actor!.retailerId);
    res.status(200).json(paginatedResult(data, total, page, pageSize));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new HttpError(400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid query"));
      return;
    }
    next(err);
  }
});

invoicesRouter.get("/invoices/:id", authenticate, requirePermission("invoices.view"), async (req, res, next) => {
  try {
    const invoice = await invoicesService.getInvoice(req.actor!.tenantId, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: invoice });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.post(
  "/invoices",
  authenticate,
  requirePermission("invoices.manage"),
  validateBody(createInvoiceSchema),
  async (req, res, next) => {
    try {
      const invoice = await invoicesService.createInvoice(req.actor!.tenantId, req.body);
      res.status(201).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

invoicesRouter.patch(
  "/invoices/:id/status",
  authenticate,
  requirePermission("invoices.manage"),
  validateBody(updateInvoiceStatusSchema),
  async (req, res, next) => {
    try {
      const invoice = await invoicesService.updateInvoiceStatus(req.actor!.tenantId, requireParam(req, "id"), req.body.status, req.actor!.retailerId);
      res.status(200).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }
);
