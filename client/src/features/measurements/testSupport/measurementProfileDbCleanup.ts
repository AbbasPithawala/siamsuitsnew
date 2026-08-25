// @ts-nocheck -- Node-only DB cleanup helper for a live integration test, same
// rationale as `orders/testSupport/orderDbCleanup.ts`: this needs `node:fs`/
// `postgres` to hard-delete profile fixtures, which the browser-scoped
// tsconfig (src/**, DOM lib only, no @types/node) can't type-check. Vitest/
// Vite still execute this as plain JS at runtime regardless; only `tsc -b`
// skips it.
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
 * `customer_measurement_profiles`/`customer_measurement_profile_values`
 * (PHASE_10_TASKS.md Workstream D Group 0) have no `DELETE` route at all —
 * they're only ever written as a side effect of `POST /orders`
 * (`measurementProfiles.routes.ts`'s own doc comment) — so a live test that
 * creates a real profile fixture via a real order submission has no API path
 * to clean it up through. Soft-deleting the customer/retailer/order fixtures
 * that produced it (every other live test's convention) leaves these two
 * tables' rows behind regardless, since neither has a `deleted_at` of its
 * own that any soft-delete path touches. Same direct-Postgres approach as
 * `orderDbCleanup.ts#hardDeleteOrders`.
 */
export async function hardDeleteCustomerMeasurementProfiles(customerIds: string[]): Promise<void> {
  if (customerIds.length === 0) return;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    await sql`
      delete from customer_measurement_profile_values
      where profile_id in (select id from customer_measurement_profiles where customer_id in ${sql(customerIds)})
    `;
    await sql`delete from customer_measurement_profiles where customer_id in ${sql(customerIds)}`;
  } finally {
    await sql.end();
  }
}
