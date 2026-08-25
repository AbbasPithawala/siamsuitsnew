import { boolean, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, softDeleteColumn, timestampColumns } from "./_shared";
import { tenants, retailers } from "./tenancy";
import { orderItemComponents } from "./orders";

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
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantInvoiceNumberUnique: uniqueIndex("retailer_invoices_tenant_invoice_number_unique").on(
    table.tenantId,
    table.invoiceNumber
  ),
}));

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
