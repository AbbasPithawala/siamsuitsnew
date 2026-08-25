import { and, eq, isNull } from "drizzle-orm";
import type { Transaction } from "../withTenant";
import {
  products,
  superProducts,
  superProductComponents,
  processes,
  measurementDefinitions,
  featureProducts,
  styles,
} from "../schema/index";

/**
 * Phase 2's catalog ETL (now deleted) migrated `products`/`processes`/`measurement_definitions`/
 * `features`/`styles` — this module resolves against those already-migrated rows by natural
 * key (name/slug), the same way the live services do (`catalog-helpers.ts`). It never creates
 * products/processes/features/styles itself.
 *
 * `super_products` is the one exception: Phase 2 explicitly did not create these (legacy has
 * no `SuperProduct` collection at all — "Suit"/"Tuxedo" were hardcoded `if/else` branches in
 * the old order code, per `REWRITE_ARCHITECTURE.md` §1/§2). Every legacy `order_items[].item_name`
 * — bundled ("suit", "tuxedo") or standalone ("jacket", "pant", "shirt", "vest", "overcoat",
 * "tuxedojacket") — has to resolve to a real `super_products` row before an order can be
 * created against the new schema (`orders.service.ts#resolveItemsFromInput` requires it), so
 * this module creates the eight real ones deterministically from how those item names are
 * actually used across production orders, idempotently (safe to re-run).
 */

export interface SuperProductPlan {
  itemName: string;
  superProductName: string;
  components: { productName: string; slotLabel: string; sequence: number }[];
}

/** One entry per real, distinct `order_items[].item_name` found in production orders/group orders (see `mongo_samples` investigation notes in PHASE_7_TASKS.md). */
export const SUPER_PRODUCT_PLAN: SuperProductPlan[] = [
  {
    itemName: "suit",
    superProductName: "Suit",
    components: [
      { productName: "jacket", slotLabel: "Jacket", sequence: 1 },
      { productName: "pant", slotLabel: "Pant", sequence: 2 },
    ],
  },
  {
    itemName: "tuxedo",
    superProductName: "Tuxedo",
    components: [
      { productName: "tuxedojacket", slotLabel: "Jacket", sequence: 1 },
      { productName: "pant", slotLabel: "Pant", sequence: 2 },
    ],
  },
  { itemName: "jacket", superProductName: "Jacket", components: [{ productName: "jacket", slotLabel: "Jacket", sequence: 1 }] },
  { itemName: "pant", superProductName: "Pant", components: [{ productName: "pant", slotLabel: "Pant", sequence: 1 }] },
  { itemName: "shirt", superProductName: "Shirt", components: [{ productName: "shirt", slotLabel: "Shirt", sequence: 1 }] },
  { itemName: "vest", superProductName: "Vest", components: [{ productName: "vest", slotLabel: "Vest", sequence: 1 }] },
  { itemName: "overcoat", superProductName: "Overcoat", components: [{ productName: "overcoat", slotLabel: "Overcoat", sequence: 1 }] },
  {
    itemName: "tuxedojacket",
    superProductName: "Tuxedo Jacket",
    components: [{ productName: "tuxedojacket", slotLabel: "Jacket", sequence: 1 }],
  },
];

export interface ResolvedSuperProduct {
  superProductId: string;
  /** Keyed by product name (e.g. "jacket", "pant") — matches `SuperProductPlan.components[].productName`. */
  componentsByProductName: Map<string, { productId: string; slotLabel: string }>;
}

export async function requireProductByName(tx: Transaction, tenantId: string, name: string) {
  const product = await tx.query.products.findFirst({
    where: and(eq(products.tenantId, tenantId), eq(products.name, name), isNull(products.deletedAt)),
  });
  if (!product) {
    throw new Error(`ETL: product "${name}" not found for tenant ${tenantId} — expected Phase 2's catalog ETL to have created it`);
  }
  return product;
}

/**
 * Idempotent: looks up each planned super product by `(tenantId, name)` first (the real
 * unique index), only inserting what's missing. Safe to call on every ETL run.
 */
export async function ensureSuperProducts(tx: Transaction, tenantId: string): Promise<Map<string, ResolvedSuperProduct>> {
  const byItemName = new Map<string, ResolvedSuperProduct>();

  for (const plan of SUPER_PRODUCT_PLAN) {
    let superProduct = await tx.query.superProducts.findFirst({
      where: and(eq(superProducts.tenantId, tenantId), eq(superProducts.name, plan.superProductName), isNull(superProducts.deletedAt)),
    });

    if (!superProduct) {
      [superProduct] = await tx.insert(superProducts).values({ tenantId, name: plan.superProductName }).returning();
      if (!superProduct) throw new Error(`ETL: failed to create super product "${plan.superProductName}"`);
    }

    const componentsByProductName = new Map<string, { productId: string; slotLabel: string }>();
    for (const componentPlan of plan.components) {
      const product = await requireProductByName(tx, tenantId, componentPlan.productName);

      let component = await tx.query.superProductComponents.findFirst({
        where: and(eq(superProductComponents.superProductId, superProduct.id), eq(superProductComponents.productId, product.id)),
      });
      if (!component) {
        [component] = await tx
          .insert(superProductComponents)
          .values({
            superProductId: superProduct.id,
            productId: product.id,
            slotLabel: componentPlan.slotLabel,
            sequence: componentPlan.sequence,
          })
          .returning();
        if (!component) throw new Error(`ETL: failed to create super product component for "${plan.superProductName}"`);
      }

      componentsByProductName.set(componentPlan.productName, { productId: product.id, slotLabel: component.slotLabel });
    }

    byItemName.set(plan.itemName, { superProductId: superProduct.id, componentsByProductName });
  }

  return byItemName;
}

