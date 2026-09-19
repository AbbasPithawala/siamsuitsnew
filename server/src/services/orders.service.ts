import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import {
  orders,
  orderItems,
  orderItemComponents,
  orderItemComponentMeasurements,
  orderItemComponentFeatures,
  superProductComponents,
  productProcesses,
  productMeasurements,
  manufacturingSteps,
} from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { computeTotalValue } from "../utils/measurement-values";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";
import { requireRetailer, requireCustomer } from "./customers.service";
import { requireSuperProduct, requireMeasurementDefinition, requireFeature, requireStyle, requireStyleOption } from "./catalog-helpers";
import { findMostRecentOrderComponentIdForProduct, upsertCustomerMeasurementProfileValues } from "./measurementProfiles.service";

export const ORDER_NUMBER_CONSTRAINT = "orders_tenant_order_number_unique";

export interface CreateMeasurementInput {
  measurementDefinitionId: string;
  value?: string | undefined;
  adjustmentValue?: string | undefined;
}

export interface CreateFeatureInput {
  featureId: string;
  styleId?: string | undefined;
  styleOptionId?: string | undefined;
  textValue?: string | undefined;
  structuredValue?: unknown;
}

export interface CreateComponentInput {
  /**
   * Only meaningful when this input reaches `resolveItemsFromInput` via the edit path
   * (`editOrderItems`) — the real `order_item_components.id` to update in place. `create`'s
   * own route never populates it; carried on this one shared interface (rather than a
   * parallel edit-only type) so `resolveItemsFromInput` stays the single resolver for both.
   */
  id?: string | undefined;
  superProductComponentId: string;
  measurements?: CreateMeasurementInput[];
  features?: CreateFeatureInput[];
  measurementNote?: string | undefined;
  stylingNote?: string | undefined;
  referenceImage?: string | undefined;
  /** Order-scoped Manual Size annotation (PHASE_10_TASKS.md Workstream E Group 6) — only ever set via the edit path; `create`'s zod schema never accepts it. */
  manualSizeImage?: string | undefined;
}

export interface CreateOrderItemInput {
  /** Only meaningful via the edit path — the real `order_items.id` to update in place. */
  id?: string | undefined;
  superProductId: string;
  components: CreateComponentInput[];
}

export interface CreateOrderInput {
  retailerId: string;
  customerId: string;
  isRush?: boolean;
  repeatOfOrderId?: string;
  items?: CreateOrderItemInput[];
}

/** A component fully resolved to what actually gets written: real productId/slotLabel (never client-supplied), plus its measurements/features. */
interface ResolvedComponent {
  /** Carried straight through from `CreateComponentInput.id` — see its own comment. */
  id: string | undefined;
  productId: string;
  slotLabel: string;
  measurements: CreateMeasurementInput[];
  features: CreateFeatureInput[];
  measurementNote: string | undefined;
  stylingNote: string | undefined;
  referenceImage: string | undefined;
  manualSizeImage: string | undefined;
}

interface ResolvedItem {
  /** Carried straight through from `CreateOrderItemInput.id` — see its own comment. */
  id: string | undefined;
  superProductId: string;
  components: ResolvedComponent[];
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function isUniqueConstraintConflict(err: unknown, constraintName: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505" &&
    "constraint_name" in err &&
    (err as { constraint_name?: string }).constraint_name === constraintName
  );
}

function isOrderNumberConflict(err: unknown): boolean {
  return isUniqueConstraintConflict(err, ORDER_NUMBER_CONSTRAINT);
}

/**
 * `retailerId`, when given, is embedded directly in the query's own `WHERE` — same
 * WHERE-embedded, never-fetched-then-rejected shape as `customers.service.ts`'s
 * `requireCustomer` (PHASE_10_TASKS.md Workstream E Decision 3). Callers that aren't
 * actor-driven (repeat-order cloning, PDF regeneration internals, etc.) omit it.
 */
