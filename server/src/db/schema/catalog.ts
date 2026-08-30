import { boolean, integer, numeric, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, softDeleteColumn, timestampColumns } from "./_shared";
import { tenants } from "./tenancy";

/** An atomic garment: Jacket, Pant, Tuxedo Jacket, Shirt, Overcoat, etc. */
export const products = pgTable("products", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  description: text("description"),
  image: text("image"),
  // Per-product static line-drawing diagram (e.g. a jacket outline), admin-set via
  // ProductsPage.tsx, distinct from `image`. Rendered by the generic Manual Size
  // annotation editor (PHASE_10_TASKS.md Workstream E Group 6.3) — replaces legacy's
  // hardcoded per-product-name image imports.
  measurementDiagramImage: text("measurement_diagram_image"),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantNameUnique: uniqueIndex("products_tenant_name_unique").on(table.tenantId, table.name),
}));

/**
 * A named, admin-defined bundle of products (e.g. "Suit", "Tuxedo", or any future
 * combination). This is the fix for the hardcoded suit/tuxedo `if/else` found in the
 * legacy `routes.order.js` — see REWRITE_ARCHITECTURE.md §2.
 */
export const superProducts = pgTable("super_products", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  image: text("image"),
  /**
   * Set only for the 1-component super product `products.service.ts`
   * auto-creates alongside every standalone product, so it can be found and
   * kept in sync (renamed on product rename, soft-deleted on product
   * soft-delete) without guessing by name. Null for every admin-curated
   * bundle (Suit, Tuxedo, ...) and for any super product an admin builds by
   * hand — those aren't tied to a single product's lifecycle. Deliberately
   * NOT surfaced anywhere in the UI as a distinct "auto" vs. "manual"
   * category — a super product is a super product regardless of how it was
   * created.
   */
  sourceProductId: uuid("source_product_id").references(() => products.id),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantNameUnique: uniqueIndex("super_products_tenant_name_unique").on(table.tenantId, table.name),
  sourceProductUnique: uniqueIndex("super_products_source_product_unique").on(table.sourceProductId),
}));

/**
 * Which products make up a super product. Max 3 rows per super_product_id — enforced in
 * the service layer (Phase 2), not the DB, per PHASE_1_TASKS.md Group 3.
 */
export const superProductComponents = pgTable("super_product_components", {
  ...idColumn,
  superProductId: uuid("super_product_id").notNull().references(() => superProducts.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  slotLabel: text("slot_label").notNull(),
  sequence: integer("sequence").notNull(),
}, (table) => ({
  superProductSequenceUnique: uniqueIndex("super_product_components_sequence_unique").on(
    table.superProductId,
    table.sequence
  ),
}));

/** A manufacturing step: cutting, stitching, pressing, button work, etc. */
export const processes = pgTable("processes", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantNameUnique: uniqueIndex("processes_tenant_name_unique").on(table.tenantId, table.name),
}));

/** Which processes a product goes through, in what order. Replaces string-matching. */
export const productProcesses = pgTable("product_processes", {
  ...idColumn,
  productId: uuid("product_id").notNull().references(() => products.id),
  processId: uuid("process_id").notNull().references(() => processes.id),
  sequenceOrder: integer("sequence_order").notNull(),
}, (table) => ({
  productSequenceUnique: uniqueIndex("product_processes_sequence_unique").on(
    table.productId,
    table.sequenceOrder
  ),
}));

export const measurementDefinitions = pgTable("measurement_definitions", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  slug: text("slug").notNull(),
  ...timestampColumns,
  ...softDeleteColumn,
}, (table) => ({
  tenantSlugUnique: uniqueIndex("measurement_definitions_tenant_slug_unique").on(
    table.tenantId,
    table.slug
  ),
}));

export const productMeasurements = pgTable("product_measurements", {
  ...idColumn,
  productId: uuid("product_id").notNull().references(() => products.id),
  measurementDefinitionId: uuid("measurement_definition_id").notNull().references(() => measurementDefinitions.id),
  // Admin-configurable display/entry order for this product (PHASE_8_TASKS.md Group 1) —
  // set as a full-replace array index by `setProductMeasurements`, consumed by
  // `getProductMeasurements`'s `ORDER BY` and, in turn, by the real order-taking
  // measurement form.
  sequenceOrder: integer("sequence_order").notNull().default(0),
}, (table) => ({
  productMeasurementUnique: uniqueIndex("product_measurements_unique").on(
    table.productId,
    table.measurementDefinitionId
  ),
}));

/**
 * `choice`     — pick one of N styled options (lapel, pocket, vent, piping...).
 * `text`       — free-text/code value (fabric code, lining code).
 * `structured` — a small typed payload (monogram: font/side/color/line 2), stored as
 *                jsonb on order_item_component_features.structured_value.
 */
export const featureTypeEnum = pgEnum("feature_type", ["choice", "text", "structured"]);

