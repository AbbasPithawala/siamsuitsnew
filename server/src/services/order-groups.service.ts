import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { orderGroups, orders } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireRetailer } from "./customers.service";
import { buildOrder, assembleOrderDetail, isUniqueConstraintConflict, ORDER_NUMBER_CONSTRAINT } from "./orders.service";
import type { CreateOrderItemInput } from "./orders.service";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

const GROUP_ORDER_NUMBER_CONSTRAINT = "order_groups_tenant_order_number_unique";

export interface CreateOrderGroupOrderInput {
  customerId: string;
  items?: CreateOrderItemInput[];
}

export interface CreateOrderGroupInput {
  retailerId: string;
  orders: CreateOrderGroupOrderInput[];
}

function isOrderNumberConflict(err: unknown): boolean {
  return isUniqueConstraintConflict(err, GROUP_ORDER_NUMBER_CONSTRAINT) || isUniqueConstraintConflict(err, ORDER_NUMBER_CONSTRAINT);
}

/**
 * `actorRetailerId`, when non-null, embeds the row-level isolation check directly in the
 * lookup `WHERE` — a cross-retailer fetch 404s exactly like `requireOrder`/`requireCustomer`
 * elsewhere (Workstream E Group 2's established pattern), not a fetch-then-403.
 */
export async function requireOrderGroup(tx: Transaction, id: string, actorRetailerId?: string | null) {
  const group = await tx.query.orderGroups.findFirst({
    where: (g, { and: andOp, eq: eqOp, isNull: isNullOp }) =>
      andOp(eqOp(g.id, id), isNullOp(g.deletedAt), actorRetailerId ? eqOp(g.retailerId, actorRetailerId) : undefined),
  });
  if (!group) throw new HttpError(404, "ORDER_GROUP_NOT_FOUND", `Order group ${id} not found`);
  return group;
}

/**
 * `${retailer.code}-G-${sequence}`, sequence = count of this retailer's groups so far + 1 —
 * same TOCTOU-then-retry scheme as `orders.service.ts`'s `generateOrderNumber`, just scoped
 * to `order_groups` instead of `orders`.
 */
async function generateGroupOrderNumber(tx: Transaction, retailerId: string): Promise<string> {
  const retailer = await requireRetailer(tx, retailerId);
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(orderGroups).where(eq(orderGroups.retailerId, retailerId));
  const sequence = (row?.count ?? 0) + 1;
  return `${retailer.code}-G-${String(sequence).padStart(4, "0")}`;
}

async function buildOrderGroup(tx: Transaction, tenantId: string, input: CreateOrderGroupInput) {
  await requireRetailer(tx, input.retailerId);

  const orderNumber = await generateGroupOrderNumber(tx, input.retailerId);
  const [group] = await tx.insert(orderGroups).values({ tenantId, retailerId: input.retailerId, orderNumber }).returning();
  if (!group) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create order group");

  const childOrders = [];
  for (const orderInput of input.orders) {
    const child = await buildOrder(
      tx,
      tenantId,
      { retailerId: input.retailerId, customerId: orderInput.customerId, ...(orderInput.items ? { items: orderInput.items } : {}) },
      { groupId: group.id }
    );
    childOrders.push(child);
  }

  return { ...group, orders: childOrders };
}

/** Same retry rationale as `orders.service.ts`'s `createOrder`: a failed attempt rolls back entirely (group row and every child order created so far), so a plain retry-from-scratch is safe. */
export async function createOrderGroup(
  tenantId: string,
  input: CreateOrderGroupInput,
  actorRetailerId?: string | null,
  retriesLeft = 2
): Promise<Awaited<ReturnType<typeof buildOrderGroup>>> {
  // Same override as `orders.service.ts`'s `createOrder`: a retailer-linked actor can only
  // ever create a group order for its own retailer, regardless of what the client sent.
  const effectiveInput = actorRetailerId ? { ...input, retailerId: actorRetailerId } : input;
  try {
    return await withTenant(tenantId, (tx) => buildOrderGroup(tx, tenantId, effectiveInput));
  } catch (err) {
    if (retriesLeft > 0 && isOrderNumberConflict(err)) {
      return createOrderGroup(tenantId, input, actorRetailerId, retriesLeft - 1);
    }
    throw err;
  }
}

export interface ListOrderGroupsFilter {
  retailerId?: string | undefined;
}

export function listOrderGroups(
  tenantId: string,
  filter: ListOrderGroupsFilter = {},
  pagination: PaginationParams = DEFAULT_PAGINATION,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    // Force-override, not merely default — a retailer-linked actor's own id always wins over
    // any client-supplied `retailerId`, same convention `listOrders`/`listCustomers` use.
    const retailerId = actorRetailerId ?? filter.retailerId;
    if (retailerId) await requireRetailer(tx, retailerId);

    const conditions = [isNull(orderGroups.deletedAt)];
    if (retailerId) conditions.push(eq(orderGroups.retailerId, retailerId));
    const where = and(...conditions);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.orderGroups.findMany({ where, orderBy: (g, { desc }) => desc(g.createdAt), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(orderGroups).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

export function getOrderGroup(tenantId: string, id: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const group = await requireOrderGroup(tx, id, actorRetailerId);

    const orderRows = await tx.query.orders.findMany({
      where: and(eq(orders.groupId, group.id), isNull(orders.deletedAt)),
      orderBy: (o, { asc }) => asc(o.orderDate),
    });
    const childOrders = await Promise.all(orderRows.map((order) => assembleOrderDetail(tx, order)));

    return { ...group, orders: childOrders };
  });
}
