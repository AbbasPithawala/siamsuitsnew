import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/requirePermission";
import { validateBody } from "../middleware/validateBody";
import { HttpError } from "../utils/http-error";
import { requireParam } from "../utils/params";
import { paginationQuerySchema, paginatedResult } from "../utils/pagination";
import * as invoicesService from "../services/invoices.service";
import * as invoicePdfService from "../services/invoicePdf.service";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

/**
 * `lineItems` (the original freeform manual-entry path) and `orderIds` (legacy
 * `CreateInvoice.jsx`'s real "pick orders" flow) are both optional here — `invoices.service.ts
 * #buildInvoice` is what actually enforces "exactly one of the two", so the 422 there carries
 * a specific, actionable message rather than zod's generic "required" on whichever one a
 * caller happened to omit.
 */
const createInvoiceSchema = z.object({
  retailerId: z.string().uuid(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  orderIds: z.array(z.string().uuid()).min(1).optional(),
  discount: z.number().nonnegative().optional(),
  shippingCharge: z.number().nonnegative().optional(),
  dueDate: z.string().min(1).optional(),
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
    const { data, total } = await invoicesService.listInvoices(req.actor!.tenantId!, filter, { page, pageSize }, req.actor!.retailerId);
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
    const invoice = await invoicesService.getInvoice(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
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
      const invoice = await invoicesService.createInvoice(req.actor!.tenantId!, req.body);
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
      const invoice = await invoicesService.updateInvoiceStatus(req.actor!.tenantId!, requireParam(req, "id"), req.body.status, req.actor!.retailerId);
      res.status(200).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

/** Legacy `CreateInvoice.jsx`'s order table (minus the client-side `invoiceSent === false` filter — the service already excludes those) — orders for this retailer with a saved per-order invoice, not yet bundled into any grouped invoice. Staff-only, same as invoice creation itself. */
invoicesRouter.get(
  "/retailers/:id/invoiceable-orders",
  authenticate,
  requirePermission("invoices.manage"),
  async (req, res, next) => {
    try {
      const orders = await invoicesService.listInvoiceableOrders(req.actor!.tenantId!, requireParam(req, "id"));
      res.status(200).json({ data: orders });
    } catch (err) {
      next(err);
    }
  }
);

/** Legacy `InvoiceHistory.jsx`'s "View" dialog's order list (S.No/Order No/View). */
invoicesRouter.get("/invoices/:id/orders", authenticate, requirePermission("invoices.view"), async (req, res, next) => {
  try {
    const orders = await invoicesService.getInvoiceOrders(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: orders });
  } catch (err) {
    next(err);
  }
});

/** Legacy `InvoiceHistory.jsx`'s "View Invoice Summary" — server-rendered, persisted PDF (per PHASE_10_TASKS.md's invoicing follow-up) rather than legacy's client-side `jsPDF`. */
invoicesRouter.post("/invoices/:id/pdf", authenticate, requirePermission("invoices.view"), async (req, res, next) => {
  try {
    const path = await invoicePdfService.generateRetailerInvoicePdf(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
    res.status(201).json({ data: { path } });
  } catch (err) {
    next(err);
  }
});

/** Legacy `InvoiceHistory.jsx`'s admin-only "Resend" (`handleSendMail`) — regenerates the grouped PDF and emails it to the retailer's configured recipients. */
invoicesRouter.post("/invoices/:id/send-email", authenticate, requirePermission("invoices.manage"), async (req, res, next) => {
  try {
    await invoicePdfService.sendRetailerInvoiceEmail(req.actor!.tenantId!, requireParam(req, "id"), req.actor!.retailerId);
    res.status(200).json({ data: { sent: true } });
  } catch (err) {
    next(err);
  }
});
