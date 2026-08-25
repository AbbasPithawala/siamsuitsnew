import { eq, inArray, isNull, and, sql } from "drizzle-orm";
import type { Transaction } from "../db/withTenant";
import { withTenant } from "../db/withTenant";
import { features, featureProducts, products, styles, styleOptions } from "../db/schema/index";
import type { featureTypeEnum } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireFeature, requireProduct, requireStyle, requireStyleOption } from "./catalog-helpers";
import { omit } from "../utils/object";
import { toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

type FeatureType = (typeof featureTypeEnum.enumValues)[number];

export interface CreateFeatureInput {
  name: string;
  thaiName?: string;
  type: FeatureType;
  processId?: string;
  productIds?: string[];
}

export type UpdateFeatureInput = Partial<Pick<CreateFeatureInput, "name" | "thaiName" | "type" | "processId">>;

export interface CreateStyleInput {
  name: string;
  thaiName?: string;
  image?: string;
  price?: string;
  workerPrice?: string;
}

export type UpdateStyleInput = Partial<CreateStyleInput>;

export interface CreateStyleOptionInput {
  name: string;
  image?: string;
}

export type UpdateStyleOptionInput = Partial<CreateStyleOptionInput>;

function groupBy<T, K extends string | number>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/**
 * Assembles the one-call `<FeatureSelector>` shape: each feature with its linked
 * products, and — for `type: "choice"` features — its styles nested with their
 * style_options nested. Done as a handful of batched `inArray` queries rather than
 * per-feature relational `with` calls, so this stays O(1) round trips regardless of how
 * many features are returned.
 *
 * `isAdditional`/`isRequired`/`renderSlot` (PHASE_9_TASKS.md Group 0) ride along on the
 * wire automatically via the `...feature` spread below — they're plain columns on
 * `features`, no extra assembly needed. `client/src/features/featureSelector/featuresApi.ts`'s
 * `ProductFeature` type is the one place that has to be kept in sync by hand.
 */
async function assembleFeatures(tx: Transaction, featureRows: (typeof features.$inferSelect)[]) {
  if (featureRows.length === 0) return [];
  const featureIds = featureRows.map((f) => f.id);

  const productLinkRows = await tx
    .select({ featureId: featureProducts.featureId, productId: products.id, productName: products.name })
    .from(featureProducts)
    .innerJoin(products, eq(products.id, featureProducts.productId))
    .where(inArray(featureProducts.featureId, featureIds));
  const productsByFeature = groupBy(productLinkRows, (r) => r.featureId);

  const styleRows = await tx.query.styles.findMany({
    where: and(inArray(styles.featureId, featureIds), isNull(styles.deletedAt)),
    orderBy: (s, { asc }) => asc(s.name),
  });
  const styleIds = styleRows.map((s) => s.id);

  const optionRows = styleIds.length
    ? await tx.query.styleOptions.findMany({
        where: and(inArray(styleOptions.styleId, styleIds), isNull(styleOptions.deletedAt)),
        orderBy: (o, { asc }) => asc(o.name),
      })
    : [];
  const optionsByStyle = groupBy(optionRows, (o) => o.styleId);

  const stylesWithOptions = styleRows.map((style) => ({ ...style, options: optionsByStyle.get(style.id) ?? [] }));
  const stylesByFeature = groupBy(stylesWithOptions, (s) => s.featureId);

  return featureRows.map((feature) => ({
    ...feature,
    products: (productsByFeature.get(feature.id) ?? []).map((p) => ({ id: p.productId, name: p.productName })),
    styles: feature.type === "choice" ? stylesByFeature.get(feature.id) ?? [] : undefined,
  }));
}

/**
 * No name-uniqueness check here, unlike products/processes/super_products — a feature
 * name legitimately recurs across different products (e.g. "front button" exists once per
 * garment that has its own independently-sized button feature; the Phase 2 ETL explicitly
 * chose not to collapse these). An earlier version of this function wrapped the insert in
 * `catchUniqueViolation(..., "FEATURE_NAME_TAKEN", ...)`, but with no DB constraint behind
 * it that error could never actually fire — dead, misleading code, removed rather than
 * backed by a constraint that would have broken real migrated data.
 */
export function createFeature(tenantId: string, input: CreateFeatureInput) {
  return withTenant(tenantId, async (tx) => {
    const [feature] = await tx.insert(features).values({ tenantId, ...omit(input, ["productIds"]) }).returning();
    if (!feature) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create feature");

    for (const productId of input.productIds ?? []) {
      await requireProduct(tx, productId);
      await tx.insert(featureProducts).values({ featureId: feature.id, productId });
    }

    const [assembled] = await assembleFeatures(tx, [feature]);
    return assembled;
  });
}

/**
 * The `productId`-filtered branch stays fully unpaginated, always (PHASE_10_TASKS.md
 * Workstream C — it's a bounded per-product option list, not a tenant-wide list); `pagination`
 * is only ever honored on the plain "every tenant feature" branch below, and only that
 * branch's return shape varies (plain array when `pagination` is omitted — the opt-in
 * default every existing unfiltered caller relies on — `{ data, total }` when provided).
 */
async function listFeaturesInTx(tx: Transaction, filter: { productId?: string | undefined } = {}, pagination?: PaginationParams) {
  if (filter.productId) {
    await requireProduct(tx, filter.productId);
    const links = await tx
      .select({ featureId: featureProducts.featureId })
      .from(featureProducts)
      .where(eq(featureProducts.productId, filter.productId))
      .orderBy(featureProducts.sequenceOrder);
    const orderedIds = links.map((l) => l.featureId);
    if (orderedIds.length === 0) return [];

    const featureRows = await tx.query.features.findMany({
      where: and(isNull(features.deletedAt), inArray(features.id, orderedIds)),
      orderBy: (f, { asc }) => asc(f.name),
    });

    // `inArray` doesn't preserve `orderedIds`' sequence — re-sort to the product's
    // configured order (PHASE_8_TASKS.md Group 1).
    const orderedRows = orderedIds
      .map((id) => featureRows.find((f) => f.id === id))
      .filter((f): f is (typeof featureRows)[number] => f !== undefined);

    return assembleFeatures(tx, orderedRows);
  }

  const where = isNull(features.deletedAt);
  if (!pagination) {
    const featureRows = await tx.query.features.findMany({ where, orderBy: (f, { asc }) => asc(f.name) });
    return assembleFeatures(tx, featureRows);
  }

  const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);
  const [featureRows, [countRow]] = await Promise.all([
    tx.query.features.findMany({ where, orderBy: (f, { asc }) => asc(f.name), limit, offset }),
    tx.select({ count: sql<number>`count(*)::int` }).from(features).where(where),
  ]);
  const data = await assembleFeatures(tx, featureRows);
  return { data, total: countRow?.count ?? 0 };
}

