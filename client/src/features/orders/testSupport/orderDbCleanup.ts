// @ts-nocheck -- Node-only DB cleanup helper for a live integration test,
// same rationale as `src/routes/testSupport/permissionFixtures.ts`: this
// file needs `node:fs`/`postgres` to hard-delete order fixtures, which the
// browser-scoped tsconfig (src/**, DOM lib only, no @types/node) can't
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
 * `server/src/routes/orders.routes.ts` exposes only `GET`/`POST` — there is
 * no delete (soft or hard) endpoint for orders anywhere in this rewrite yet.
 * So orders created by `OrderBuilderPage.live.test.tsx`'s real wizard
 * submissions can't be cleaned up through the API the way every other live
 * test's fixtures are (retailers/super-products/customers all have a real
 * `DELETE`). This connects directly to `siam/server`'s own Postgres (same
 * superuser-bypasses-RLS assumption `permissionFixtures.ts` relies on) and
 * deletes the child rows before the parents, since none of these foreign
 * keys are declared `ON DELETE CASCADE`
 * (`server/src/db/schema/orders.ts`/`manufacturing.ts`).
 */
export async function hardDeleteOrders(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const componentRows = await sql`
      select oic.id from order_item_components oic
      join order_items oi on oi.id = oic.order_item_id
      where oi.order_id in ${sql(orderIds)}
    `;
    const componentIds = componentRows.map((row) => row.id);
    if (componentIds.length > 0) {
      await sql`delete from manufacturing_steps where order_item_component_id in ${sql(componentIds)}`;
      await sql`delete from order_item_component_measurements where order_item_component_id in ${sql(componentIds)}`;
      await sql`delete from order_item_component_features where order_item_component_id in ${sql(componentIds)}`;
      await sql`delete from order_item_components where id in ${sql(componentIds)}`;
    }
    await sql`delete from order_items where order_id in ${sql(orderIds)}`;
    await sql`delete from orders where id in ${sql(orderIds)}`;
  } finally {
    await sql.end();
  }
}

/** Used by the cleanup-verification assertion at the end of the test file — confirms the hard delete above actually took, rather than trusting its lack of a thrown error. */
export async function countOrdersByIds(orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select count(*)::int as count from orders where id in ${sql(orderIds)}`;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await sql.end();
  }
}

/**
 * Sibling to `hardDeleteOrders` for `order_groups` fixtures — same "no DELETE endpoint
 * anywhere in this rewrite" rationale (`server/src/routes/order-groups.routes.ts` exposes
 * only `GET`/`GET :id`/`POST`). Callers MUST hard-delete every one of a group's own child
 * `orders` rows (via `hardDeleteOrders`) BEFORE calling this — `orders.group_id` references
 * `order_groups.id` with no `ON DELETE CASCADE`, so deleting the group row first would fail
 * a foreign key check while any child order still points at it.
 */
export async function hardDeleteOrderGroups(groupIds: string[]): Promise<void> {
  if (groupIds.length === 0) return;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    await sql`delete from order_groups where id in ${sql(groupIds)}`;
  } finally {
    await sql.end();
  }
}

/** Used by the cleanup-verification assertion at the end of the test file — confirms the hard delete above actually took. */
export async function countOrderGroupsByIds(groupIds: string[]): Promise<number> {
  if (groupIds.length === 0) return 0;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select count(*)::int as count from order_groups where id in ${sql(groupIds)}`;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await sql.end();
  }
}
