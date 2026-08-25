import { and, eq, inArray, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { shippingBoxes, shippingBoxItems, orderItemComponents, manufacturingSteps, processes } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { requireRetailer } from "./customers.service";
import { requireOwnedComponent } from "./manufacturing.service";
import { isUniqueConstraintConflict } from "./orders.service";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export const TRACKING_CODE_CONSTRAINT = "shipping_boxes_tracking_code_unique";

function isTrackingCodeConflict(err: unknown): boolean {
  return isUniqueConstraintConflict(err, TRACKING_CODE_CONSTRAINT);
}

export interface CreateShippingBoxInput {
  retailerId: string;
}

export interface ListShippingBoxesFilter {
  retailerId?: string | undefined;
  isClosed?: boolean | undefined;
}

/**
 * `retailerId`, when given, is embedded directly in the query's own `WHERE` — same
 * WHERE-embedded shape as `customers.service.ts`'s `requireCustomer` (Workstream E
 * Decision 3).
 */
export async function requireShippingBox(tx: Transaction, id: string, retailerId?: string | null) {
  const box = await tx.query.shippingBoxes.findFirst({
    where: (b, { and, eq }) => and(eq(b.id, id), retailerId ? eq(b.retailerId, retailerId) : undefined),
  });
  if (!box) throw new HttpError(404, "SHIPPING_BOX_NOT_FOUND", `Shipping box ${id} not found`);
  return box;
}

/**
 * `shipping_boxes.tracking_code` is unique *globally*, not per-tenant (see
 * `invoicing.ts`'s `trackingCodeUnique` index) — unlike `orders.order_number`, whose
 * uniqueness is scoped to `(tenant_id, order_number)`. `retailers.code` is itself only
 * unique per-tenant, so two different tenants can genuinely and durably pick the same
 * retailer code and land on the same `${code}-${sequence}` value — unlike
 * `orders.service.ts`'s TOCTOU-only collision (where a bare retry works because the
 * count has moved on by the time the loser retries), recomputing the same count here
 * would deterministically collide again. `sequenceBump` grows by one on every retry so
 * a genuine, durable collision is still resolved rather than retried into the ground.
 */
async function generateTrackingCode(tx: Transaction, retailerId: string, sequenceBump: number): Promise<string> {
  const retailer = await requireRetailer(tx, retailerId);
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(shippingBoxes).where(eq(shippingBoxes.retailerId, retailerId));
  const sequence = (row?.count ?? 0) + 1 + sequenceBump;
  return `SHIP-${retailer.code}-${String(sequence).padStart(4, "0")}`;
}

async function buildShippingBox(tx: Transaction, tenantId: string, input: CreateShippingBoxInput, sequenceBump: number) {
  await requireRetailer(tx, input.retailerId);
  const trackingCode = await generateTrackingCode(tx, input.retailerId, sequenceBump);

  const [box] = await tx.insert(shippingBoxes).values({ tenantId, retailerId: input.retailerId, trackingCode }).returning();
  if (!box) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create shipping box");
  return box;
}

export async function createShippingBox(
  tenantId: string,
  input: CreateShippingBoxInput,
  retriesLeft = 2,
  sequenceBump = 0
): Promise<typeof shippingBoxes.$inferSelect> {
  try {
    return await withTenant(tenantId, (tx) => buildShippingBox(tx, tenantId, input, sequenceBump));
  } catch (err) {
    if (retriesLeft > 0 && isTrackingCodeConflict(err)) {
      return createShippingBox(tenantId, input, retriesLeft - 1, sequenceBump + 1);
    }
    throw err;
  }
}

/**
 * `actorRetailerId`, when non-null, forces the effective `retailerId` filter to the
 * actor's own id, ignoring `filter.retailerId` (Workstream E Decision 3).
 */
export function listShippingBoxes(
  tenantId: string,
  filter: ListShippingBoxesFilter = {},
  pagination: PaginationParams = DEFAULT_PAGINATION,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const retailerId = actorRetailerId ?? filter.retailerId;
    if (retailerId) await requireRetailer(tx, retailerId);

    const conditions = [];
    if (retailerId) conditions.push(eq(shippingBoxes.retailerId, retailerId));
    if (filter.isClosed !== undefined) conditions.push(eq(shippingBoxes.isClosed, filter.isClosed));
    const where = conditions.length ? and(...conditions) : undefined;
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.shippingBoxes.findMany({ where, orderBy: (b, { desc }) => desc(b.createdAt), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(shippingBoxes).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

/** Batches the component lookup for every item in the box — same technique as `orders.service.ts`'s `assembleOrderDetail`. */
async function assembleShippingBoxDetail(tx: Transaction, box: typeof shippingBoxes.$inferSelect) {
  const itemRows = await tx.query.shippingBoxItems.findMany({ where: eq(shippingBoxItems.shippingBoxId, box.id) });
  const componentIds = itemRows.map((i) => i.orderItemComponentId);
  const componentRows = componentIds.length
    ? await tx.query.orderItemComponents.findMany({ where: inArray(orderItemComponents.id, componentIds) })
    : [];
  const componentById = new Map(componentRows.map((c) => [c.id, c]));

  const items = itemRows.map((item) => ({ ...item, component: componentById.get(item.orderItemComponentId) ?? null }));
  return { ...box, items };
}

export function getShippingBox(tenantId: string, id: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const box = await requireShippingBox(tx, id, actorRetailerId);
    return assembleShippingBoxDetail(tx, box);
  });
}

/**
 * The actual point of this service: a component can only be packed once every one of its
 * `manufacturing_steps` is `"complete"` — closing the legacy bug (per
 * `FUNCTIONALITY_OVERVIEW.md`'s shipping section) where an order could ship with
 * unfinished manufacturing. A component with zero steps defined (e.g. its product has no
 * `product_processes`) has nothing incomplete and is allowed through.
 */
async function requireCompleteManufacturing(tx: Transaction, componentId: string): Promise<void> {
  const steps = await tx.query.manufacturingSteps.findMany({
    where: eq(manufacturingSteps.orderItemComponentId, componentId),
    orderBy: (s, { asc }) => asc(s.sequenceOrder),
  });

  const incomplete = steps.filter((s) => s.status !== "complete");
  if (incomplete.length === 0) return;

  const processIds = [...new Set(incomplete.map((s) => s.processId))];
  const processRows = await tx.query.processes.findMany({ where: inArray(processes.id, processIds) });
  const processNameById = new Map(processRows.map((p) => [p.id, p.name]));

  const pending = incomplete.map((s) => `${processNameById.get(s.processId) ?? s.processId} (${s.status})`).join(", ");
  throw new HttpError(
    409,
    "MANUFACTURING_INCOMPLETE",
    `Component ${componentId} cannot be shipped — manufacturing step(s) not complete: ${pending}`
  );
}

export async function addItemToBox(tenantId: string, boxId: string, orderItemComponentId: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const box = await requireShippingBox(tx, boxId, actorRetailerId);
    if (box.isClosed) throw new HttpError(409, "BOX_CLOSED", `Shipping box ${boxId} is closed and cannot accept new items`);

    const component = await requireOwnedComponent(tx, tenantId, orderItemComponentId);
    await requireCompleteManufacturing(tx, component.id);

    return catchUniqueViolation(
      async () => {
        const [item] = await tx.insert(shippingBoxItems).values({ shippingBoxId: box.id, orderItemComponentId: component.id }).returning();
        if (!item) throw new HttpError(500, "INTERNAL_ERROR", "Failed to add item to shipping box");
        return item;
      },
      "DUPLICATE_SHIPPING_BOX_ITEM",
      `Component ${orderItemComponentId} is already packed in shipping box ${boxId}`
    );
  });
}

