// @ts-nocheck -- Node-only DB cleanup/verification helper for a live
// integration test, same rationale as `orders/testSupport/orderDbCleanup.ts`:
// this needs `node:fs`/`postgres`, which the browser-scoped tsconfig can't
// type-check. Vitest/Vite still execute this as plain JS at runtime; only
// `tsc -b` skips it.
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
 * `jobs.manufacturing_step_id` and `extra_payments.job_id` both lack
 * `ON DELETE CASCADE` (`server/src/db/schema/manufacturing.ts`), so a job or
 * extra payment this test's real `assignNextStep`/`createExtraPayment` calls
 * create must be deleted before `orderDbCleanup.ts`'s `hardDeleteOrders` can
 * delete the parent `manufacturing_steps`/`orders` rows — otherwise that
 * delete fails on the foreign key. No live test before this one
 * (PHASE_6_TASKS.md Group 7) ever drove a real assign/complete flow through
 * the UI, so this gap in `orderDbCleanup.ts` never mattered until now.
 */
export async function deleteJobsAndExtraPayments(componentIds: string[]): Promise<void> {
  if (componentIds.length === 0) return;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const stepRows = await sql`select id from manufacturing_steps where order_item_component_id in ${sql(componentIds)}`;
    const stepIds = stepRows.map((row) => row.id);
    if (stepIds.length === 0) return;

    const jobRows = await sql`select id from jobs where manufacturing_step_id in ${sql(stepIds)}`;
    const jobIds = jobRows.map((row) => row.id);
    if (jobIds.length === 0) return;

    await sql`delete from extra_payments where job_id in ${sql(jobIds)}`;
    await sql`delete from jobs where id in ${sql(jobIds)}`;
  } finally {
    await sql.end();
  }
}

/** Used to prove `createExtraPayment` actually landed a real row, not just that the UI showed a success message. */
export async function findExtraPaymentsForCategory(categoryId: string): Promise<{ cost: string; approved: boolean }[]> {
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select cost, approved from extra_payments where category_id = ${categoryId}`;
    return rows.map((row) => ({ cost: row.cost, approved: row.approved }));
  } finally {
    await sql.end();
  }
}