export async function requireOrder(tx: Transaction, orderId: string, retailerId?: string | null) {
  const order = await tx.query.orders.findFirst({
    where: (o, { and, eq, isNull }) =>
      and(eq(o.id, orderId), isNull(o.deletedAt), retailerId ? eq(o.retailerId, retailerId) : undefined),
  });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`);
  return order;
}

/**
 * `${retailer.code}-${sequence}`, sequence = count of this retailer's orders so far + 1.
 * Two concurrent creates can compute the same count before either commits — that's the
 * TOCTOU window — so this is paired with a retry in `createOrder` rather than trying to
 * make the read-then-insert atomic here. A failed attempt's transaction rolls back
 * entirely (no partial rows), so a plain retry from scratch is safe and sees the
 * now-committed sibling order when it recomputes the count.
 */
async function generateOrderNumber(tx: Transaction, retailerId: string): Promise<string> {
  const retailer = await requireRetailer(tx, retailerId);
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.retailerId, retailerId));
  const sequence = (row?.count ?? 0) + 1;
  return `${retailer.code}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Numeric, not string, comparison — the profile's stored total round-trips through
 * `numeric(10,2)` (e.g. "40.00") while a freshly computed total may be formatted
 * differently (e.g. "40") without actually being a different measurement. Compares
 * `total_value` (body value + adjustment), not the raw body value alone — matching
 * legacy's own `Measurements.jsx` diff, so an adjustment-only edit counts as "changed" too.
 */
function measurementValueDiffers(priorTotalValue: string, newTotalValue: string | undefined): boolean {
  if (newTotalValue === undefined) return true;
  return Number(priorTotalValue) !== Number(newTotalValue);
}

async function resolveFeature(tx: Transaction, input: CreateFeatureInput): Promise<CreateFeatureInput> {
  await requireFeature(tx, input.featureId);

  if (input.styleId) {
    const style = await requireStyle(tx, input.styleId);
    if (style.featureId !== input.featureId) {
      throw new HttpError(400, "STYLE_FEATURE_MISMATCH", `Style ${input.styleId} does not belong to feature ${input.featureId}`);
    }
  }

  if (input.styleOptionId) {
    if (!input.styleId) {
      throw new HttpError(400, "STYLE_OPTION_WITHOUT_STYLE", `styleOptionId ${input.styleOptionId} was given without a styleId`);
    }
    const option = await requireStyleOption(tx, input.styleOptionId);
    if (option.styleId !== input.styleId) {
      throw new HttpError(400, "STYLE_OPTION_MISMATCH", `Style option ${input.styleOptionId} does not belong to style ${input.styleId}`);
    }
  }

  return input;
}

async function resolveMeasurement(tx: Transaction, input: CreateMeasurementInput): Promise<CreateMeasurementInput> {
  await requireMeasurementDefinition(tx, input.measurementDefinitionId);
  return input;
}

/**
 * PHASE_10_TASKS.md issue #2 ("if there are 10 measurements... fill even 1 and the others
 * should automatically be 0") — this was previously enforced only client-side
 * (`OrderBuilderPage.tsx`'s `sanitizeMeasurements`), which is bypassable (any other API
 * consumer, a future admin tool, or a client bug produces an incomplete measurement set
 * with no server-side guarantee) and confirmed live to actually be happening: a real order
 * placed with only 1 of a 12-measurement product's definitions submitted wrote exactly 1
 * `order_item_component_measurements` row, not 12.
 *
 * Called from `writeComponentContent` — deliberately *after* that function's own profile
 * upsert, not folded into `resolveItemsFromInput`'s general resolution step, so the
 * zero-backfilled entries this returns never reach `upsertCustomerMeasurementProfileValues`
 * (see that call site's own comment on why: a blank measurement on this order isn't the
 * customer's real value becoming "0", and shouldn't overwrite a real value a prior order
 * already saved to their profile). Every measurement definition genuinely linked to this
 * specific `productId` (`product_measurements`) ends up with a real
 * `order_item_component_measurements` row regardless — backfilled to `"0"`/`"0"` when the
 * client didn't submit a value, never silently omitted — across every write path through
 * `writeComponentContent` (create, repeat, edit).
 */
async function backfillMissingMeasurements(
  tx: Transaction,
  productId: string,
  provided: CreateMeasurementInput[]
): Promise<CreateMeasurementInput[]> {
  const providedIds = new Set(provided.map((m) => m.measurementDefinitionId));
  const links = await tx.query.productMeasurements.findMany({ where: eq(productMeasurements.productId, productId) });
  const missing = links
    .filter((link) => !providedIds.has(link.measurementDefinitionId))
    .map((link): CreateMeasurementInput => ({ measurementDefinitionId: link.measurementDefinitionId, value: "0", adjustmentValue: "0" }));
  return [...provided, ...missing];
}

/**
 * Validates and resolves the client's `items[]` against the catalog: each item's
 * `superProductId` must have real `super_product_components`, and the request must supply
 * exactly one entry per real component — matched by `superProductComponentId` — no
 * missing, no extra, no duplicates. `productId`/`slotLabel` always come from the resolved
 * catalog row, never from the client.
 */
async function resolveItemsFromInput(tx: Transaction, items: CreateOrderItemInput[]): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];

  for (const item of items) {
    await requireSuperProduct(tx, item.superProductId);

    const actualComponents = await tx.query.superProductComponents.findMany({
      where: eq(superProductComponents.superProductId, item.superProductId),
      orderBy: (c, { asc }) => asc(c.sequence),
    });
    if (actualComponents.length === 0) {
      throw new HttpError(422, "SUPER_PRODUCT_HAS_NO_COMPONENTS", `Super product ${item.superProductId} has no components defined`);
    }

    const providedIds = item.components.map((c) => c.superProductComponentId);
    const providedIdSet = new Set(providedIds);
    if (providedIdSet.size !== providedIds.length) {
      throw new HttpError(
        422,
        "DUPLICATE_COMPONENT",
        `Duplicate superProductComponentId supplied for super product ${item.superProductId}`
      );
    }

    const actualIdSet = new Set(actualComponents.map((c) => c.id));
    const missing = actualComponents.filter((c) => !providedIdSet.has(c.id)).map((c) => c.slotLabel);
    const extra = providedIds.filter((id) => !actualIdSet.has(id));
    if (missing.length > 0 || extra.length > 0) {
      const details: string[] = [];
      if (missing.length > 0) details.push(`missing slot(s): ${missing.join(", ")}`);
      if (extra.length > 0) details.push(`unknown superProductComponentId(s): ${extra.join(", ")}`);
      throw new HttpError(
        422,
        "COMPONENT_SET_MISMATCH",
        `components does not match super product ${item.superProductId}'s defined components (${details.join("; ")})`
      );
    }

    const byId = new Map(item.components.map((c) => [c.superProductComponentId, c]));
    const components: ResolvedComponent[] = [];
    for (const actual of actualComponents) {
      const provided = byId.get(actual.id);
      if (!provided) throw new HttpError(500, "INTERNAL_ERROR", "Component resolution invariant violated");

      const measurements = await Promise.all((provided.measurements ?? []).map((m) => resolveMeasurement(tx, m)));
      const features = await Promise.all((provided.features ?? []).map((f) => resolveFeature(tx, f)));

      components.push({
        id: provided.id,
        productId: actual.productId,
        slotLabel: actual.slotLabel,
        measurements,
        features,
        measurementNote: provided.measurementNote,
        stylingNote: provided.stylingNote,
        referenceImage: provided.referenceImage,
        manualSizeImage: provided.manualSizeImage,
      });
    }

    resolved.push({ id: item.id, superProductId: item.superProductId, components });
  }

  return resolved;
}

