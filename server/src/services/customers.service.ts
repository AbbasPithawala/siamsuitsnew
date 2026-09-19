import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { customers } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { toLimitOffset } from "../utils/pagination";
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
  email?: string;
  contactNumber?: string;
  image?: string;
  imageNote?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

/**
 * `actorRetailerId`, when non-null (a retailer-linked session), forces the effective
 * `retailerId` to the actor's own id, ignoring whatever the client passed in
 * `input.retailerId` — a retailer can only ever create customers for itself. Same override
 * rule as `listCustomers`'s `actorRetailerId`, just applied to a write instead of a filter.
 */
export function createCustomer(tenantId: string, input: CreateCustomerInput, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const retailerId = actorRetailerId ?? input.retailerId;
    await requireRetailer(tx, retailerId);
    const [customer] = await tx.insert(customers).values({ tenantId, ...input, retailerId }).returning();
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
  filter?: { retailerId?: string | undefined },
  pagination?: undefined,
  actorRetailerId?: string | null
): Promise<(typeof customers.$inferSelect)[]>;
export function listCustomers(
  tenantId: string,
  filter: { retailerId?: string | undefined } | undefined,
  pagination: PaginationParams,
  actorRetailerId?: string | null
): Promise<{ data: (typeof customers.$inferSelect)[]; total: number }>;
export function listCustomers(
  tenantId: string,
  filter: { retailerId?: string | undefined } = {},
  pagination?: PaginationParams,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const retailerId = actorRetailerId ?? filter.retailerId;
    if (retailerId) await requireRetailer(tx, retailerId);

    const where = retailerId
      ? and(isNull(customers.deletedAt), eq(customers.retailerId, retailerId))
      : isNull(customers.deletedAt);

    if (!pagination) {
      return tx.query.customers.findMany({ where, orderBy: (c, { asc }) => asc(c.firstName) });
    }

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

/** Same override as `createCustomer`: a retailer-linked actor can't reassign its own customer to another retailer, so `input.retailerId` is forced back to `actorRetailerId` whenever the actor is retailer-linked. */
export async function updateCustomer(tenantId: string, id: string, input: UpdateCustomerInput, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    await requireCustomer(tx, id, actorRetailerId);

    const nextInput = actorRetailerId ? { ...input, retailerId: actorRetailerId } : input;
    if (nextInput.retailerId) await requireRetailer(tx, nextInput.retailerId);

    const [updated] = await tx
      .update(customers)
      .set({ ...nextInput, updatedAt: new Date() })
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
