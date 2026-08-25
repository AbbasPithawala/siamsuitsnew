import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { retailerInvoices } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireRetailer } from "./customers.service";
import { isUniqueConstraintConflict } from "./orders.service";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export const INVOICE_NUMBER_CONSTRAINT = "retailer_invoices_tenant_invoice_number_unique";

export const INVOICE_STATUSES = ["Unpaid", "Paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  retailerId: string;
  lineItems: LineItemInput[];
  discount?: number;
  shippingCharge?: number;
}

export interface ListInvoicesFilter {
  retailerId?: string | undefined;
  status?: string | undefined;
}

function isInvoiceNumberConflict(err: unknown): boolean {
  return isUniqueConstraintConflict(err, INVOICE_NUMBER_CONSTRAINT);
}

/**
 * `retailerId`, when given, is embedded directly in the query's own `WHERE` — same
 * WHERE-embedded shape as `customers.service.ts`'s `requireCustomer` (Workstream E
 * Decision 3).
 */
export async function requireInvoice(tx: Transaction, id: string, retailerId?: string | null) {
  const invoice = await tx.query.retailerInvoices.findFirst({
    where: (i, { and, eq, isNull }) =>
      and(eq(i.id, id), isNull(i.deletedAt), retailerId ? eq(i.retailerId, retailerId) : undefined),
  });
  if (!invoice) throw new HttpError(404, "INVOICE_NOT_FOUND", `Invoice ${id} not found`);
  return invoice;
}

/**
 * `${retailer.code}-INV-${sequence}`, sequence = count of this retailer's invoices so far
 * + 1 — same TOCTOU-then-retry approach as `orders.service.ts`'s `generateOrderNumber`
 * (see its comment): two concurrent creates can race on the count, so `createInvoice`
 * retries from scratch on a unique-constraint conflict rather than trying to make the
 * read-then-insert atomic here.
 */
async function generateInvoiceNumber(tx: Transaction, retailerId: string, retailerCode: string): Promise<string> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(retailerInvoices)
    .where(eq(retailerInvoices.retailerId, retailerId));
  const sequence = (row?.count ?? 0) + 1;
  return `${retailerCode}-INV-${String(sequence).padStart(4, "0")}`;
}

interface ResolvedLineItem extends LineItemInput {
  amount: string;
}

/**
 * Validates and resolves the client's `lineItems[]`, computing each line's `amount` and
 * the invoice `total` server-side — the client only supplies description/quantity/
 * unitPrice (plus overall discount/shippingCharge), never a total, per this codebase's
 * "server computes financial totals" standard (`payroll.service.ts`'s settlement math is
 * the precedent this follows).
 */
function resolveLineItems(lineItems: LineItemInput[]): { resolved: ResolvedLineItem[]; subTotal: number } {
  if (lineItems.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "lineItems must be a non-empty array");
  }

  let subTotal = 0;
  const resolved: ResolvedLineItem[] = [];
  for (const item of lineItems) {
    if (!(item.quantity > 0) || !(item.unitPrice >= 0)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Each line item's quantity must be positive and unitPrice non-negative");
    }
    const amount = item.quantity * item.unitPrice;
    subTotal += amount;
    resolved.push({ ...item, amount: amount.toFixed(2) });
  }

  return { resolved, subTotal };
}

async function buildInvoice(tx: Transaction, tenantId: string, input: CreateInvoiceInput) {
  const retailer = await requireRetailer(tx, input.retailerId);

  const { resolved, subTotal } = resolveLineItems(input.lineItems);
  const discount = input.discount ?? 0;
  const shippingCharge = input.shippingCharge ?? 0;
  const total = subTotal - discount + shippingCharge;
  if (total < 0) {
    throw new HttpError(422, "INVALID_TOTAL", "discount exceeds the invoice's line items plus shipping charge");
  }

  const invoiceNumber = await generateInvoiceNumber(tx, retailer.id, retailer.code);

  const [invoice] = await tx
    .insert(retailerInvoices)
    .values({
      tenantId,
      retailerId: retailer.id,
      invoiceNumber,
      lineItems: resolved,
      discount: discount.toFixed(2),
      shippingCharge: shippingCharge.toFixed(2),
      total: total.toFixed(2),
      status: "Unpaid",
    })
    .returning();
  if (!invoice) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create invoice");
  return invoice;
}

/**
 * `retriesLeft` defaults to 2 (3 attempts total) — same rationale as
 * `orders.service.ts`'s `createOrder`: a single retry covers a 2-way race outright, and a
 * small budget covers a realistic pile-up without a dedicated sequence table for what is,
 * in practice, low-frequency admin traffic.
 */
export async function createInvoice(
  tenantId: string,
  input: CreateInvoiceInput,
  retriesLeft = 2
): Promise<Awaited<ReturnType<typeof buildInvoice>>> {
  try {
    return await withTenant(tenantId, (tx) => buildInvoice(tx, tenantId, input));
  } catch (err) {
    if (retriesLeft > 0 && isInvoiceNumberConflict(err)) {
      return createInvoice(tenantId, input, retriesLeft - 1);
    }
    throw err;
  }
}

/**
 * `actorRetailerId`, when non-null, forces the effective `retailerId` filter to the
 * actor's own id, ignoring `filter.retailerId` (Workstream E Decision 3).
 */
export function listInvoices(
  tenantId: string,
  filter: ListInvoicesFilter = {},
  pagination: PaginationParams = DEFAULT_PAGINATION,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const retailerId = actorRetailerId ?? filter.retailerId;
    if (retailerId) await requireRetailer(tx, retailerId);

    const conditions = [isNull(retailerInvoices.deletedAt)];
    if (retailerId) conditions.push(eq(retailerInvoices.retailerId, retailerId));
    if (filter.status) conditions.push(eq(retailerInvoices.status, filter.status));
    const where = and(...conditions);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.retailerInvoices.findMany({ where, orderBy: (i, { desc }) => desc(i.createdAt), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(retailerInvoices).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

export function getInvoice(tenantId: string, id: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, (tx) => requireInvoice(tx, id, actorRetailerId));
}

/**
 * Transitions an invoice's status. Rejects a no-op transition (already in the requested
 * status) with a 409 rather than a silent no-op — same posture as
 * `manufacturing.service.ts`'s `completeStep`/`extra-payments.service.ts`'s
 * `approveExtraPayment` on re-applying an already-applied state change.
 */
export async function updateInvoiceStatus(tenantId: string, id: string, status: InvoiceStatus, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const invoice = await requireInvoice(tx, id, actorRetailerId);
    if (invoice.status === status) {
      throw new HttpError(409, "INVOICE_STATUS_UNCHANGED", `Invoice ${id} is already "${status}"`);
    }

    const [updated] = await tx
      .update(retailerInvoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(retailerInvoices.id, id))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update invoice status");
    return updated;
  });
}
