import { boolean, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  ...timestampColumns,
});

export const orderItemComponentMeasurements = pgTable("order_item_component_measurements", {
  ...idColumn,
  orderItemComponentId: uuid("order_item_component_id").notNull().references(() => orderItemComponents.id),
  measurementDefinitionId: uuid("measurement_definition_id").notNull().references(() => measurementDefinitions.id),
  value: numeric("value", { precision: 10, scale: 2 }),
  adjustmentValue: numeric("adjustment_value", { precision: 10, scale: 2 }),
  totalValue: numeric("total_value", { precision: 10, scale: 2 }),
  // Set once, at insert time, by comparing against the customer's `customer_measurement_
  // profile_values` row for this measurement definition *before* that profile row gets
  // overwritten by this same order's write (PHASE_10_TASKS.md Workstream D Decision 2 /
  // Workstream B Group 1) — null when no prior profile value existed to compare against,
  // never recomputed afterward, so a later profile edit never retroactively changes an
  // already-placed order's own stored rows.
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
