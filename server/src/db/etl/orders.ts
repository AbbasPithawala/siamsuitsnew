import { and, eq, isNull } from "drizzle-orm";
import type { Transaction } from "../withTenant";
import { withTenant } from "../withTenant";
import {
  orders,
  orderGroups,
  orderItems,
  orderItemComponents,
  orderItemComponentMeasurements,
  orderItemComponentFeatures,
  manufacturingSteps,
  productProcesses,
  features,
  featureProducts,
  styles,
} from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import { requireMigratedRetailerId } from "./retailers";
import { resolveMigratedCustomerId } from "./customers";
import { ensureSuperProducts, findMeasurementDefinitionByName, findCandidateFeaturesForProduct, findStyleForFeature } from "./catalog";
import type { ResolvedSuperProduct } from "./catalog";
import { legacyItemUnitCount } from "./legacy-item-resolution";
import type { EtlDomainResult, EtlSkip } from "./result";

/** `siamServer/retailer/model/model.groupOrder.js` */
interface LegacyGroupOrder {
  _id: unknown;
  orderId?: string;
  retailer_code?: string;
}

interface LegacyMeasurementPoint {
  value?: number | string;
  adjustment_value?: number | string;
  total_value?: number | string;
}

interface LegacyMonogram {
  tag?: string;
  font?: string;
  color?: string;
  tagOptional?: string;
}

interface LegacyStyleDetailEntry {
  value?: string;
}

interface LegacyComponentStyleBlock {
  fabric_code?: string | undefined;
  lining_code?: string | undefined;
  piping?: string | undefined;
  monogram?: LegacyMonogram | undefined;
  style?: Record<string, LegacyStyleDetailEntry> | undefined;
  groupStyle?: Record<string, LegacyStyleDetailEntry> | undefined;
  note?: string | undefined;
}

interface LegacyOrderItem {
  _id: unknown;
  item_name: string;
  quantity?: number;
  styles?: Record<string, unknown>[];
}

/** `siamServer/retailer/model/model.Order.js` */
interface LegacyOrder {
  _id: unknown;
  orderId: string;
  retailer_code?: string;
  customer_id?: unknown;
  order_items?: LegacyOrderItem[];
  measurements?: Record<string, { measurements?: Record<string, LegacyMeasurementPoint> }>;
  order_status?: string;
  rushOrderDate?: string;
  orderCancle?: string;
  repeatOrder?: boolean;
  repeatOrderID?: string;
  type?: string;
  groupOrderID?: unknown;
  date?: number;
}

/** Every product name this ETL knows how to migrate (§SUPER_PRODUCT_PLAN's component product names). */
const KNOWN_STYLE_SUB_KEYS = new Set(["jacket", "tuxedojacket", "pant"]);

function toMoneyString(value: number | string | undefined): string | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

/**
 * Splits a legacy `order_items[].styles[0][key]` value into one "sub-block" per real
 * component. Bundled super products (Suit/Tuxedo) nest per-component detail under a
 * `jacket`/`tuxedojacket`/`pant` key, with `fabric_code`/`note` left at the top level
 * (shared across the bundle, in practice always describing the jacket-slot piece).
 * Standalone items (jacket/pant/shirt/vest/overcoat/tuxedojacket ordered alone) have no
 * such nesting — the whole object *is* the one component's detail.
 */
function splitStyleBlockByComponent(raw: Record<string, unknown>): { productName: string | null; block: LegacyComponentStyleBlock }[] {
  const nestedKeys = Object.keys(raw).filter((k) => KNOWN_STYLE_SUB_KEYS.has(k));
  if (nestedKeys.length === 0) {
    return [{ productName: null, block: raw as LegacyComponentStyleBlock }];
  }

  const shared = raw as LegacyComponentStyleBlock;
  return nestedKeys.map((key) => {
    const nested = raw[key] as LegacyComponentStyleBlock;
    return {
      productName: key === "tuxedojacket" ? "tuxedojacket" : key === "jacket" ? "jacket" : "pant",
      block: {
        ...nested,
        fabric_code: nested.fabric_code ?? shared.fabric_code,
        note: nested.note ?? shared.note,
      },
    };
  });
}