/**
 * Repeat-order cloning: copies a prior order's item/component/measurement/feature tree
 * verbatim (against the super product's components *as they were originally ordered*, not
 * re-validated against the current catalog — a super product's component set could have
 * changed since the original order shipped).
 */
async function cloneItemsFromOrder(tx: Transaction, sourceOrderId: string): Promise<ResolvedItem[]> {
  const sourceItems = await tx.query.orderItems.findMany({
    where: eq(orderItems.orderId, sourceOrderId),
    orderBy: (i, { asc }) => asc(i.sequence),
  });

  const resolved: ResolvedItem[] = [];
  for (const sourceItem of sourceItems) {
    const sourceComponents = await tx.query.orderItemComponents.findMany({
      where: eq(orderItemComponents.orderItemId, sourceItem.id),
      orderBy: (c, { asc }) => asc(c.createdAt),
    });

    const components: ResolvedComponent[] = [];
    for (const sourceComponent of sourceComponents) {
      const [measurementRows, featureRows] = await Promise.all([
        tx.query.orderItemComponentMeasurements.findMany({
          where: eq(orderItemComponentMeasurements.orderItemComponentId, sourceComponent.id),
        }),
        tx.query.orderItemComponentFeatures.findMany({
          where: eq(orderItemComponentFeatures.orderItemComponentId, sourceComponent.id),
        }),
      ]);

      components.push({
        id: undefined,
        productId: sourceComponent.productId,
        slotLabel: sourceComponent.slotLabel,
        measurementNote: sourceComponent.measurementNote ?? undefined,
        stylingNote: sourceComponent.stylingNote ?? undefined,
        referenceImage: sourceComponent.referenceImage ?? undefined,
        manualSizeImage: sourceComponent.manualSizeImage ?? undefined,
        measurements: measurementRows.map((m) => ({
          measurementDefinitionId: m.measurementDefinitionId,
          value: m.value ?? undefined,
          adjustmentValue: m.adjustmentValue ?? undefined,
        })),
        features: featureRows.map((f) => ({
          featureId: f.featureId,
          styleId: f.styleId ?? undefined,
          styleOptionId: f.styleOptionId ?? undefined,
          textValue: f.textValue ?? undefined,
          structuredValue: f.structuredValue ?? undefined,
        })),
      });
    }

    resolved.push({ id: undefined, superProductId: sourceItem.superProductId, components });
  }

  return resolved;
}

/** One `manufacturing_steps` row per the component's product's `product_processes`, same `sequenceOrder`, all starting `pending`. */
async function createManufacturingSteps(tx: Transaction, orderItemComponentId: string, productId: string): Promise<void> {
  const steps = await tx.query.productProcesses.findMany({
    where: eq(productProcesses.productId, productId),
    orderBy: (pp, { asc }) => asc(pp.sequenceOrder),
  });

  for (const step of steps) {
    await tx.insert(manufacturingSteps).values({
      orderItemComponentId,
      processId: step.processId,
      sequenceOrder: step.sequenceOrder,
      status: "pending",
    });
  }
}

/**
 * Resolves `order_item_components.baseline_component_id` (see that column's own schema
 * doc comment for the full rationale) — the customer's fixed, specific prior order's
 * component for this same product, established once and never re-derived.
 *
 * For a brand-new component (`isNewComponent`), this is a genuine lookup: one indexed query
 * across `orders`/`order_items`/`order_item_components` filtered to this customer + this
 * product, excluding the order currently being written, ordered by `order_date` descending,
 * limit 1 — an index range scan, not a loop stepping through orders one at a time, so its
 * cost doesn't grow with how far back a matching product happens to be. Filtering by
 * `product_id` (not just "the immediately preceding order") is what makes this correct when
 * an intervening order didn't include this product at all (e.g. order 5 has no pant, order 6
 * still correctly compares its pant against order 3's, skipping straight past order 5).
 * Persisted onto the component row immediately so this lookup runs exactly once per
 * component, ever — every later edit of the same component just reads the stored value back.
 *
 * For an existing component (an edit resending it), this is a plain read of the
 * already-stored value — the whole point is that it must NOT be recomputed here, or an edit
 * could silently re-anchor to a different (e.g. newer) order than the one this component was
 * originally compared against.
 */
