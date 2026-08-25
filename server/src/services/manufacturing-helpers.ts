import type { Transaction } from "../db/withTenant";
import { HttpError } from "../utils/http-error";

/**
 * `tailors` carries `tenant_id` and an RLS policy (see
 * `0001_enable_row_level_security.sql`), so a `tx.query.tailors.findFirst` scoped by
 * `withTenant` already can't see another tenant's row. `tailor_processes` is a pure join
 * table with no `tenant_id` of its own — ownership is proven by resolving the tailor it
 * points at, the same pattern `catalog-helpers.ts` uses for `styles`/`style_options`.
 */
export async function requireTailor(tx: Transaction, tailorId: string) {
  const tailor = await tx.query.tailors.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.id, tailorId), isNull(t.deletedAt)),
  });
  if (!tailor) throw new HttpError(404, "TAILOR_NOT_FOUND", `Tailor ${tailorId} not found`);
  return tailor;
}