type AssembledFeature = Awaited<ReturnType<typeof assembleFeatures>>[number];

export function listFeatures(tenantId: string, filter?: { productId?: string | undefined }): Promise<AssembledFeature[]>;
export function listFeatures(
  tenantId: string,
  filter: Record<string, never>,
  pagination: PaginationParams
): Promise<{ data: AssembledFeature[]; total: number }>;
export function listFeatures(tenantId: string, filter: { productId?: string | undefined } = {}, pagination?: PaginationParams) {
  return withTenant(tenantId, (tx) => listFeaturesInTx(tx, filter, pagination));
}

export function getFeature(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const feature = await requireFeature(tx, id);
    const [assembled] = await assembleFeatures(tx, [feature]);
    return assembled;
  });
}

export function updateFeature(tenantId: string, id: string, input: UpdateFeatureInput) {
  return withTenant(tenantId, async (tx) => {
    await requireFeature(tx, id);
    const [updated] = await tx
      .update(features)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(features.id, id))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update feature");

    const [assembled] = await assembleFeatures(tx, [updated]);
    return assembled;
  });
}

/**
 * Cascades to the feature's styles and their style_options. Without this, a soft-deleted
 * feature's still-active styles become permanently unreachable — `requireStyle` walks up
 * to the feature via `requireFeature`, which 404s once the feature itself is gone, so
 * there's no route left to reach (and thus soft-delete) an orphaned style. Confirmed as a
 * real, not hypothetical, bug: found 22 orphaned rows in the dev database from before this
 * fix existed.
 */