async function resolveBaselineComponentId(
  tx: Transaction,
  orderItemComponentId: string,
  customerId: string,
  productId: string,
  orderId: string,
  isNewComponent: boolean
): Promise<string | null> {
  if (!isNewComponent) {
    const existing = await tx.query.orderItemComponents.findFirst({
      where: eq(orderItemComponents.id, orderItemComponentId),
      columns: { baselineComponentId: true },
    });
    return existing?.baselineComponentId ?? null;
  }

  // Same query `measurementProfiles.service.ts#getMeasurementBaseline` uses for the
  // order-builder's live preview — one shared implementation so the two can never drift.
  const baselineComponentId = await findMostRecentOrderComponentIdForProduct(tx, customerId, productId, orderId);
  await tx.update(orderItemComponents).set({ baselineComponentId }).where(eq(orderItemComponents.id, orderItemComponentId));
  return baselineComponentId;
}

/**
 * The baseline component's own current measurement totals, keyed by measurement definition —
 * "current" deliberately, not a frozen snapshot: if the baseline order is itself edited later,
 * the next write of the component pointing at it picks up the new value (a real product
 * decision, not an oversight — see `baseline_component_id`'s own schema doc comment).
 */
async function getBaselineMeasurementTotals(tx: Transaction, baselineComponentId: string | null): Promise<Map<string, string>> {
  const totals = new Map<string, string>();
  if (!baselineComponentId) return totals;
  const rows = await tx.query.orderItemComponentMeasurements.findMany({
    where: eq(orderItemComponentMeasurements.orderItemComponentId, baselineComponentId),
  });
  for (const row of rows) {
    if (row.totalValue !== null) totals.set(row.measurementDefinitionId, row.totalValue);
  }
  return totals;
}

/**
 * Writes one already-inserted (or already-existing) component's own measurements/features
 * rows and upserts the customer's measurement profile from them — the one real
 * implementation of "write a component's measurement/feature content" shared by `buildOrder`
 * (create: the component is brand new, so the deletes below are no-ops) and `editOrderItems`
 * (edit: the component may be pre-existing, so this is a genuine full-replace), rather than
 * two separate copies of the profile-upsert/`changedFromProfile` logic (PHASE_10_TASKS.md
 * Workstream E Group 6.2). Delete-then-insert, not a partial patch: the caller is expected to
 * resend a component's complete measurement/feature set every time, same as `create` already
 * requires (omitting `measurements` there has always meant "no measurements for this
 * component," not "leave whatever was there").
 *
 * `orderId`/`isNewComponent` feed `resolveBaselineComponentId` above — the caller (`buildOrder`/
 * `editOrderItems`) already knows unambiguously whether this component was just freshly
 * inserted or already existed, so it's passed in rather than re-derived here.
 */
async function writeComponentContent(
  tx: Transaction,
  tenantId: string,
  customerId: string,
  productId: string,
  orderItemComponentId: string,
  component: Pick<ResolvedComponent, "measurements" | "features">,
  orderId: string,
  isNewComponent: boolean
): Promise<void> {
  await tx.delete(orderItemComponentMeasurements).where(eq(orderItemComponentMeasurements.orderItemComponentId, orderItemComponentId));
  await tx.delete(orderItemComponentFeatures).where(eq(orderItemComponentFeatures.orderItemComponentId, orderItemComponentId));

  // Keeps the customer's "current default" profile (used purely for pre-filling a *brand-new*
  // order, `measurementProfiles.service.ts`'s own doc comment) up to date — a separate concern
  // from the `changedFromProfile` comparison below, which now compares against a fixed prior
  // ORDER instead (see `baseline_component_id`'s schema doc comment for why these two were
  // split apart). Only the measurements the caller actually submitted feed the profile —
  // deliberately NOT the zero-backfilled ones added below.
  await upsertCustomerMeasurementProfileValues(tx, tenantId, customerId, productId, component.measurements);

  const baselineComponentId = await resolveBaselineComponentId(tx, orderItemComponentId, customerId, productId, orderId, isNewComponent);
  const baselineTotals = await getBaselineMeasurementTotals(tx, baselineComponentId);

  // Every measurement definition genuinely linked to this product gets a real row — backfilled
  // to "0"/"0" when not submitted — so the order's own record (and the generated PDF) is always
  // complete, never silently missing rows for whatever the client happened to omit.
  const measurementsToWrite = await backfillMissingMeasurements(tx, productId, component.measurements);

  for (const measurement of measurementsToWrite) {
    const baselineTotalValue = baselineTotals.get(measurement.measurementDefinitionId) ?? null;
    const totalValue = computeTotalValue(measurement.value, measurement.adjustmentValue);
    await tx.insert(orderItemComponentMeasurements).values({
      orderItemComponentId,
      measurementDefinitionId: measurement.measurementDefinitionId,
      value: measurement.value ?? null,
      adjustmentValue: measurement.adjustmentValue ?? null,
      totalValue: totalValue ?? null,
      changedFromProfile: baselineTotalValue === null ? null : measurementValueDiffers(baselineTotalValue, totalValue),
    });
  }

  for (const feature of component.features) {
    await tx.insert(orderItemComponentFeatures).values({
      orderItemComponentId,
      featureId: feature.featureId,
      styleId: feature.styleId ?? null,
      styleOptionId: feature.styleOptionId ?? null,
      textValue: feature.textValue ?? null,
      structuredValue: feature.structuredValue,
    });
  }
}