/**
 * `shoulder_type`/`monogram_position` — a small, closed, system-defined set of "well-known
 * roles" a feature can be assigned to (PHASE_9_TASKS.md Decision 4), same reasoning as
 * `manufacturingStepStatusEnum` in manufacturing.ts: fixed by the system, not by tenant
 * configuration, so a hard enum rather than free text.
 *
 * `piping` — legacy never modeled Piping as a `Feature`/`Style` pair at all; it was its own
 * Mongo collection, rendered as an always-visible scrollable swatch grid (verified in
 * `MissingFabric.jsx` — same `colored-style-boX` CSS class Monogram Color uses), never as a
 * tab in the `Styles`/`AdditionalStyles` picker. The Phase 7 ETL folded it into an ordinary
 * `type: "choice"` feature row, which made the order builder route it into the generic tabbed
 * style picker (`ChoiceTabBar`) — visually wrong relative to legacy. This slot value tells
 * `FeatureSelector.tsx` to render it in its own inline swatch-grid section instead.
 */
export const featureRenderSlotEnum = pgEnum("feature_render_slot", ["shoulder_type", "monogram_position", "piping"]);

/**
 * One unified model for every customizable garment attribute — lapel, pocket, fabric,
 * lining, monogram, piping — replacing the four different ad hoc mechanisms found in the
 * legacy code (see REWRITE_ARCHITECTURE.md §2).
 */
export const features = pgTable("features", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  type: featureTypeEnum("type").notNull(),
  processId: uuid("process_id").references(() => processes.id),
  // Which legacy screen/section a `choice` feature shows under (the real legacy Mongoose
  // `Feature` model's `additional: Boolean` — belongs here, not on `styles`; corrects/
  // completes PHASE_8_TASKS.md Group 2's original item, see PHASE_9_TASKS.md Group 0).
  isAdditional: boolean("is_additional").notNull().default(false),
  // Whether the order-builder's completion gate demands a value before an order can be
  // placed. Needed once fabric/lining/piping/monogram became ordinary `features` rows too
  // — `type` alone can't distinguish "always-optional bespoke field" from "required style
  // choice" (piping is `type: choice`, same as a required lapel/pocket feature, but must
  // stay optional). See PHASE_9_TASKS.md Decision 4/Group 0.
  isRequired: boolean("is_required").notNull().default(true),
  // Fixes this feature's rendering to a legacy-matching named location (Shoulder Type on
  // the Measurements screen, Monogram Position nested inside the Monogram block) instead
  // of the default styling tab bar. See PHASE_9_TASKS.md Decision 4.
  renderSlot: featureRenderSlotEnum("render_slot"),
  ...timestampColumns,
  ...softDeleteColumn,
});
// Deliberately no unique constraint on (tenantId, name): unlike products/processes/
// super_products, the same feature name (e.g. "front button") legitimately recurs across
// different products — the Phase 2 ETL explicitly chose not to collapse same-named
// features into one row (see project memory), so 4+ real "front button" rows already
// coexist for one tenant. See features.service.ts's createFeature/updateFeature for the
// corresponding fix (no longer claims FEATURE_NAME_TAKEN semantics that don't apply here).

/**
 * Many-to-many: which products a feature applies to. Replaces the legacy Feature model's
 * single `product_id` string field, which forced one Feature record per product with no
 * sharing — this is what lets Piping/Lining/Monogram genuinely apply to "various, not
 * all" products.
 */
export const featureProducts = pgTable("feature_products", {
  ...idColumn,
  featureId: uuid("feature_id").notNull().references(() => features.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  // Same per-product ordering concept as `product_measurements.sequence_order` — set by
  // `setProductFeatures` (product-side full-replace), consumed by `listFeatures` when
  // filtered to a product.
  sequenceOrder: integer("sequence_order").notNull().default(0),
}, (table) => ({
  featureProductUnique: uniqueIndex("feature_products_unique").on(table.featureId, table.productId),
}));

/** A selectable style under a `choice`-type feature. */
export const styles = pgTable("styles", {
  ...idColumn,
  featureId: uuid("feature_id").notNull().references(() => features.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  image: text("image"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  workerPrice: numeric("worker_price", { precision: 12, scale: 2 }).notNull().default("0"),
  ...timestampColumns,
  ...softDeleteColumn,
});

/** A sub-option under a style, where one exists (mirrors the legacy `style_options[]`). */
export const styleOptions = pgTable("style_options", {
  ...idColumn,
  styleId: uuid("style_id").notNull().references(() => styles.id),
  name: text("name").notNull(),
  image: text("image"),
  ...timestampColumns,
  ...softDeleteColumn,
});

/**
 * A named, per-product preset fit (e.g. "Slim," "Regular") — mirrors legacy
 * `ManageMeasurementFits.jsx`. Its own `tenant_id`/RLS policy (unlike
 * `product_measurements`) because, unlike a pure join row, this is itself the
 * admin-managed business entity the matrix editor operates on.
 */
export const productFittings = pgTable("product_fittings", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  ...timestampColumns,
  ...softDeleteColumn,
});

/**
 * One row per (fitting, measurement) pair: the fitting's preset adjustment for that
 * measurement. Consumed downstream as a pre-filled `adjustmentValue`, never as the
 * customer's actual measurement — a fit is an adjustment preset, not a body measurement.
 * No `tenant_id`/RLS of its own, scoped transitively through `product_fittings`, same as
 * `product_measurements`.
 */
export const fittingValues = pgTable("fitting_values", {
  ...idColumn,
  productFittingId: uuid("product_fitting_id").notNull().references(() => productFittings.id),
  measurementDefinitionId: uuid("measurement_definition_id").notNull().references(() => measurementDefinitions.id),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
}, (table) => ({
  fittingValueUnique: uniqueIndex("fitting_values_unique").on(table.productFittingId, table.measurementDefinitionId),
}));
