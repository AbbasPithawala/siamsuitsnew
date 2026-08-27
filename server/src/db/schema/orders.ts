import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, softDeleteColumn, timestampColumns } from "./_shared";
import { tenants, retailers } from "./tenancy";
import { superProducts, products, features, styles, styleOptions, measurementDefinitions } from "./catalog";

export const customers = pgTable("customers", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  gender: text("gender"),
  contactNumber: text("contact_number"),
  image: text("image"),
  ...timestampColumns,
  ...softDeleteColumn,
});

/**
 * A customer's "current default" measurements for a given product — one row per
 * (tenant, customer, product), refined incrementally as a side effect of order creation
 * (PHASE_10_TASKS.md Workstream D Decision 2), never a direct-write admin resource of its
 * own. Carries its own `tenant_id`/RLS policy like every other top-level tenant table;
 * `customer_measurement_profile_values` below is the transitively-scoped child.
 */
export const customerMeasurementProfiles = pgTable("customer_measurement_profiles", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantCustomerProductUnique: uniqueIndex("customer_measurement_profiles_unique").on(
    table.tenantId,
    table.customerId,
    table.productId
  ),
}));

/**
 * One row per measurement definition, mirroring `order_item_component_measurements`'s
 * exact numeric-column shape. Written by a per-row `ON CONFLICT ... DO UPDATE` upsert
 * (`measurementProfiles.service.ts#upsertCustomerMeasurementProfileValues`), deliberately
 * NOT the delete-then-reinsert full-replace `setProductMeasurements`/`setFeatureProducts`
 * use elsewhere — those are admin-defined link sets where "not in the new list" means
 * "remove it"; this is a customer's profile being incrementally refined order-by-order,
 * where an order that omits a measurement must not be read as "delete this from the
 * customer's known profile."
 */
export const customerMeasurementProfileValues = pgTable("customer_measurement_profile_values", {
  ...idColumn,
  profileId: uuid("profile_id").notNull().references(() => customerMeasurementProfiles.id),
  measurementDefinitionId: uuid("measurement_definition_id").notNull().references(() => measurementDefinitions.id),
  value: numeric("value", { precision: 10, scale: 2 }),
  adjustmentValue: numeric("adjustment_value", { precision: 10, scale: 2 }),
  totalValue: numeric("total_value", { precision: 10, scale: 2 }),
}, (table) => ({
  profileMeasurementUnique: uniqueIndex("customer_measurement_profile_values_unique").on(
    table.profileId,
    table.measurementDefinitionId
  ),
}));

/**
 * A lightweight parent for bulk/group orders. Each customer's order is a normal `orders`
 * row with `groupId` set — deliberately NOT a parallel structure with its own nested
 * manufacturing shape, which is what made the legacy GroupOrder's factory-floor tracking
 * non-functional (see project memory / REWRITE_ARCHITECTURE.md §2).
 */
export const orderGroups = pgTable("order_groups", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  orderNumber: text("order_number").notNull(),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantOrderNumberUnique: uniqueIndex("order_groups_tenant_order_number_unique").on(
    table.tenantId,
    table.orderNumber
  ),
}));

export const orderTypeEnum = pgEnum("order_type", ["normal", "group"]);

/**
 * `status` is intentionally a plain text column, not a Postgres enum — order statuses
 * (New Order/Rush/Modified/Processing/Shipment/Sent today) are the kind of thing that
 * might grow per business need, and a plain column + application-layer (zod) validation
 * means adding one is not a schema migration. Contrast with manufacturingStepStatusEnum
 * in manufacturing.ts, which IS a hard enum because that set is fixed by the system, not
 * by tenant configuration.
 */
export const orders = pgTable("orders", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  groupId: uuid("group_id").references(() => orderGroups.id),
  orderNumber: text("order_number").notNull(),
  status: text("status").notNull().default("New Order"),
  type: orderTypeEnum("type").notNull().default("normal"),
  isRush: boolean("is_rush").notNull().default(false),
  isRepeat: boolean("is_repeat").notNull().default(false),
  repeatOfOrderId: uuid("repeat_of_order_id"),
  pdfPath: text("pdf_path"),
  orderDate: timestamp("order_date", { withTimezone: true }).notNull().defaultNow(),
  // Set by PHASE_10_TASKS.md Workstream E Group 6.2's edit surface whenever it actually
  // changes this order (item/component/status/retailer writes) — never touched by
  // creation. Feeds both the `"Modified"` status value and Workstream B's PDF banner.
  lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantOrderNumberUnique: uniqueIndex("orders_tenant_order_number_unique").on(
    table.tenantId,
    table.orderNumber
  ),
  // Feeds `orders.service.ts#resolveBaselineComponentId`'s "most recent prior order for this
  // customer" lookup (PHASE_10_TASKS.md follow-up) — keeps that a cheap indexed scan rather
  // than a sequential scan as a tenant's order history grows into the thousands.
  customerOrderDateIdx: index("orders_customer_id_order_date_idx").on(table.customerId, table.orderDate),
}));

/** One row per super-product instance ordered (e.g. "Suit #1", "Suit #2"). */
export const orderItems = pgTable("order_items", {
  ...idColumn,
  orderId: uuid("order_id").notNull().references(() => orders.id),
  superProductId: uuid("super_product_id").notNull().references(() => superProducts.id),
  sequence: integer("sequence").notNull(),
  ...timestampColumns,
});

/**
 * One row per physical piece within an order item (e.g. the jacket row, the pant row).
 * Replaces the legacy `"suit_jacket_0"` string-key hack in Order.manufacturing.
 */