interface FeatureCreateCache {
  text: Map<string, string>; // `${productId}:${name}` -> featureId
  structured: Map<string, string>;
}

async function findOrCreateSimpleFeature(
  tx: Transaction,
  tenantId: string,
  productId: string,
  name: string,
  type: "text" | "structured",
  cache: FeatureCreateCache
): Promise<string> {
  const cacheMap = type === "text" ? cache.text : cache.structured;
  const cacheKey = `${productId}:${name}`;
  const cached = cacheMap.get(cacheKey);
  if (cached) return cached;

  const existingLink = await tx.query.featureProducts.findMany({
    where: eq(featureProducts.productId, productId),
    with: { feature: true },
  });
  const existing = existingLink.find((l) => l.feature && l.feature.type === type && l.feature.name.trim().toLowerCase() === name.toLowerCase());
  if (existing?.feature) {
    cacheMap.set(cacheKey, existing.feature.id);
    return existing.feature.id;
  }

  const [feature] = await tx.insert(features).values({ tenantId, name, type }).returning();
  if (!feature) throw new Error(`ETL: failed to create "${name}" feature`);
  await tx.insert(featureProducts).values({ featureId: feature.id, productId });
  cacheMap.set(cacheKey, feature.id);
  return feature.id;
}

interface ComponentWriteContext {
  tx: Transaction;
  tenantId: string;
  componentId: string;
  productId: string;
  featureCache: FeatureCreateCache;
  legacyOrderId: string;
  slotLabel: string;
  skipped: EtlSkip[];
}

async function writeMeasurementsForComponent(
  ctx: ComponentWriteContext,
  measurementBlock: Record<string, LegacyMeasurementPoint> | undefined
): Promise<void> {
  if (!measurementBlock) return;
  for (const [name, point] of Object.entries(measurementBlock)) {
    const definition = await findMeasurementDefinitionByName(ctx.tx, ctx.tenantId, name);
    if (!definition) {
      ctx.skipped.push({
        legacyId: `${ctx.legacyOrderId}/${ctx.slotLabel}/measurement/${name}`,
        reason: `no measurement definition named "${name}" found in catalog for tenant`,
      });
      continue;
    }
    await ctx.tx.insert(orderItemComponentMeasurements).values({
      orderItemComponentId: ctx.componentId,
      measurementDefinitionId: definition.id,
      value: toMoneyString(point.value),
      adjustmentValue: toMoneyString(point.adjustment_value),
      totalValue: toMoneyString(point.total_value),
    });
  }
}

async function writeChoiceFeature(ctx: ComponentWriteContext, featureName: string, valueName: string): Promise<boolean> {
  const candidates = await findCandidateFeaturesForProduct(ctx.tx, ctx.tenantId, ctx.productId, featureName);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = await findStyleForFeature(ctx.tx, candidate.id, valueName);
    if (match) {
      // A fuzzy (non-exact) match means the catalog style is a simplified base ("notch
      // lapel") of a more specific legacy value ("notch lapel 4.25 inches") — keep the full
      // original detail in `textValue` alongside the matched `styleId` so it isn't lost.
      await ctx.tx
        .insert(orderItemComponentFeatures)
        .values({
          orderItemComponentId: ctx.componentId,
          featureId: candidate.id,
          styleId: match.style.id,
          textValue: match.isExact ? null : valueName,
        })
        .onConflictDoNothing();
      return true;
    }
  }
  return false;
}

/** Piping style names are `"<code> (<supplier>)"` in the catalog; legacy orders only store the bare code — match by prefix. */
async function writePipingFeature(ctx: ComponentWriteContext, legacyCode: string): Promise<boolean> {
  const candidates = await findCandidateFeaturesForProduct(ctx.tx, ctx.tenantId, ctx.productId, "Piping");
  for (const candidate of candidates) {
    if (!candidate) continue;
    const candidateStyles = await ctx.tx.query.styles.findMany({ where: and(eq(styles.featureId, candidate.id), isNull(styles.deletedAt)) });
    const style = candidateStyles.find((s) => s.name.trim().toLowerCase().startsWith(legacyCode.trim().toLowerCase()));
    if (style) {
      await ctx.tx
        .insert(orderItemComponentFeatures)
        .values({ orderItemComponentId: ctx.componentId, featureId: candidate.id, styleId: style.id })
        .onConflictDoNothing();
      return true;
    }
  }
  return false;
}

