// @ts-nocheck -- Node-only DB verification helper for a live integration test,
// same rationale as `orders/testSupport/orderDbCleanup.ts`: this needs
// `node:fs`/`postgres` to query `siam/server`'s own Postgres directly, which
// the browser-scoped tsconfig (src/**, DOM lib only, no @types/node) can't
// type-check. Vitest/Vite still execute this as plain JS at runtime
// regardless; only `tsc -b` skips it.
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
 * `CustomersPage.live.test.tsx`'s own cleanup soft-deletes its fixtures
 * through the real `DELETE /customers/:id` endpoint (there is no hard
 * delete). Per this project's standing rule — established after a shared
 * dev-database cross-test pollution incident where duplicate, un-cleaned
 * fixture rows broke unrelated tests via ambiguous `getByText` matches —
 * cleanup must be confirmed with a direct DB query, not just a
 * successful-looking API response. This counts fixture rows that are still
 * *active* (`deleted_at is null`), i.e. would still show up in
 * `customers.service.ts`'s `listCustomers`/`getCustomer` and therefore still
 * risk polluting another test's UI query; it should be 0 after cleanup.
 */
export async function countActiveCustomersByIds(ids) {
  if (ids.length === 0) return 0;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select count(*)::int as count from customers where id in ${sql(ids)} and deleted_at is null`;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await sql.end();
  }
}

/** Same verification, for the throwaway retailer fixture this test file creates to scope its customers under. */
export async function countActiveRetailersByIds(ids) {
  if (ids.length === 0) return 0;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select count(*)::int as count from retailers where id in ${sql(ids)} and deleted_at is null`;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await sql.end();
  }
}
