import { sql } from "drizzle-orm";
import { db, type Database } from "./index";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Runs `callback` inside a transaction scoped to `tenantId`: every tenant-owned table
 * has an RLS policy keyed off the `app.tenant_id` session setting (see the
 * `enable_row_level_security` migration), so any query the callback runs through `tx`
 * only sees that tenant's rows — even if the query itself forgets a `WHERE tenant_id =`.
 *
 * Also drops the transaction into the `siam_tenant_scoped` role via `SET LOCAL ROLE`.
 * This matters because the pooled connection (`DATABASE_URL`) authenticates as a
 * Postgres superuser in every environment set up so far, and superusers unconditionally
 * bypass RLS — the policy would be silently inert without this. `siam_tenant_scoped` is
 * a NOLOGIN role created by that same migration purely so a superuser can assume it for
 * the duration of a transaction; nothing ever connects as it directly.
 *
 * `set_config`, not string-interpolated `SET LOCAL`, because `SET LOCAL app.tenant_id =
 * '...'` has no parameterized form — `set_config('app.tenant_id', $1, true)` does, so the
 * driver binds `tenantId` as a real parameter instead of it being spliced into SQL text.
 */
export async function withTenant<T>(tenantId: string, callback: (tx: Transaction) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`withTenant: "${tenantId}" is not a valid tenant id`);
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role siam_tenant_scoped`);
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return callback(tx);
  });
}