async function writeStyleBlockFeatures(ctx: ComponentWriteContext, block: LegacyComponentStyleBlock): Promise<void> {
  if (block.fabric_code?.trim()) {
    const featureId = await findOrCreateSimpleFeature(ctx.tx, ctx.tenantId, ctx.productId, "fabric", "text", ctx.featureCache);
    await ctx.tx
      .insert(orderItemComponentFeatures)
      .values({ orderItemComponentId: ctx.componentId, featureId, textValue: block.fabric_code.trim() })
      .onConflictDoNothing();
  }

  if (block.lining_code?.trim()) {
    // Named "lining code" (not "lining") to avoid colliding with the pre-existing `type:
    // choice` "lining" feature (construction style, e.g. "half back lining") that Phase 2's
    // catalog ETL created — real order data shows `lining_code` is almost always a free-text
    // fabric code ("sss-pht-htciv-50", "pvl #31"), not one of that feature's 3 fixed choices.
    // See PHASE_7_TASKS.md Group 0 notes.
    const featureId = await findOrCreateSimpleFeature(ctx.tx, ctx.tenantId, ctx.productId, "lining code", "text", ctx.featureCache);
    await ctx.tx
      .insert(orderItemComponentFeatures)
      .values({ orderItemComponentId: ctx.componentId, featureId, textValue: block.lining_code.trim() })
      .onConflictDoNothing();
  }

  if (block.piping?.trim()) {
    const matched = await writePipingFeature(ctx, block.piping.trim());
    if (!matched) {
      ctx.skipped.push({
        legacyId: `${ctx.legacyOrderId}/${ctx.slotLabel}/piping`,
        reason: `no catalog Piping style matching code "${block.piping.trim()}"`,
      });
    }
  }

  if (block.monogram && (block.monogram.tag || block.monogram.font || block.monogram.color || block.monogram.tagOptional)) {
    const featureId = await findOrCreateSimpleFeature(ctx.tx, ctx.tenantId, ctx.productId, "monogram", "structured", ctx.featureCache);
    const structuredValue: Record<string, string> = {};
    if (block.monogram.tag) structuredValue.tag = block.monogram.tag;
    if (block.monogram.font) structuredValue.font = block.monogram.font;
    if (block.monogram.color) structuredValue.color = block.monogram.color;
    if (block.monogram.tagOptional) structuredValue.lineTwo = block.monogram.tagOptional;
    await ctx.tx
      .insert(orderItemComponentFeatures)
      .values({ orderItemComponentId: ctx.componentId, featureId, structuredValue })
      .onConflictDoNothing();
  }

  const choiceEntries = { ...(block.style ?? {}), ...(block.groupStyle ?? {}) };
  for (const [featureName, entry] of Object.entries(choiceEntries)) {
    const valueName = entry?.value?.trim();
    if (!valueName) continue;
    const matched = await writeChoiceFeature(ctx, featureName, valueName);
    if (!matched) {
      ctx.skipped.push({
        legacyId: `${ctx.legacyOrderId}/${ctx.slotLabel}/feature/${featureName}`,
        reason: `no catalog feature/style found for "${featureName}" = "${valueName}"`,
      });
    }
  }
}

/**
 * The full, resolved shape of one migrated (or already-existing) order, read back from
 * Postgres — used both while building an order and later by `manufacturing.ts`/
 * `extra-payments.ts` to resolve a legacy `item_code` to the right component.
 */
export interface OrderTree {
  orderId: string;
  items: { itemId: string; sequence: number; components: { componentId: string; productId: string; productName: string }[] }[];
}