/** Distinguishes a group child order from a normal one — set once at creation, never mutated. Group children are otherwise built by the exact same code path as a normal order (see `order-groups.service.ts`). */
export interface OrderGroupMembership {
  groupId: string;
}

export async function buildOrder(tx: Transaction, tenantId: string, input: CreateOrderInput, membership?: OrderGroupMembership) {
  await requireRetailer(tx, input.retailerId);
  const customer = await requireCustomer(tx, input.customerId);
  if (customer.retailerId !== input.retailerId) {
    throw new HttpError(400, "CUSTOMER_RETAILER_MISMATCH", `Customer ${input.customerId} does not belong to retailer ${input.retailerId}`);
  }

  let repeatOfOrderId: string | undefined;
  let resolvedItems: ResolvedItem[];

  if (input.repeatOfOrderId) {
    const sourceOrder = await requireOrder(tx, input.repeatOfOrderId);
    repeatOfOrderId = sourceOrder.id;
    resolvedItems =
      input.items && input.items.length > 0 ? await resolveItemsFromInput(tx, input.items) : await cloneItemsFromOrder(tx, sourceOrder.id);
  } else {
    if (!input.items || input.items.length === 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "items must be a non-empty array when repeatOfOrderId is not provided");
    }
    resolvedItems = await resolveItemsFromInput(tx, input.items);
  }

  const orderNumber = await generateOrderNumber(tx, input.retailerId);

  const [order] = await tx
    .insert(orders)
    .values({
      tenantId,
      retailerId: input.retailerId,
      customerId: input.customerId,
      orderNumber,
      status: "New Order",
      type: membership ? "group" : "normal",
      groupId: membership?.groupId ?? null,
      isRush: input.isRush ?? false,
      isRepeat: Boolean(repeatOfOrderId),
      repeatOfOrderId: repeatOfOrderId ?? null,
    })
    .returning();
  if (!order) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create order");

  for (const [index, item] of resolvedItems.entries()) {
    const [orderItem] = await tx
      .insert(orderItems)
      .values({ orderId: order.id, superProductId: item.superProductId, sequence: index + 1 })
      .returning();
    if (!orderItem) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create order item");

    for (const component of item.components) {
      const [orderItemComponent] = await tx
        .insert(orderItemComponents)
        .values({
          orderItemId: orderItem.id,
          productId: component.productId,
          slotLabel: component.slotLabel,
          measurementNote: component.measurementNote ?? null,
          stylingNote: component.stylingNote ?? null,
          referenceImage: component.referenceImage ?? null,
          manualSizeImage: component.manualSizeImage ?? null,
        })
        .returning();
      if (!orderItemComponent) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create order item component");

      // Same tx as the component insert above, so a rolled-back order rolls back the
      // profile write with it (PHASE_10_TASKS.md Workstream D Decision 2). Every component
      // built here is freshly inserted above, so `isNewComponent` is always true.
      await writeComponentContent(tx, tenantId, order.customerId, component.productId, orderItemComponent.id, component, order.id, true);
      await createManufacturingSteps(tx, orderItemComponent.id, component.productId);
    }
  }

  return assembleOrderDetail(tx, order);
}

/**
 * `retriesLeft` defaults to 2 (3 attempts total): a single retry is enough to guarantee
 * success for a 2-way race (by the time the loser retries, the winner has already
 * committed, so the recomputed count is guaranteed fresh), but a 3+-way pile-up can still
 * have two retriers collide with each other on their retry. A small retry budget covers
 * that realistic case (a handful of staff submitting orders for the same retailer around
 * the same moment) without building a dedicated sequence table for what is, in practice,
 * low-frequency admin traffic.
 */
export async function createOrder(
  tenantId: string,
  input: CreateOrderInput,
  actorRetailerId?: string | null,
  retriesLeft = 2
): Promise<Awaited<ReturnType<typeof buildOrder>>> {
  // A retailer-linked actor can only ever order for its own retailer (same rule the order
  // builder UI already enforces client-side) — force it here too so the route can't be
  // bypassed to create an order under a different retailer.
  const effectiveInput = actorRetailerId ? { ...input, retailerId: actorRetailerId } : input;
  try {
    return await withTenant(tenantId, (tx) => buildOrder(tx, tenantId, effectiveInput));
  } catch (err) {
    if (retriesLeft > 0 && isOrderNumberConflict(err)) {
      return createOrder(tenantId, input, actorRetailerId, retriesLeft - 1);
    }
    throw err;
  }
}

