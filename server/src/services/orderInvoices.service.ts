import { eq, inArray } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { orderInvoices, orderInvoiceLines, superProducts } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOrder, assembleOrderDetail } from "./orders.service";

export const ORDER_INVOICE_LINE_KINDS = ["unit", "additional", "charge"] as const;
export type OrderInvoiceLineKind = (typeof ORDER_INVOICE_LINE_KINDS)[number];

export interface OrderInvoiceLineInput {
  groupLabel: string;
  kind: OrderInvoiceLineKind;
  label: string;
  price: number;
}

export interface SaveOrderInvoiceInput {
  note?: string | undefined;
  lines: OrderInvoiceLineInput[];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

type OrderDetail = Awaited<ReturnType<typeof assembleOrderDetail>>;

/**
 * The per-order invoice's auto-generated starting point (legacy `CreateInvoice.jsx`'s own
 * "open an order, get a pre-filled draft" behavior, `handleClickOpen`) — one `"unit"` line per
 * physical component (legacy's per-unit loop, generalized to our real per-component data
 * instead of legacy's flat, jacket-and-pant-conflated `styles[]` blob). Every price starts at
 * 0 — staff fills them in via `saveOrderInvoice`; this function itself never writes anything,
 * so re-deriving a draft (e.g. the order was edited since it was last invoiced) is always safe
 * and side-effect-free.
 *
 * Deliberately does NOT also auto-generate a priced sub-line per selected `is_additional`
 * feature (an earlier version of this function did) — real feedback was that surfacing every
 * selected button/pocket/stitching style as its own line was noise, not useful default
 * pricing. Any extra priced line beyond the one-per-component base is exactly legacy's own
 * `additional_charges` mechanism: a plain, freeform, staff-added "+ Add charge" line
 * (`kind: "charge"`, `OrderInvoiceEditorDialog.tsx`'s own "+" button) — never auto-populated.
 */
async function buildDraftLines(tx: Transaction, detail: OrderDetail): Promise<OrderInvoiceLineInput[]> {
  const superProductIds = unique(detail.items.map((item) => item.superProductId));
  const superProductRows = superProductIds.length
    ? await tx.query.superProducts.findMany({ where: inArray(superProducts.id, superProductIds) })
    : [];
  const superProductById = new Map(superProductRows.map((sp) => [sp.id, sp]));

  const lines: OrderInvoiceLineInput[] = [];
  for (const item of detail.items) {
    const superProductName = superProductById.get(item.superProductId)?.name ?? "Item";
    for (const component of item.components) {
      const groupLabel = `${superProductName} #${item.sequence} — ${component.slotLabel}`;
      lines.push({ groupLabel, kind: "unit", label: groupLabel, price: 0 });
    }
  }
  return lines;
}

export interface OrderInvoiceView {
  id: string | null;
  orderId: string;
  note: string | null;
  total: string;
  pdfPath: string | null;
  /** `true` when this is a freshly-computed, not-yet-saved draft (no `order_invoices` row exists for this order yet). */
  isDraft: boolean;
  lines: { id: string | null; groupLabel: string; kind: OrderInvoiceLineKind; label: string; price: string; sortOrder: number }[];
}

/**
 * Returns the order's saved invoice if `saveOrderInvoice` has ever been called for it,
 * otherwise a fresh, unsaved draft built from the order's current real data — mirroring
 * legacy's own "already has `invoiceCreate`? load the saved one : compute from styles" branch
 * in `handleClickOpen`.
 */
export function getOrderInvoice(tenantId: string, orderId: string, actorRetailerId?: string | null): Promise<OrderInvoiceView> {
  return withTenant(tenantId, async (tx) => {
    const order = await requireOrder(tx, orderId, actorRetailerId);

    const saved = await tx.query.orderInvoices.findFirst({ where: eq(orderInvoices.orderId, orderId) });
    if (saved) {
      const lines = await tx.query.orderInvoiceLines.findMany({
        where: eq(orderInvoiceLines.orderInvoiceId, saved.id),
        orderBy: (l, { asc }) => asc(l.sortOrder),
      });
      return { ...saved, isDraft: false, lines };
    }

    const detail = await assembleOrderDetail(tx, order);
    const draftLines = await buildDraftLines(tx, detail);
    return {
      id: null,
      orderId,
      note: null,
      total: "0.00",
      pdfPath: null,
      isDraft: true,
      lines: draftLines.map((line, index) => ({ id: null, ...line, price: line.price.toFixed(2), sortOrder: index })),
    };
  });
}

/**
 * Full replace of this order's invoice lines (same "delete-then-reinsert" convention
 * `setProductMeasurements`/`setFeatureProducts` use for admin-managed link sets) — `total` is
 * always the server-computed sum of `lines[].price`, never trusted from the client, per this
 * codebase's "server computes financial totals" standard (`invoices.service.ts#resolveLineItems`
 * is the direct precedent this follows for the retailer-invoice side of this same feature).
 */
export async function saveOrderInvoice(
  tenantId: string,
  orderId: string,
  input: SaveOrderInvoiceInput,
  actorRetailerId?: string | null
): Promise<OrderInvoiceView> {
  if (input.lines.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "lines must be a non-empty array");
  }
  for (const line of input.lines) {
    if (!(line.price >= 0)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Each line's price must be non-negative");
    }
  }

  return withTenant(tenantId, async (tx) => {
    await requireOrder(tx, orderId, actorRetailerId);
    const total = input.lines.reduce((sum, line) => sum + line.price, 0);

    const existing = await tx.query.orderInvoices.findFirst({ where: eq(orderInvoices.orderId, orderId) });
    const note = input.note?.trim() || null;

    const [invoice] = existing
      ? await tx
          .update(orderInvoices)
          .set({ note, total: total.toFixed(2), updatedAt: new Date() })
          .where(eq(orderInvoices.id, existing.id))
          .returning()
      : await tx.insert(orderInvoices).values({ tenantId, orderId, note, total: total.toFixed(2) }).returning();
    if (!invoice) throw new HttpError(500, "INTERNAL_ERROR", "Failed to save order invoice");

    await tx.delete(orderInvoiceLines).where(eq(orderInvoiceLines.orderInvoiceId, invoice.id));
    await tx.insert(orderInvoiceLines).values(
      input.lines.map((line, index) => ({
        orderInvoiceId: invoice.id,
        groupLabel: line.groupLabel,
        kind: line.kind,
        label: line.label,
        price: line.price.toFixed(2),
        sortOrder: index,
      }))
    );

    const lines = await tx.query.orderInvoiceLines.findMany({
      where: eq(orderInvoiceLines.orderInvoiceId, invoice.id),
      orderBy: (l, { asc }) => asc(l.sortOrder),
    });
    return { ...invoice, isDraft: false, lines };
  });
}

/** Reused by `invoicePdf.service.ts` and `invoices.service.ts#listInvoiceableOrders` — the one real, saved invoice row for an order, or `null` if `saveOrderInvoice` has never been called for it. */
export async function findSavedOrderInvoice(tx: Transaction, orderId: string) {
  const invoice = await tx.query.orderInvoices.findFirst({ where: eq(orderInvoices.orderId, orderId) });
  if (!invoice) return null;
  const lines = await tx.query.orderInvoiceLines.findMany({
    where: eq(orderInvoiceLines.orderInvoiceId, invoice.id),
    orderBy: (l, { asc }) => asc(l.sortOrder),
  });
  return { ...invoice, lines };
}