export async function getOrderTreeByOrderNumber(tx: Transaction, tenantId: string, orderNumber: string): Promise<OrderTree | null> {
  const order = await tx.query.orders.findFirst({ where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)) });
  if (!order) return null;

  const itemRows = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id), orderBy: (i, { asc }) => asc(i.sequence) });
  const items: OrderTree["items"] = [];
  for (const item of itemRows) {
    const componentRows = await tx.query.orderItemComponents.findMany({ where: eq(orderItemComponents.orderItemId, item.id) });
    const components = [];
    for (const component of componentRows) {
      const product = await tx.query.products.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.id, component.productId) });
      components.push({ componentId: component.id, productId: component.productId, productName: product?.name ?? "" });
    }
    items.push({ itemId: item.id, sequence: item.sequence, components });
  }
  return { orderId: order.id, items };
}

export async function migrateOrderGroups(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyGroups = await db.collection<LegacyGroupOrder>("grouporders").find({}).toArray();
  const result: EtlDomainResult = { domain: "order_groups", found: legacyGroups.length, migrated: 0, skipped: [] };

  for (const legacy of legacyGroups) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const orderNumber = legacy.orderId?.trim();
    const code = legacy.retailer_code?.trim();
    if (!orderNumber || !code) {
      result.skipped.push({ legacyId, reason: "missing orderId or retailer_code" });
      continue;
    }

    let retailerId: string;
    try {
      retailerId = await requireMigratedRetailerId(tenantId, code);
    } catch {
      result.skipped.push({ legacyId, reason: `references retailer_code "${code}" which was not migrated` });
      continue;
    }

    await withTenant(tenantId, async (tx) => {
      const existing = await tx.query.orderGroups.findFirst({ where: and(eq(orderGroups.tenantId, tenantId), eq(orderGroups.orderNumber, orderNumber)) });
      if (existing) return;
      await tx.insert(orderGroups).values({ tenantId, retailerId, orderNumber });
    });
    result.migrated++;
  }

  return result;
}

/** One manufacturing_steps row per the component's product's product_processes — identical to `orders.service.ts#createManufacturingSteps`, all starting "pending". Historical status is applied later, in `manufacturing.ts`, driven by the legacy `jobs` collection (the authoritative source — see that module's comment). */
async function createPendingManufacturingSteps(tx: Transaction, orderItemComponentId: string, productId: string): Promise<void> {
  const existing = await tx.query.manufacturingSteps.findFirst({ where: eq(manufacturingSteps.orderItemComponentId, orderItemComponentId) });
  if (existing) return;

  const steps = await tx.query.productProcesses.findMany({
    where: eq(productProcesses.productId, productId),
    orderBy: (pp, { asc }) => asc(pp.sequenceOrder),
  });
  for (const step of steps) {
    await tx.insert(manufacturingSteps).values({ orderItemComponentId, processId: step.processId, sequenceOrder: step.sequenceOrder, status: "pending" });
  }
}

interface MigrateOrdersDeps {
  tenantId: string;
  superProductByItemName: Map<string, ResolvedSuperProduct>;
  legacyGroupIdToOrderGroupId: Map<string, string>;
}

