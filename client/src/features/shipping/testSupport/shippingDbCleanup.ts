// @ts-nocheck -- Node-only DB cleanup/verification helper for a live
// integration test, same rationale as `invoices/testSupport/invoiceDbCleanup.ts`:
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
 * Neither `shipping_boxes` nor `shipping_box_items` has a `deletedAt`
 * column (`server/src/db/schema/invoicing.ts`) and `shipping.routes.ts` has
 * no DELETE endpoint for a box itself (only for a packed item, and only
 * while the box is still open) — so, same as `invoiceDbCleanup.ts`, a live
 * test's box fixtures need a plain hard delete rather than a soft-delete API
 * call. Items are deleted first since `shipping_box_items.shipping_box_id`
 * has no `ON DELETE CASCADE`.
 */
export async function hardDeleteShippingBoxes(boxIds: string[]): Promise<void> {
  if (boxIds.length === 0) return;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    await sql`delete from shipping_box_items where shipping_box_id in ${sql(boxIds)}`;
    await sql`delete from shipping_boxes where id in ${sql(boxIds)}`;
  } finally {
    await sql.end();
  }
}

export async function countShippingBoxesByIds(boxIds: string[]): Promise<number> {
  if (boxIds.length === 0) return 0;
  const sql = postgres(loadServerDatabaseUrl());
  try {
    const rows = await sql`select id from shipping_boxes where id in ${sql(boxIds)}`;
    return rows.length;
  } finally {
    await sql.end();
  }
}
