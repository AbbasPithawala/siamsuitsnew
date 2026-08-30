import { boolean, integer, jsonb, numeric, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, softDeleteColumn, timestampColumns } from "./_shared";
import { tenants, retailers } from "./tenancy";
import { orderItemComponents, orders } from "./orders";

/**
 * Ported relationally with no behavior change from the legacy Mongo shape — this group
 * is the least structurally interesting part of the rewrite, per PHASE_1_TASKS.md
 * Group 5. `lineItems` stays jsonb for now rather than fully normalized, since invoice
 * line-item shape hasn't been identified as a pain point worth a join-table redesign.
 */
export const retailerInvoices = pgTable("retailer_invoices", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  invoiceNumber: text("invoice_number").notNull(),
  lineItems: jsonb("line_items").notNull().default([]),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingCharge: numeric("shipping_charge", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("Unpaid"),
  dueDate: text("due_date"),
  // Set once this invoice's grouped-summary PDF has actually been generated
  // (`invoicePdf.service.ts#generateRetailerInvoicePdf`) — `null` until then, matching
  // `orders.pdfPath`'s own "generated lazily, not at create time" convention.
  pdfPath: text("pdf_path"),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantInvoiceNumberUnique: uniqueIndex("retailer_invoices_tenant_invoice_number_unique").on(
    table.tenantId,
    table.invoiceNumber
  ),
}));

/**
 * Which real orders a grouped retailer invoice bundled — the legacy `RetailerInvoices.orders`
 * array made relational. An order can be included in at most one retailer invoice ever
 * (`orderIdUnique` below) — matching legacy's real behavior: once bundled, `Order.invoiceSent`
 * flips permanently and the order drops out of every future "orders available to invoice"
 * list (`invoices.service.ts#listInvoiceableOrders`). Distinct from `retailerInvoices.lineItems`
 * (still freeform description/qty/price, used by the pre-existing manual-entry create path) —
 * this table exists purely so an order-driven invoice can be traced back to, and drills down
 * into, the exact orders it billed.
 */
export const retailerInvoiceOrders = pgTable("retailer_invoice_orders", {
  ...idColumn,
  retailerInvoiceId: uuid("retailer_invoice_id").notNull().references(() => retailerInvoices.id),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  ...timestampColumns,
}, (table) => ({
  orderUnique: uniqueIndex("retailer_invoice_orders_order_id_unique").on(table.orderId),
}));

export const orderInvoiceLineKindEnum = pgEnum("order_invoice_line_kind", ["unit", "additional", "charge"]);

/**
 * A single order's own priced invoice draft (legacy `Order.invoice`) — one row per order
 * (`orderIdUnique`), created/edited by staff (`invoices.manage`) via `orderInvoices.service.ts`
 * before that order can be bundled into a `retailerInvoices` row. `total` is always the
 * server-computed sum of this invoice's `orderInvoiceLines.price` (never trusted from the
 * client — `payroll.service.ts`'s settlement math and `invoices.service.ts#resolveLineItems`
 * are this codebase's established precedent for computing financial totals server-side), kept
 * denormalized here (not just derived at read time) so `listInvoiceableOrders` can filter/sort
 * on it without joining and summing lines for every candidate order.
 */
export const orderInvoices = pgTable("order_invoices", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  note: text("note"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  // Set once this order's own single-order PDF has actually been generated
  // (`invoicePdf.service.ts#generateOrderInvoicePdf`) — regenerated (overwritten) on demand,
  // never assumed stale-checked against `orderInvoiceLines`.
  pdfPath: text("pdf_path"),
  ...timestampColumns,
}, (table) => ({
  orderUnique: uniqueIndex("order_invoices_order_id_unique").on(table.orderId),
}));

/**
 * Flattened rather than three separate tables (unit / additional-style / ad-hoc-charge) —
 * legacy's real UI groups all of a unit's lines together (its own price line, its priced
 * "additional" style sub-lines, its ad-hoc `additional_charges`) under one visual heading, and
 * `groupLabel` + `kind` capture exactly that grouping/discriminator without needing separate
 * parent-line/child-line FKs. `groupLabel` is the unit's own display label (e.g. "Suit #1 —
 * Jacket") repeated on every line in that group — denormalized on purpose, since a line never
 * needs to be queried independent of its group's label and this avoids a self-join.
 * `kind: "unit"` is the auto-generated base price line for one physical component; `"additional"`
 * is an auto-generated sub-line for one of that component's selected `features.is_additional`
 * choices (both seeded fresh from the order's real data every time the draft is (re)computed,
 * price defaulting to 0 for staff to fill in); `"charge"` is a free-form ad-hoc line staff adds
 * by hand (legacy's "+" button), never auto-generated and never overwritten by a re-generated
 * draft.
 */
export const orderInvoiceLines = pgTable("order_invoice_lines", {
  ...idColumn,
  orderInvoiceId: uuid("order_invoice_id").notNull().references(() => orderInvoices.id),
  groupLabel: text("group_label").notNull(),
  kind: orderInvoiceLineKindEnum("kind").notNull(),
  label: text("label").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestampColumns,
});

export const shippingBoxes = pgTable("shipping_boxes", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  trackingCode: text("tracking_code").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  ...timestampColumns,
}, (table) => ({
  trackingCodeUnique: uniqueIndex("shipping_boxes_tracking_code_unique").on(table.trackingCode),
}));

export const shippingBoxItems = pgTable("shipping_box_items", {
  ...idColumn,
  shippingBoxId: uuid("shipping_box_id").notNull().references(() => shippingBoxes.id),
  orderItemComponentId: uuid("order_item_component_id").notNull().references(() => orderItemComponents.id),
}, (table) => ({
  shippingBoxItemUnique: uniqueIndex("shipping_box_items_unique").on(
    table.shippingBoxId,
    table.orderItemComponentId
  ),
}));