async function migrateOneOrder(deps: MigrateOrdersDeps, legacy: LegacyOrder, featureCache: FeatureCreateCache, skipped: EtlSkip[]): Promise<boolean> {
  const legacyId = idToString(legacy._id) ?? "(no _id)";
  const orderNumber = legacy.orderId?.trim();
  if (!orderNumber) {
    skipped.push({ legacyId, reason: "missing orderId" });
    return false;
  }

  const code = legacy.retailer_code?.trim();
  const legacyCustomerId = idToString(legacy.customer_id);
  if (!code || !legacyCustomerId) {
    skipped.push({ legacyId: orderNumber, reason: "missing retailer_code or customer_id" });
    return false;
  }

  let retailerId: string;
  try {
    retailerId = await requireMigratedRetailerId(deps.tenantId, code);
  } catch {
    skipped.push({ legacyId: orderNumber, reason: `references retailer_code "${code}" which was not migrated` });
    return false;
  }

  const customerId = resolveMigratedCustomerId(legacyCustomerId);
  if (!customerId) {
    skipped.push({ legacyId: orderNumber, reason: `references customer ${legacyCustomerId} which was not migrated` });
    return false;
  }

  let groupId: string | null = null;
  if (legacy.type === "group") {
    const legacyGroupId = idToString(legacy.groupOrderID);
    groupId = legacyGroupId ? (deps.legacyGroupIdToOrderGroupId.get(legacyGroupId) ?? null) : null;
    if (!groupId) {
      skipped.push({ legacyId: orderNumber, reason: `type "group" but its groupOrderID ${legacyGroupId} was not migrated` });
      return false;
    }
  }

  const status = legacy.orderCancle === "Yes" ? "Cancelled" : legacy.order_status?.trim() || "New Order";
  const isRush = Boolean(legacy.rushOrderDate?.trim());

  await withTenant(deps.tenantId, async (tx) => {
    let order = await tx.query.orders.findFirst({ where: and(eq(orders.tenantId, deps.tenantId), eq(orders.orderNumber, orderNumber)) });
    if (order) return; // already migrated — leave as-is, idempotent re-run

    [order] = await tx
      .insert(orders)
      .values({
        tenantId: deps.tenantId,
        retailerId,
        customerId,
        groupId,
        orderNumber,
        status,
        type: legacy.type === "group" ? "group" : "normal",
        isRush,
        isRepeat: Boolean(legacy.repeatOrder),
        orderDate: legacy.date ? new Date(legacy.date) : new Date(),
        // repeatOfOrderId resolved in a second pass once every order exists (see migrateOrders)
      })
      .returning();
    if (!order) throw new Error(`ETL: failed to create order ${orderNumber}`);

    let sequenceCounter = 1;
    for (const [index, item] of (legacy.order_items ?? []).entries()) {
      const superProduct = deps.superProductByItemName.get(item.item_name);
      if (!superProduct) {
        skipped.push({ legacyId: `${orderNumber}/item[${index}]`, reason: `unrecognized item_name "${item.item_name}"` });
        continue;
      }

      const rawStyleEntry = item.styles?.[0];
      const styleKey = rawStyleEntry ? Object.keys(rawStyleEntry)[0] : undefined;
      const rawBlock = styleKey && rawStyleEntry ? (rawStyleEntry[styleKey] as Record<string, unknown>) : {};
      const subBlocks = splitStyleBlockByComponent(rawBlock);

      // `quantity` > 1 means N identical physical units, not N array entries — each becomes
      // its own `order_items` row (matching the schema's "one row per super-product
      // instance ordered, e.g. Suit #1, Suit #2" model), all sharing the one legacy
      // `styles[0]` block since legacy never varies styling per unit within one entry. See
      // `legacy-item-resolution.ts#matchLegacyItem`'s comment — jobs/extra-payments resolve
      // back to the right unit via this exact same sequence numbering.
      const unitCount = legacyItemUnitCount(item);
      for (let unit = 0; unit < unitCount; unit++) {
        const sequence = sequenceCounter++;

        const [orderItem] = await tx
          .insert(orderItems)
          .values({ orderId: order!.id, superProductId: superProduct.superProductId, sequence })
          .returning();
        if (!orderItem) throw new Error(`ETL: failed to create order item for ${orderNumber}[${index}]/unit ${unit}`);

        for (const [productName, component] of superProduct.componentsByProductName) {
          const [orderItemComponent] = await tx
            .insert(orderItemComponents)
            .values({ orderItemId: orderItem.id, productId: component.productId, slotLabel: component.slotLabel })
            .returning();
          if (!orderItemComponent) throw new Error(`ETL: failed to create order item component for ${orderNumber}[${index}]/unit ${unit}`);

          await createPendingManufacturingSteps(tx, orderItemComponent.id, component.productId);

          const measurementBlock = legacy.measurements?.[productName]?.measurements;
          const ctx: ComponentWriteContext = {
            tx,
            tenantId: deps.tenantId,
            componentId: orderItemComponent.id,
            productId: component.productId,
            featureCache,
            legacyOrderId: orderNumber,
            slotLabel: `item[${index}]/unit[${unit}]/${productName}`,
            skipped,
          };
          await writeMeasurementsForComponent(ctx, measurementBlock);

          const matchingSub = subBlocks.find((sb) => sb.productName === productName || sb.productName === null);
          if (matchingSub) await writeStyleBlockFeatures(ctx, matchingSub.block);
        }
      }
    }
  });

  return true;
}

