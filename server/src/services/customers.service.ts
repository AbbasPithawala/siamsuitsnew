import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { customers } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

/** `retailers` carries `tenant_id` and an RLS policy, so resolving it through a `withTenant`-scoped `tx` already proves tenant ownership — see `catalog-helpers.ts` for the same pattern applied to catalog tables. */
export async function requireRetailer(tx: Transaction, retailerId: string) {
  const retailer = await tx.query.retailers.findFirst({
    where: (r, { and, eq, isNull }) => and(eq(r.id, retailerId), isNull(r.deletedAt)),
  });
  if (!retailer) throw new HttpError(404, "RETAILER_NOT_FOUND", `Retailer ${retailerId} not found`);
  return retailer;
}

/**
 * `retailerId`, when given, is embedded directly in the query's own `WHERE` (not a
 * fetch-then-check) — a customer belonging to another retailer is genuinely never
 * fetched, so it 404s exactly like a nonexistent id, mirroring how tenant isolation
 * already works via `withTenant`'s RLS. Callers that aren't actor-driven (e.g. resolving
 * a customer during order creation) simply omit it.
 */
export async function requireCustomer(tx: Transaction, customerId: string, retailerId?: string | null) {
  const customer = await tx.query.customers.findFirst({
    where: (c, { and, eq, isNull }) =>
      and(eq(c.id, customerId), isNull(c.deletedAt), retailerId ? eq(c.retailerId, retailerId) : undefined),
  });
  if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", `Customer ${customerId} not found`);
  return customer;
}

export interface CreateCustomerInput {
  retailerId: string;
  firstName: string;
  lastName?: string;
  gender?: string;
  contactNumber?: string;
  image?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export function createCustomer(tenantId: string, input: CreateCustomerInput) {
  return withTenant(tenantId, async (tx) => {
    await requireRetailer(tx, input.retailerId);
    const [customer] = await tx.insert(customers).values({ tenantId, ...input }).returning();
    return customer;
  });
}

/**
 * `actorRetailerId`, when non-null (a retailer-linked session), forces the effective
 * `retailerId` filter to the actor's own id, ignoring whatever the client passed in
 * `filter.retailerId` — PHASE_10_TASKS.md Workstream E Decision 3. `null`/`undefined`
 * (staff/admin) behaves exactly as before: the client-supplied filter, or none.
 */
export function listCustomers(
  tenantId: string,
  filter: { retailerId?: string | undefined } = {},
  pagination: PaginationParams = DEFAULT_PAGINATION,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const retailerId = actorRetailerId ?? filter.retailerId;
    if (retailerId) await requireRetailer(tx, retailerId);

    const where = retailerId
      ? and(isNull(customers.deletedAt), eq(customers.retailerId, retailerId))
      : isNull(customers.deletedAt);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.customers.findMany({ where, orderBy: (c, { asc }) => asc(c.firstName), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(customers).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

export async function getCustomer(tenantId: string, id: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, (tx) => requireCustomer(tx, id, actorRetailerId));
}

export async function updateCustomer(tenantId: string, id: string, input: UpdateCustomerInput, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    await requireCustomer(tx, id, actorRetailerId);

    if (input.retailerId) await requireRetailer(tx, input.retailerId);

    const [updated] = await tx
      .update(customers)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  });
}

export async function softDeleteCustomer(tenantId: string, id: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    await requireCustomer(tx, id, actorRetailerId);

    await tx.update(customers).set({ deletedAt: new Date() }).where(eq(customers.id, id));
  });
}
