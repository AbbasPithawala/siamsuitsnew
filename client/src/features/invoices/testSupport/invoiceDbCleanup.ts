// @ts-nocheck -- Node-only DB cleanup helper for a live integration test,
// same rationale as `payroll/testSupport/payrollDbCleanup.ts`: needs
// `node:fs`/`postgres`, which the browser-scoped tsconfig can't type-check.
// Vitest/Vite still execute this as plain JS at runtime; only `tsc -b` skips
// it.
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadServerDatabaseUrl() {
  const envPath = path.resolve(process.cwd(), "../server/.env");
  const contents = readFileSync(envPath, "utf-8");
  const match = contents.match(/^DATABASE_URL=(.+)$/m);
  if (!match) {
    throw new Error(`DATABASE_URL not found in ${envPath}`);
  }
  return match[1].trim();
}

/**
 * `invoices.routes.ts` has no DELETE endpoint (`retailer_invoices` has a
 * `deletedAt` column in the schema but nothing writes to it yet — invoices
 * are only ever created and status-transitioned, not soft-deleted, per
 * PHASE_6_TASKS.md Group 1's scope). Nothing else references
 * `retailer_invoices.id` as a foreign key, so a plain hard delete by id is
 * sufficient here, unlike `payrollDbCleanup.ts`'s multi-table FK walk.
 */
export async function hardDeleteInvoices(invoiceIds: string[]): Promise<void> {
  if (invoiceIds.length === 0) return;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    await sql`delete from retailer_invoices where id in ${sql(invoiceIds)}`;
  } finally {
    await sql.end();
  }
}

export async function countInvoicesByIds(invoiceIds: string[]): Promise<number> {
  if (invoiceIds.length === 0) return 0;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select id from retailer_invoices where id in ${sql(invoiceIds)}`;
    return rows.length;
  } finally {
    await sql.end();
  }
}