export async function findProcessByName(tx: Transaction, tenantId: string, name: string) {
  return tx.query.processes.findFirst({
    where: and(eq(processes.tenantId, tenantId), eq(processes.name, name), isNull(processes.deletedAt)),
  });
}

/** Mirrors the `slug` Phase 2 generated for `measurement_definitions` (lowercased, spaces to underscores). */
export function slugifyMeasurementName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function findMeasurementDefinitionByName(tx: Transaction, tenantId: string, name: string) {
  const slug = slugifyMeasurementName(name);
  return tx.query.measurementDefinitions.findFirst({
    where: and(eq(measurementDefinitions.tenantId, tenantId), eq(measurementDefinitions.slug, slug), isNull(measurementDefinitions.deletedAt)),
  });
}

/**
 * Features aren't unique per `(tenantId, name)` by design (`catalog.ts`'s schema comment —
 * the same name like "front button" legitimately recurs across products/feature rows). This
 * returns every candidate feature row on `product` named `featureName`; callers disambiguate
 * further by which one actually has a `styles` row matching the legacy style value.
 */
export async function findCandidateFeaturesForProduct(tx: Transaction, tenantId: string, productId: string, featureName: string) {
  const rows = await tx.query.featureProducts.findMany({
    where: eq(featureProducts.productId, productId),
    with: { feature: true },
  });
  return rows
    .map((r) => r.feature)
    .filter((f) => f && f.tenantId === tenantId && !f.deletedAt && f.name.trim().toLowerCase() === featureName.trim().toLowerCase());
}

const UNIT_FILLER_WORDS = new Set(["inches", "inch", "inc", "in", "cm", "mm"]);

/** Lowercased, punctuation-stripped, numeric-token- and unit-word-stripped word set — e.g. `"notch lapel 4.25 inches"` -> `{notch, lapel}`. */
function significantWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !UNIT_FILLER_WORDS.has(w) && !/^\d+(\.\d+)?$/.test(w));
  return new Set(words);
}

function isSubset(small: Set<string>, big: Set<string>): boolean {
  if (small.size === 0) return false;
  for (const w of small) if (!big.has(w)) return false;
  return true;
}

export interface StyleMatch {
  style: typeof styles.$inferSelect;
  /** false when the match came from `significantWords` overlap, not an exact string match — callers that found a fuzzy match should preserve the original legacy text (e.g. as `textValue`) since the catalog style name is a simplification of it. */
  isExact: boolean;
}

/**
 * Real production order data routinely qualifies a base catalog style with extra detail the
 * catalog itself doesn't carry — a lapel width ("notch lapel" -> "notch lapel 4.25 inches"),
 * a differently-ordered description ("notch satin" -> "notch satin 2 inches" vs. the
 * catalog's "notch lapel satin"). An exact match is tried first; failing that, this matches
 * by word-set overlap (after stripping numbers/units) — whichever of the two word sets is
 * smaller must be fully contained in the other — and prefers the most specific (most-words)
 * catalog style among the candidates that qualify, so e.g. "peak curved 4 inc" resolves to
 * "peak curved", not the less specific "peak lapel".
 */
export async function findStyleForFeature(tx: Transaction, featureId: string, styleValueName: string): Promise<StyleMatch | null> {
  const candidates = await tx.query.styles.findMany({
    where: and(eq(styles.featureId, featureId), isNull(styles.deletedAt)),
  });

  const normalizedValue = styleValueName.trim().toLowerCase();
  const exact = candidates.find((s) => s.name.trim().toLowerCase() === normalizedValue);
  if (exact) return { style: exact, isExact: true };

  const legacyWords = significantWords(styleValueName);
  let best: StyleMatch | null = null;
  for (const style of candidates) {
    const styleWords = significantWords(style.name);
    const [smaller, larger] = styleWords.size <= legacyWords.size ? [styleWords, legacyWords] : [legacyWords, styleWords];
    if (!isSubset(smaller, larger)) continue;
    if (!best || styleWords.size > significantWords(best.style.name).size) best = { style, isExact: false };
  }
  return best;
}
