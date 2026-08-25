// @ts-nocheck -- Node-only DB cleanup helper for a live integration test,
// same rationale as `manufacturing/testSupport/manufacturingDbCleanup.ts`:
// needs `node:fs`/`postgres`, which the browser-scoped tsconfig can't
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
 * `PayrollSettlementPage.live.test.tsx` drives a real settlement through the
 * UI, which creates `payment_settlements`/`payment_settlement_jobs` rows and
 * flips `worker_advance_payments.cleared` — none of which
 * `orderDbCleanup.ts`'s `hardDeleteOrders` (built for Group 6/7, before this
 * group's settlement flow existed) knows how to remove, and none of these
 * foreign keys cascade (`server/src/db/schema/manufacturing.ts`). Deletes in
 * FK-safe order: `extra_payments`/`payment_settlement_jobs` first (both
 * reference `jobs`), then `worker_advance_payments`/`payment_settlements`
 * (the former references the latter), then `jobs` itself — leaving
 * `manufacturing_steps`/`order_item_components`/orders for
 * `hardDeleteOrders` to remove as before.
 */
export async function deleteSettlementFixtures(componentIds: string[], tailorId: string): Promise<void> {
  const sql = postgres(loadServerDatabaseUrl());
  try {
    let jobIds: string[] = [];
    if (componentIds.length > 0) {
      const stepRows = await sql`select id from manufacturing_steps where order_item_component_id in ${sql(componentIds)}`;
      const stepIds = stepRows.map((row) => row.id);
      if (stepIds.length > 0) {
        const jobRows = await sql`select id from jobs where manufacturing_step_id in ${sql(stepIds)}`;
        jobIds = jobRows.map((row) => row.id);
      }
    }

    if (jobIds.length > 0) {
      await sql`delete from extra_payments where job_id in ${sql(jobIds)}`;
      await sql`delete from payment_settlement_jobs where job_id in ${sql(jobIds)}`;
    }

    await sql`delete from worker_advance_payments where tailor_id = ${tailorId}`;
    await sql`delete from payment_settlements where tailor_id = ${tailorId}`;

    if (jobIds.length > 0) {
      await sql`delete from jobs where id in ${sql(jobIds)}`;
    }
  } finally {
    await sql.end();
  }
}