/**
 * Migrates all 221 real orders (normal + group-children — legacy has no structural
 * difference between them beyond `type`/`groupOrderID`, per `FUNCTIONALITY_OVERVIEW.md`).
 * Requires `migrateOrderGroups`/`migrateRetailers`/`migrateCustomers` to have already run.
 * Idempotent: an order already present (matched by `order_number`, the real unique key) is
 * left untouched, not re-processed — safe to re-run.
 */
export async function migrateOrders(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyOrders = await db.collection<LegacyOrder>("orders").find({}).toArray();
  const legacyGroups = await db.collection<LegacyGroupOrder>("grouporders").find({}).toArray();

  const result: EtlDomainResult = { domain: "orders", found: legacyOrders.length, migrated: 0, skipped: [] };

  const superProductByItemName = await withTenant(tenantId, (tx) => ensureSuperProducts(tx, tenantId));

  const legacyGroupIdToOrderGroupId = new Map<string, string>();
  await withTenant(tenantId, async (tx) => {
    for (const g of legacyGroups) {
      const orderNumber = g.orderId?.trim();
      if (!orderNumber) continue;
      const row = await tx.query.orderGroups.findFirst({ where: and(eq(orderGroups.tenantId, tenantId), eq(orderGroups.orderNumber, orderNumber)) });
      if (row) legacyGroupIdToOrderGroupId.set(idToString(g._id) ?? "", row.id);
    }
  });

  const featureCache: FeatureCreateCache = { text: new Map(), structured: new Map() };
  const deps: MigrateOrdersDeps = { tenantId, superProductByItemName, legacyGroupIdToOrderGroupId };

  const legacyIdToOrderNumber = new Map<string, string>();
  for (const legacy of legacyOrders) {
    const id = idToString(legacy._id);
    if (id && legacy.orderId) legacyIdToOrderNumber.set(id, legacy.orderId.trim());
  }

  for (const legacy of legacyOrders) {
    const ok = await migrateOneOrder(deps, legacy, featureCache, result.skipped);
    if (ok) result.migrated++;
  }

  // Second pass: repeat-order linkage, now that every order that's going to exist, does.
  let repeatLinksSet = 0;
  for (const legacy of legacyOrders) {
    if (!legacy.repeatOrder || !legacy.repeatOrderID) continue;
    const orderNumber = legacy.orderId?.trim();
    const sourceOrderNumber = legacyIdToOrderNumber.get(legacy.repeatOrderID);
    if (!orderNumber || !sourceOrderNumber) {
      result.skipped.push({ legacyId: `${orderNumber ?? "?"}/repeatOfOrderId`, reason: `repeatOrderID ${legacy.repeatOrderID} does not resolve to a migrated order` });
      continue;
    }
    await withTenant(tenantId, async (tx) => {
      const [thisOrder, sourceOrder] = await Promise.all([
        tx.query.orders.findFirst({ where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)) }),
        tx.query.orders.findFirst({ where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, sourceOrderNumber)) }),
      ]);
      if (!thisOrder || !sourceOrder || thisOrder.repeatOfOrderId === sourceOrder.id) return;
      await tx.update(orders).set({ repeatOfOrderId: sourceOrder.id, updatedAt: new Date() }).where(eq(orders.id, thisOrder.id));
      repeatLinksSet++;
    });
  }
  if (repeatLinksSet > 0) console.log(`  Linked ${repeatLinksSet} repeat order(s) to their source order.`);

  return result;
}