export function softDeleteFeature(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireFeature(tx, id);

    const activeStyles = await tx.query.styles.findMany({
      where: and(eq(styles.featureId, id), isNull(styles.deletedAt)),
    });
    const styleIds = activeStyles.map((s) => s.id);

    if (styleIds.length > 0) {
      await tx.update(styleOptions).set({ deletedAt: new Date() }).where(inArray(styleOptions.styleId, styleIds));
      await tx.update(styles).set({ deletedAt: new Date() }).where(inArray(styles.id, styleIds));
    }

    await tx.update(features).set({ deletedAt: new Date() }).where(eq(features.id, id));
  });
}

/** Full replace of the feature<->product link set. */
export function setFeatureProducts(tenantId: string, featureId: string, productIds: string[]) {
  return withTenant(tenantId, async (tx) => {
    const feature = await requireFeature(tx, featureId);
    for (const productId of productIds) {
      await requireProduct(tx, productId);
    }

    await tx.delete(featureProducts).where(eq(featureProducts.featureId, featureId));
    for (const productId of productIds) {
      await tx.insert(featureProducts).values({ featureId, productId });
    }

    const [assembled] = await assembleFeatures(tx, [feature]);
    return assembled;
  });
}

/**
 * Full replace of the product<->feature link set, in the given order — the product-side
 * counterpart to `setFeatureProducts` (PHASE_8_TASKS.md Group 1, matching legacy
 * `ManageProduct.jsx`'s "Manage Styling" drag-reorder dialog). `featureIds`' array
 * position becomes `sequence_order`, consumed by `listFeatures` when filtered to a
 * product. Only replaces this product's own links — a feature's links to *other*
 * products are untouched, same isolation `setFeatureProducts` already has in reverse.
 */
export function setProductFeatures(tenantId: string, productId: string, featureIds: string[]) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    for (const featureId of featureIds) {
      await requireFeature(tx, featureId);
    }

    await tx.delete(featureProducts).where(eq(featureProducts.productId, productId));
    for (const [sequenceOrder, featureId] of featureIds.entries()) {
      await tx.insert(featureProducts).values({ featureId, productId, sequenceOrder });
    }

    return listFeaturesInTx(tx, { productId });
  });
}

export function createStyle(tenantId: string, featureId: string, input: CreateStyleInput) {
  return withTenant(tenantId, async (tx) => {
    const feature = await requireFeature(tx, featureId);
    if (feature.type !== "choice") {
      throw new HttpError(400, "FEATURE_NOT_CHOICE", `Feature ${featureId} is type "${feature.type}", not "choice" — styles only apply to choice features`);
    }

    const [style] = await tx.insert(styles).values({ featureId, ...input }).returning();
    return { ...style, options: [] };
  });
}

export function updateStyle(tenantId: string, styleId: string, input: UpdateStyleInput) {
  return withTenant(tenantId, async (tx) => {
    await requireStyle(tx, styleId);
    const [updated] = await tx
      .update(styles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(styles.id, styleId))
      .returning();
    const options = await tx.query.styleOptions.findMany({
      where: and(eq(styleOptions.styleId, styleId), isNull(styleOptions.deletedAt)),
    });
    return { ...updated, options };
  });
}

export function softDeleteStyle(tenantId: string, styleId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireStyle(tx, styleId);
    await tx.update(styles).set({ deletedAt: new Date() }).where(eq(styles.id, styleId));
  });
}

export function createStyleOption(tenantId: string, styleId: string, input: CreateStyleOptionInput) {
  return withTenant(tenantId, async (tx) => {
    await requireStyle(tx, styleId);
    const [option] = await tx.insert(styleOptions).values({ styleId, ...input }).returning();
    return option;
  });
}

export function updateStyleOption(tenantId: string, styleOptionId: string, input: UpdateStyleOptionInput) {
  return withTenant(tenantId, async (tx) => {
    await requireStyleOption(tx, styleOptionId);
    const [updated] = await tx
      .update(styleOptions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(styleOptions.id, styleOptionId))
      .returning();
    return updated;
  });
}

export function softDeleteStyleOption(tenantId: string, styleOptionId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireStyleOption(tx, styleOptionId);
    await tx.update(styleOptions).set({ deletedAt: new Date() }).where(eq(styleOptions.id, styleOptionId));
  });
}
