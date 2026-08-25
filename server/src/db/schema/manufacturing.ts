import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, softDeleteColumn, timestampColumns } from "./_shared";
import { tenants, tailors } from "./tenancy";
import { products, features, styles, processes } from "./catalog";
import { orderItemComponents } from "./orders";

/**
 * Fixed by the system, not tenant-configurable — a hard enum, unlike order.status.
 * pending: not yet started. assigned: a tailor has claimed it. complete: done.
 */
export const manufacturingStepStatusEnum = pgEnum("manufacturing_step_status", [
  "pending",
  "assigned",
  "complete",
]);

/**
 * Which processes a tailor is certified for. Replaces the legacy `Tailor.process_id[]`
 * array. No `tenant_id` of its own — ownership is proven by resolving the tailor (same
 * pattern as `catalog-helpers.ts`'s `requireStyle`/`requireStyleOption`).
 */
export const tailorProcesses = pgTable("tailor_processes", {
  ...idColumn,
  tailorId: uuid("tailor_id").notNull().references(() => tailors.id),
  processId: uuid("process_id").notNull().references(() => processes.id),
}, (table) => ({
  tailorProcessUnique: uniqueIndex("tailor_processes_unique").on(table.tailorId, table.processId),
}));

/**
 * Replaces the legacy untyped `Order.manufacturing` blob. One row per (component,
 * process) pair, with an explicit `sequenceOrder` replacing the old "JS object key
 * insertion order" mechanism for determining which process comes next.
 */
export const manufacturingSteps = pgTable("manufacturing_steps", {
  ...idColumn,
  orderItemComponentId: uuid("order_item_component_id").notNull().references(() => orderItemComponents.id),
  processId: uuid("process_id").notNull().references(() => processes.id),
  sequenceOrder: integer("sequence_order").notNull(),
  status: manufacturingStepStatusEnum("status").notNull().default("pending"),
  tailorId: uuid("tailor_id").references(() => tailors.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestampColumns,
}, (table) => ({
  componentSequenceUnique: uniqueIndex("manufacturing_steps_sequence_unique").on(
    table.orderItemComponentId,
    table.sequenceOrder
  ),
}));

/**
 * A tailor's assignment for one manufacturing step. Points directly at the step's own
 * row instead of parsing an `item_code` string, unlike the legacy Jobs model.
 */
export const jobs = pgTable("jobs", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  manufacturingStepId: uuid("manufacturing_step_id").notNull().references(() => manufacturingSteps.id),
  tailorId: uuid("tailor_id").notNull().references(() => tailors.id),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  stylingPrice: numeric("styling_price", { precision: 12, scale: 2 }).notNull().default("0"),
  paid: boolean("paid").notNull().default(false),
  paidDate: timestamp("paid_date", { withTimezone: true }),
  ...timestampColumns,
});

/**
 * Admin-defined template: "if this style choice on this product occurs during this
 * process, pay this bonus." See FUNCTIONALITY_OVERVIEW.md's Extra Payments section for
 * the current (only half-enforced) behavior this schema is meant to make fully
 * enforceable in Phase 2's service layer.
 */
export const extraPaymentCategories = pgTable("extra_payment_categories", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  featureId: uuid("feature_id").references(() => features.id),
  styleId: uuid("style_id").references(() => styles.id),
  processId: uuid("process_id").notNull().references(() => processes.id),
  name: text("name").notNull(),
  thaiName: text("thai_name"),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  ...timestampColumns,
  ...softDeleteColumn,
});

/**
 * `approved` defaults to `false` unconditionally (PHASE_3_TASKS.md Group 5) — the legacy
 * system had two creation paths defaulting to different approval postures depending on
 * which admin screen created the record; this schema has exactly one creation path
 * (`extra-payments.service.ts#createExtraPayment`), so there's exactly one default, and
 * it's the conservative one. A separate `PATCH .../approve` call is required either way.
 * `extraPaymentJobCategoryUnique` prevents the same category being applied twice to the
 * same job (also enforced in the service, but a unique index closes the race window an
 * application-level `SELECT`-then-`INSERT` check can't).
 */
export const extraPayments = pgTable("extra_payments", {
  ...idColumn,
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  categoryId: uuid("category_id").notNull().references(() => extraPaymentCategories.id),
  tailorId: uuid("tailor_id").notNull().references(() => tailors.id),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  approved: boolean("approved").notNull().default(false),
  paid: boolean("paid").notNull().default(false),
  paidDate: timestamp("paid_date", { withTimezone: true }),
  description: text("description"),
  authorizedBy: text("authorized_by"),
  ...timestampColumns,
}, (table) => ({
  extraPaymentJobCategoryUnique: uniqueIndex("extra_payments_job_category_unique").on(table.jobId, table.categoryId),
}));

/**
 * `cleared` is a real, enforced flag here — unlike the legacy model, where it's dead.
 * `paymentSettlementId` links an advance directly to the settlement that deducted it —
 * auditable, no FIFO-matching logic needed later to figure out which advance a
 * settlement cleared. Forward reference to `paymentSettlements`, declared further down
 * in this file: safe because `.references()` takes a thunk, resolved lazily rather than
 * at `pgTable()` call time, so it isn't affected by the `const` declaration order.
 */
export const workerAdvancePayments = pgTable("worker_advance_payments", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  tailorId: uuid("tailor_id").notNull().references(() => tailors.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  cleared: boolean("cleared").notNull().default(false),
  clearedAt: timestamp("cleared_at", { withTimezone: true }),
  paymentSettlementId: uuid("payment_settlement_id").references(() => paymentSettlements.id),
  ...timestampColumns,
});

/**
 * A server-computed, immutable payroll settlement record — replaces the legacy pattern
 * of computing subTotal/totalPay client-side and trusting whatever the client posts.
 */
export const paymentSettlements = pgTable("payment_settlements", {
  ...idColumn,
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  tailorId: uuid("tailor_id").notNull().references(() => tailors.id),
  subTotal: numeric("sub_total", { precision: 12, scale: 2 }).notNull(),
  deductedAdvance: numeric("deducted_advance", { precision: 12, scale: 2 }).notNull().default("0"),
  rent: numeric("rent", { precision: 12, scale: 2 }).notNull().default("0"),
  manualBill: numeric("manual_bill", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPay: numeric("total_pay", { precision: 12, scale: 2 }).notNull(),
  ...timestampColumns,
});

export const paymentSettlementJobs = pgTable("payment_settlement_jobs", {
  ...idColumn,
  paymentSettlementId: uuid("payment_settlement_id").notNull().references(() => paymentSettlements.id),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
}, (table) => ({
  settlementJobUnique: uniqueIndex("payment_settlement_jobs_unique").on(
    table.paymentSettlementId,
    table.jobId
  ),
}));