export const orderItemComponents = pgTable("order_item_components", {
  ...idColumn,
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  slotLabel: text("slot_label").notNull(),
  // Two separate note fields, matching legacy's two separate ones (`Measurements.jsx`'s
  // per-line-item note vs. `MissingFabric.jsx`'s per-unit note) — PHASE_9_TASKS.md
  // Decision 5. `measurementNote` is entered once per line item and denormalized/copied
  // across sibling units exactly like the measurements it sits next to (Decision 3);
  // `stylingNote` is independent per unit.
  measurementNote: text("measurement_note"),
  stylingNote: text("styling_note"),
  // URL returned by PHASE_9_TASKS.md Group 1's upload endpoint. No FK — just a stored URL.
  referenceImage: text("reference_image"),
  // Rasterized, annotated Manual Size diagram (PHASE_10_TASKS.md Workstream E Group 6) —
  // shared per line item and denormalized into every sibling unit's own row identically,
  // same mechanism as `measurementNote` above, not the independent-per-unit
  // `referenceImage` pattern. URL only, uploaded through the existing generic
  // `POST /api/uploads` endpoint — no file handling here.
  manualSizeImage: text("manual_size_image"),
  /**
   * PHASE_10_TASKS.md follow-up ("changed from profile" fix): self-referencing pointer to
   * the customer's most recent PRIOR order's component for this same product (excluding
   * this order) — resolved once, when this component is first inserted (`orders.service.ts`'s
   * `resolveBaselineComponentId`), and never re-derived afterward, even when this component's
   * own order is later edited. `null` means either "this customer has never ordered this
   * product before" or "still resolving" is not a distinct state — a first-ever order and a
   * genuinely-absent baseline look identical, both `null`, which is the correct behavior.
   *
   * Deliberately NOT the same mechanism as `customer_measurement_profiles`
   * (`orders.ts` above) — that table answers "what should a brand-new order pre-fill with"
   * (always the customer's single latest known value, kept live-mutable on every write) and
   * this answers "what should THIS specific order's checkmark compare against" (a fixed,
   * per-order link to one specific earlier order, immune to newer sibling orders and to which
   * order is currently "most recent"). Conflating the two into one shared mutable record was
   * a real bug: editing an older order could silently overwrite the customer's newer profile
   * with stale data, and an editor's own indicator would drift depending on unrelated orders
   * placed in between. `changedFromProfile` (`order_item_component_measurements` below) is
   * recomputed on every write of this component (create or edit) against this pointer's
   * CURRENT measurement values — so if the baseline order itself is later edited, this
   * component's next write picks up the new value (by product decision, not frozen further).
   *
   * `onDelete: "set null"` — there's no order-deletion endpoint in this codebase today, but a
   * component this points at could still be removed by an edit that drops a line item/unit
   * (`deleteOrderItemComponent`); losing the specific comparison target then should just fall
   * back to "no baseline" (same as a genuine first order), not block the deletion outright.
   */
  baselineComponentId: uuid("baseline_component_id").references((): AnyPgColumn => orderItemComponents.id, { onDelete: "set null" }),
  ...timestampColumns,
});

export const orderItemComponentMeasurements = pgTable("order_item_component_measurements", {
  ...idColumn,
  orderItemComponentId: uuid("order_item_component_id").notNull().references(() => orderItemComponents.id),
  measurementDefinitionId: uuid("measurement_definition_id").notNull().references(() => measurementDefinitions.id),
  value: numeric("value", { precision: 10, scale: 2 }),
  adjustmentValue: numeric("adjustment_value", { precision: 10, scale: 2 }),
  totalValue: numeric("total_value", { precision: 10, scale: 2 }),
  // Recomputed on every write of this row's own component (create, or an edit that resends
  // this component) by comparing this measurement's total against the SAME measurement
  // definition's current total on `order_item_components.baseline_component_id` — the
  // customer's fixed, specific prior order for this product (see that column's own doc
  // comment for why it's not the shared `customer_measurement_profile_values` table).
  // `null` when `baseline_component_id` is itself `null` (no prior order for this product
  // exists at all) — otherwise a real `true`/`false`. A sibling order's own stored rows are
  // never touched by this order's writes; only this component's own rows are ever rewritten.
  changedFromProfile: boolean("changed_from_profile"),
}, (table) => ({
  componentMeasurementUnique: uniqueIndex("order_item_component_measurements_unique").on(
    table.orderItemComponentId,
    table.measurementDefinitionId
  ),
}));

/**
 * Replaces the legacy `stylesArray` blob. `styleId`/`styleOptionId` are used for
 * `choice`-type features, `textValue` for `text`-type (fabric/lining codes), and
 * `structuredValue` (jsonb) for `structured`-type (monogram: font/side/color/line2).
 */
export const orderItemComponentFeatures = pgTable("order_item_component_features", {
  ...idColumn,
  orderItemComponentId: uuid("order_item_component_id").notNull().references(() => orderItemComponents.id),
  featureId: uuid("feature_id").notNull().references(() => features.id),
  styleId: uuid("style_id").references(() => styles.id),
  styleOptionId: uuid("style_option_id").references(() => styleOptions.id),
  textValue: text("text_value"),
  structuredValue: jsonb("structured_value"),
}, (table) => ({
  componentFeatureUnique: uniqueIndex("order_item_component_features_unique").on(
    table.orderItemComponentId,
    table.featureId
  ),
}));