/** Symmetrical with `addItemToBox`: a closed box is sealed, so removal is blocked too, not just new additions. */
export async function removeItemFromBox(tenantId: string, boxId: string, orderItemComponentId: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const box = await requireShippingBox(tx, boxId, actorRetailerId);
    if (box.isClosed) throw new HttpError(409, "BOX_CLOSED", `Shipping box ${boxId} is closed and cannot be modified`);

    const existing = await tx.query.shippingBoxItems.findFirst({
      where: and(eq(shippingBoxItems.shippingBoxId, box.id), eq(shippingBoxItems.orderItemComponentId, orderItemComponentId)),
    });
    if (!existing) {
      throw new HttpError(404, "SHIPPING_BOX_ITEM_NOT_FOUND", `Component ${orderItemComponentId} is not packed in shipping box ${boxId}`);
    }

    await tx.delete(shippingBoxItems).where(eq(shippingBoxItems.id, existing.id));
  });
}

export async function closeShippingBox(tenantId: string, boxId: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const box = await requireShippingBox(tx, boxId, actorRetailerId);
    if (box.isClosed) throw new HttpError(409, "BOX_ALREADY_CLOSED", `Shipping box ${boxId} is already closed`);

    const [updated] = await tx
      .update(shippingBoxes)
      .set({ isClosed: true, updatedAt: new Date() })
      .where(eq(shippingBoxes.id, box.id))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to close shipping box");
    return updated;
  });
}