async function deleteOrderItemComponent(tx: Transaction, componentId: string): Promise<void> {
  await tx.delete(manufacturingSteps).where(eq(manufacturingSteps.orderItemComponentId, componentId));
  await tx.delete(orderItemComponentMeasurements).where(eq(orderItemComponentMeasurements.orderItemComponentId, componentId));
  await tx.delete(orderItemComponentFeatures).where(eq(orderItemComponentFeatures.orderItemComponentId, componentId));
  await tx.delete(orderItemComponents).where(eq(orderItemComponents.id, componentId));
}

async function deleteOrderItem(tx: Transaction, itemId: string, componentIds: string[]): Promise<void> {
  for (const componentId of componentIds) await deleteOrderItemComponent(tx, componentId);
  await tx.delete(orderItems).where(eq(orderItems.id, itemId));
}

async function fetchExistingItemTree(tx: Transaction, orderId: string) {
  const items = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
  const itemIds = items.map((i) => i.id);
  const components = itemIds.length
    ? await tx.query.orderItemComponents.findMany({ where: inArray(orderItemComponents.orderItemId, itemIds) })
    : [];
  return { items, componentsByItem: groupBy(components, (c) => c.orderItemId) };
}

export interface EditOrderInput {
  items: CreateOrderItemInput[];
}

/**
 * PHASE_10_TASKS.md Workstream E Group 6.2. Reconciles an existing order's `order_items`/
 * `order_item_components` tree against `input.items` rather than wiping and re-creating it
 * (a full delete-and-recreate would also discard any in-progress `manufacturing_steps` for
 * components the admin never actually touched): an item/component carrying its own real
 * `id` is updated in place (its measurements/features are still fully replaced via
 * `writeComponentContent`, but its `manufacturing_steps` are left completely alone); an
 * item/component with no `id` is a genuinely new addition (fresh `manufacturing_steps`,
 * exactly like `buildOrder`); an existing item/component whose `id` is absent from the
 * submitted set is removed. Resolution itself (`resolveItemsFromInput`) is the identical
 * function `buildOrder` uses — one real implementation of "validate + resolve items against
 * the catalog," not a second, edit-only copy.
 */
export async function editOrderItems(
  tenantId: string,
  orderId: string,
  input: EditOrderInput,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const order = await requireOrder(tx, orderId, actorRetailerId);
    const resolvedItems = await resolveItemsFromInput(tx, input.items);

    const { items: existingItems, componentsByItem: existingComponentsByItem } = await fetchExistingItemTree(tx, orderId);
    const existingItemById = new Map(existingItems.map((i) => [i.id, i]));

    for (const resolved of resolvedItems) {
      if (resolved.id && !existingItemById.has(resolved.id)) {
        throw new HttpError(422, "ORDER_ITEM_NOT_FOUND", `Order item ${resolved.id} does not belong to order ${orderId}`);
      }
    }

    const submittedItemIds = new Set(resolvedItems.filter((i) => i.id).map((i) => i.id as string));
    for (const item of existingItems) {
      if (submittedItemIds.has(item.id)) continue;
      const componentIds = (existingComponentsByItem.get(item.id) ?? []).map((c) => c.id);
      await deleteOrderItem(tx, item.id, componentIds);
    }

    for (const [index, resolved] of resolvedItems.entries()) {
      const sequence = index + 1;
      let orderItemId: string;

      if (resolved.id) {
        const existingItem = existingItemById.get(resolved.id);
        if (!existingItem) throw new HttpError(500, "INTERNAL_ERROR", "Order item resolution invariant violated");
        if (existingItem.superProductId !== resolved.superProductId) {
          throw new HttpError(
            422,
            "ORDER_ITEM_SUPER_PRODUCT_IMMUTABLE",
            `Order item ${resolved.id}'s super product cannot be changed by an edit — remove it and add a new line item instead`
          );
        }
        orderItemId = existingItem.id;
        if (existingItem.sequence !== sequence) {
          await tx.update(orderItems).set({ sequence, updatedAt: new Date() }).where(eq(orderItems.id, orderItemId));
        }
      } else {
        const [inserted] = await tx
          .insert(orderItems)
          .values({ orderId: order.id, superProductId: resolved.superProductId, sequence })
          .returning();
        if (!inserted) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create order item");
        orderItemId = inserted.id;
      }

      const existingComponents = existingComponentsByItem.get(orderItemId) ?? [];
      const existingComponentById = new Map(existingComponents.map((c) => [c.id, c]));

      for (const component of resolved.components) {
        if (component.id && !existingComponentById.has(component.id)) {
          throw new HttpError(
            422,
            "ORDER_ITEM_COMPONENT_NOT_FOUND",
            `Order item component ${component.id} does not belong to order item ${orderItemId}`
          );
        }
      }

      const submittedComponentIds = new Set(resolved.components.filter((c) => c.id).map((c) => c.id as string));
      for (const component of existingComponents) {
        if (!submittedComponentIds.has(component.id)) await deleteOrderItemComponent(tx, component.id);
      }

      for (const component of resolved.components) {
        if (component.id) {
          await tx
            .update(orderItemComponents)
            .set({
              measurementNote: component.measurementNote ?? null,
              stylingNote: component.stylingNote ?? null,
              referenceImage: component.referenceImage ?? null,
              manualSizeImage: component.manualSizeImage ?? null,
              updatedAt: new Date(),
            })
            .where(eq(orderItemComponents.id, component.id));
          // Pre-existing component — `isNewComponent: false` so its baseline stays whatever
          // was resolved when it was first created, never re-anchored by this edit.
          await writeComponentContent(tx, tenantId, order.customerId, component.productId, component.id, component, order.id, false);
        } else {
          const [insertedComponent] = await tx
            .insert(orderItemComponents)
            .values({
              orderItemId,
              productId: component.productId,
              slotLabel: component.slotLabel,
              measurementNote: component.measurementNote ?? null,
              stylingNote: component.stylingNote ?? null,
              referenceImage: component.referenceImage ?? null,
              manualSizeImage: component.manualSizeImage ?? null,
            })
            .returning();
          if (!insertedComponent) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create order item component");
          // A component newly added by this edit — same `isNewComponent: true` baseline
          // resolution as a fresh order create.
          await writeComponentContent(tx, tenantId, order.customerId, component.productId, insertedComponent.id, component, order.id, true);
          await createManufacturingSteps(tx, insertedComponent.id, component.productId);
        }
      }
    }

    const [updatedOrder] = await tx
      .update(orders)
      .set({ status: "Modified", lastModifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    if (!updatedOrder) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update order");

    return assembleOrderDetail(tx, updatedOrder);
  });
}

