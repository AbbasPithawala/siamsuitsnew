import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Conventions (see PHASE_1_TASKS.md Group 0):
 * - UUID primary keys everywhere.
 * - created_at/updated_at on every table.
 * - deleted_at soft-delete on tenant-facing business entities only (not pure join tables).
 *
 * `legacy_mongo_id` existed here temporarily as an ETL traceability aid and was dropped
 * once the Phase 2 catalog ETL was verified (see the `drop_legacy_mongo_id` migration) —
 * this rewrite doesn't carry forward legacy Mongo IDs as a permanent concept.
 */

export const idColumn = {
  id: uuid("id").primaryKey().defaultRandom(),
};

export const timestampColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const softDeleteColumn = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
