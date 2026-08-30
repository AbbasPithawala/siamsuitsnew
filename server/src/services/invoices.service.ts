import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { retailerInvoices, retailerInvoiceOrders, orderInvoices, orders, customers } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireRetailer } from "./customers.service";
import { requireOrder, isUniqueConstraintConflict } from "./orders.service";
import { findSavedOrderInvoice } from "./orderInvoices.service";
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

/**
 * Exactly one of `lineItems` (the original, still-supported freeform manual entry path) or
 * `orderIds` (legacy `CreateInvoice.jsx`'s real "pick orders" flow, PHASE_10_TASKS.md
 * invoicing follow-up) must be provided — `buildInvoice` rejects both-or-neither. Providing
 * `orderIds` auto-builds one `lineItems` row per order (description = order number + customer,
 * quantity 1, unitPrice = that order's own saved `order_invoices.total`) rather than requiring
 * the client to already know each order's total.
 */
export interface CreateInvoiceInput {
  retailerId: string;
  lineItems?: LineItemInput[];
  orderIds?: string[];
  discount?: number;
  shippingCharge?: number;
  dueDate?: string;
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

/**
 * One `LineItemInput` per order, sourced from that order's own saved invoice total rather
 * than anything the client sends — legacy's real grouped-invoice PDF renders exactly this
 * shape, one row per order (Order No/Customer/Products/Amount). Validates each order belongs
 * to this retailer, has a saved per-order invoice at all (legacy's "checkbox only enabled once
 * `invoice.total_amount` is truthy" gate, enforced here server-side instead of merely in the
 * client), and isn't already bundled into a different retailer invoice (`retailer_invoice_orders`'
 * own `orderIdUnique` would catch this at insert time regardless, but failing fast here with a
 * specific order id in the message is far more useful than a generic constraint-violation 500).
 */
async function resolveLineItemsFromOrders(tx: Transaction, retailerId: string, orderIds: string[]): Promise<LineItemInput[]> {
  const lineItems: LineItemInput[] = [];
  for (const orderId of orderIds) {
    const order = await requireOrder(tx, orderId);
    if (order.retailerId !== retailerId) {
      throw new HttpError(422, "ORDER_RETAILER_MISMATCH", `Order ${orderId} does not belong to this retailer`);
    }

    const orderInvoice = await findSavedOrderInvoice(tx, orderId);
    if (!orderInvoice) {
      throw new HttpError(422, "ORDER_INVOICE_MISSING", `Order ${order.orderNumber} has no saved invoice yet`);
    }

    const alreadyIncluded = await tx.query.retailerInvoiceOrders.findFirst({ where: eq(retailerInvoiceOrders.orderId, orderId) });
    if (alreadyIncluded) {
      throw new HttpError(409, "ORDER_ALREADY_INVOICED", `Order ${order.orderNumber} is already included in another invoice`);
    }

    const customer = await tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) });
    const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";
    lineItems.push({
      description: `${order.orderNumber} — ${customerName}`,
      quantity: 1,
      unitPrice: Number(orderInvoice.total),
    });
  }
  return lineItems;
}

async function buildInvoice(tx: Transaction, tenantId: string, input: CreateInvoiceInput) {
  const retailer = await requireRetailer(tx, input.retailerId);

  if (Boolean(input.lineItems?.length) === Boolean(input.orderIds?.length)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Provide exactly one of lineItems or orderIds");
  }
  const lineItemInputs = input.orderIds?.length
    ? await resolveLineItemsFromOrders(tx, retailer.id, input.orderIds)
    : input.lineItems!;

  const { resolved, subTotal } = resolveLineItems(lineItemInputs);
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
      dueDate: input.dueDate ?? null,
    })
    .returning();
  if (!invoice) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create invoice");

  if (input.orderIds?.length) {
    await tx.insert(retailerInvoiceOrders).values(input.orderIds.map((orderId) => ({ retailerInvoiceId: invoice.id, orderId })));
  }

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

export interface InvoiceableOrder {
  id: string;
  orderNumber: string;
  orderDate: Date;
  customerName: string;
  /** `null` when this order has no saved per-order invoice yet — legacy's own gate ("checkbox only enabled once `total_amount` is truthy") is enforced client-side off this, and again server-side by `resolveLineItemsFromOrders` if it's ever bypassed. */
  total: string | null;
}

/**
 * A retailer's orders not yet bundled into a grouped invoice — legacy `CreateInvoice.jsx`'s
 * own order table, filtered the same way it filters to `invoiceSent === false`
 * (`LEFT JOIN ... IS NULL` against `retailerInvoiceOrders`). Deliberately includes orders with
 * no saved per-order invoice yet (`LEFT JOIN orderInvoices`, `total: null`) rather than hiding
 * them outright — legacy shows every one of a retailer's open orders here and merely disables
 * the checkbox until that order's own invoice has been priced; hiding them entirely would give
 * staff no way to discover which orders still need pricing before they can be grouped.
 */
export function listInvoiceableOrders(tenantId: string, retailerId: string): Promise<InvoiceableOrder[]> {
  return withTenant(tenantId, async (tx) => {
    await requireRetailer(tx, retailerId);

    const rows = await tx
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderDate: orders.orderDate,
        firstName: customers.firstName,
        lastName: customers.lastName,
        total: orderInvoices.total,
      })
      .from(orders)
      .leftJoin(orderInvoices, eq(orderInvoices.orderId, orders.id))
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(retailerInvoiceOrders, eq(retailerInvoiceOrders.orderId, orders.id))
      .where(and(eq(orders.retailerId, retailerId), isNull(orders.deletedAt), isNull(retailerInvoiceOrders.id)))
      .orderBy(desc(orders.orderDate));

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      orderDate: row.orderDate,
      customerName: [row.firstName, row.lastName].filter((v): v is string => Boolean(v)).join(" "),
      total: row.total,
    }));
  });
}

export interface InvoiceOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
}

/**
 * `tx`-scoped, not `withTenant`-wrapping — exported separately from `getInvoiceOrders` below
 * so `invoicePdf.service.ts#generateRetailerInvoicePdf` (already running inside its own
 * `withTenant` transaction) can call this directly instead of nesting a second transaction on
 * a second pooled connection just to re-fetch the same invoice's orders.
 */
export async function fetchInvoiceOrders(tx: Transaction, retailerInvoiceId: string): Promise<InvoiceOrderSummary[]> {
  const rows = await tx
    .select({ id: orders.id, orderNumber: orders.orderNumber, firstName: customers.firstName, lastName: customers.lastName })
    .from(retailerInvoiceOrders)
    .innerJoin(orders, eq(orders.id, retailerInvoiceOrders.orderId))
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(retailerInvoiceOrders.retailerInvoiceId, retailerInvoiceId));

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: [row.firstName, row.lastName].filter((v): v is string => Boolean(v)).join(" "),
  }));
}

/** The real orders bundled into one grouped invoice — legacy `InvoiceHistory.jsx`'s "View" dialog's order list (S.No/Order No/View), each row's own "View" drilling into that order's single-order PDF. */
export function getInvoiceOrders(tenantId: string, invoiceId: string, actorRetailerId?: string | null): Promise<InvoiceOrderSummary[]> {
  return withTenant(tenantId, async (tx) => {
    const invoice = await requireInvoice(tx, invoiceId, actorRetailerId);
    return fetchInvoiceOrders(tx, invoice.id);
  });
}