/**
 * The narrower status-transition surface (PHASE_10_TASKS.md Workstream E Group 6.2),
 * deliberately independent of `editOrderItems` above — touches only the `orders` row
 * itself, never `order_items`/`order_item_components`/measurements/features. Covers both
 * the explicit "mark Modified" action and "cancel" (any status string the caller passes;
 * `orders.status` is intentionally plain text, see its own schema comment), always
 * stamping `lastModifiedAt` since both are real edits to the order.
 */
export async function setOrderStatus(tenantId: string, orderId: string, status: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const order = await requireOrder(tx, orderId, actorRetailerId);
    const [updated] = await tx
      .update(orders)
      .set({ status, lastModifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update order status");
    return assembleOrderDetail(tx, updated);
  });
}

/**
 * Reassigns which retailer an order belongs to — a plain `orders.retailer_id` swap, deliberately
 * NOT also validated against the order's `customer_id`'s own (fixed, non-reassignable)
 * `retailer_id`: enforcing that match would make this action a no-op, since `buildOrder`
 * already guarantees they're equal at creation time and `customers.retailer_id` never
 * changes. Flagged in PHASE_10_TASKS.md's writeup as a real, undecided consequence (an order
 * can end up pointing at a different retailer than its own customer record) rather than
 * silently guessed past.
 */
export async function reassignOrderRetailer(tenantId: string, orderId: string, retailerId: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    // A retailer-linked actor can only ever act on its own orders (enforced by `requireOrder`
    // below), and reassigning to a *different* retailer would hand the order away — an action
    // only staff/admin (actorRetailerId null) should be able to take.
    if (actorRetailerId && retailerId !== actorRetailerId) {
      throw new HttpError(403, "FORBIDDEN", "A retailer cannot reassign an order to a different retailer");
    }
    const order = await requireOrder(tx, orderId, actorRetailerId);
    await requireRetailer(tx, retailerId);
    const [updated] = await tx
      .update(orders)
      .set({ retailerId, lastModifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to reassign order's retailer");
    return assembleOrderDetail(tx, updated);
  });
}

export interface ListOrdersFilter {
  retailerId?: string | undefined;
  customerId?: string | undefined;
  status?: string | undefined;
}

/**
 * One aggregate query across every listed order's `manufacturing_steps` (joined via
 * `order_item_components`/`order_items`), grouped by order id — not a per-row follow-up
 * query (PHASE_6_TASKS.md Group 6 explicitly calls out avoiding that N+1 shape for the
 * order list's progress rollup). Orders with zero components/steps simply get 0/0.
 */
async function attachManufacturingSummary<T extends { id: string }>(
  tx: Transaction,
  orderRows: T[]
): Promise<(T & { manufacturingStepsTotal: number; manufacturingStepsComplete: number; itemCount: number })[]> {
  const orderIds = orderRows.map((o) => o.id);
  if (orderIds.length === 0) return [];

  // `itemCount` is a separate aggregate from the manufacturing-steps one above: it counts
  // real physical units (`order_item_components` rows — e.g. a suit's jacket+pant are 2, not
  // 1), the "items not products" measure the order-list UI's Quantity column needs, distinct
  // from a count of order_items (line items/products). An order can have components with zero
  // manufacturing steps defined at all, so this can't be derived from the query above.
  const [stepCounts, itemCounts] = await Promise.all([
    tx
      .select({
        orderId: orderItems.orderId,
        total: sql<number>`count(*)::int`,
        complete: sql<number>`count(*) filter (where ${manufacturingSteps.status} = 'complete')::int`,
      })
      .from(manufacturingSteps)
      .innerJoin(orderItemComponents, eq(manufacturingSteps.orderItemComponentId, orderItemComponents.id))
      .innerJoin(orderItems, eq(orderItemComponents.orderItemId, orderItems.id))
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId),
    tx
      .select({ orderId: orderItems.orderId, count: sql<number>`count(*)::int` })
      .from(orderItemComponents)
      .innerJoin(orderItems, eq(orderItemComponents.orderItemId, orderItems.id))
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId),
  ]);

  const stepsByOrderId = new Map(stepCounts.map((c) => [c.orderId, c]));
  const itemsByOrderId = new Map(itemCounts.map((c) => [c.orderId, c.count]));
  return orderRows.map((o) => ({
    ...o,
    manufacturingStepsTotal: stepsByOrderId.get(o.id)?.total ?? 0,
    manufacturingStepsComplete: stepsByOrderId.get(o.id)?.complete ?? 0,
    itemCount: itemsByOrderId.get(o.id) ?? 0,
  }));
}

/**
 * `actorRetailerId`, when non-null, forces the effective `retailerId` filter to the
 * actor's own id, ignoring `filter.retailerId` — same rule as
 * `customers.service.ts`'s `listCustomers` (Workstream E Decision 3).
 */
export function listOrders(
  tenantId: string,
  filter: ListOrdersFilter = {},
  pagination: PaginationParams = DEFAULT_PAGINATION,
  actorRetailerId?: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const retailerId = actorRetailerId ?? filter.retailerId;
    if (retailerId) await requireRetailer(tx, retailerId);
    if (filter.customerId) await requireCustomer(tx, filter.customerId);

    const conditions = [isNull(orders.deletedAt)];
    if (retailerId) conditions.push(eq(orders.retailerId, retailerId));
    if (filter.customerId) conditions.push(eq(orders.customerId, filter.customerId));
    if (filter.status) conditions.push(eq(orders.status, filter.status));
    const where = and(...conditions);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [orderRows, [countRow]] = await Promise.all([
      tx.query.orders.findMany({ where, orderBy: (o, { desc }) => desc(o.orderDate), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
    ]);

    const data = await attachManufacturingSummary(tx, orderRows);
    return { data, total: countRow?.count ?? 0 };
  });
}

export function getOrder(tenantId: string, id: string, actorRetailerId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const order = await requireOrder(tx, id, actorRetailerId);
    return assembleOrderDetail(tx, order);
  });
}

/**
 * Assembles the one-call order-detail shape (items -> components -> measurements/
 * features/manufacturing_steps) with a handful of batched `inArray` queries — same
 * technique as `features.service.ts`'s `assembleFeatures` — so this stays O(1) round
 * trips regardless of how many items/components the order has.
 */
export async function assembleOrderDetail(tx: Transaction, order: typeof orders.$inferSelect) {
  const itemRows = await tx.query.orderItems.findMany({
    where: eq(orderItems.orderId, order.id),
    orderBy: (i, { asc }) => asc(i.sequence),
  });
  const itemIds = itemRows.map((i) => i.id);

  const componentRows = itemIds.length
    ? await tx.query.orderItemComponents.findMany({
        where: inArray(orderItemComponents.orderItemId, itemIds),
        orderBy: (c, { asc }) => asc(c.createdAt),
      })
    : [];
  const componentIds = componentRows.map((c) => c.id);

  const [measurementRows, featureRows, stepRows] = await Promise.all([
    componentIds.length
      ? tx.query.orderItemComponentMeasurements.findMany({ where: inArray(orderItemComponentMeasurements.orderItemComponentId, componentIds) })
      : Promise.resolve([]),
    componentIds.length
      ? tx.query.orderItemComponentFeatures.findMany({ where: inArray(orderItemComponentFeatures.orderItemComponentId, componentIds) })
      : Promise.resolve([]),
    componentIds.length
      ? tx.query.manufacturingSteps.findMany({
          where: inArray(manufacturingSteps.orderItemComponentId, componentIds),
          orderBy: (s, { asc }) => asc(s.sequenceOrder),
        })
      : Promise.resolve([]),
  ]);

  const componentsByItem = groupBy(componentRows, (c) => c.orderItemId);
  const measurementsByComponent = groupBy(measurementRows, (m) => m.orderItemComponentId);
  const featuresByComponent = groupBy(featureRows, (f) => f.orderItemComponentId);
  const stepsByComponent = groupBy(stepRows, (s) => s.orderItemComponentId);

  const items = itemRows.map((item) => ({
    ...item,
    components: (componentsByItem.get(item.id) ?? []).map((component) => ({
      ...component,
      measurements: measurementsByComponent.get(component.id) ?? [],
      features: featuresByComponent.get(component.id) ?? [],
      manufacturingSteps: stepsByComponent.get(component.id) ?? [],
    })),
  }));

  return { ...order, items };
}
