import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { features, featureProducts, products, styles } from "../schema/index";
import type { EtlDomainResult, EtlSkip } from "../etl/result";

/**
 * PHASE_9_TASKS.md Group 0 — the "Shoulder Type"/"Monogram Position" render-slot catalog
 * data (Decision 4) plus the one-time `is_required` backfill onto features Phase 7's ETL
 * already created (Decision omitted here, see Group 0's own bullet list). Neither of these
 * reads from legacy Mongo (unlike `db/etl/*`, which migrates real legacy documents) — this
 * is new catalog data invented for the rewrite — but both functions follow the same
 * explicit/logged/idempotent shape `db/etl/production.ts`'s domain functions use
 * (`EtlDomainResult`, safe to re-run), per the task's own instruction to match that pattern.
 *
 * Callable two ways: from `db/seed/index.ts` (dev/CI — runs against whatever products the
 * "siam-suits" tenant happens to have, which on a fresh DB is none yet, so the
 * feature/style rows are created but `feature_products` links are skipped and logged) and
 * from `phase9-group0-catalog-backfill.ts` (the one-time production-tenant run, after real
 * products already exist via `etl:production`).
 */

interface RenderSlotFeaturePlan {
  name: string;
  renderSlot: "shoulder_type" | "monogram_position";
  /**
   * Real `products.name` values (Phase 2's ETL naming: lowercase, no spaces —
   * "jacket"/"tuxedojacket"/"shirt"/"overcoat"/"pant"/"vest").
   */
  productNames: string[];
  styleNames: { name: string; image?: string }[];
}

/**
 * Shoulder Type: `Measurements.jsx` renders this fixed image-radio block for every
 * component except vest/pant (`product_name == "vest" ? <></> : product_name == "pant" ?
 * <></> : (...)`) — verified directly, not inferred. Image paths are legacy's own literal
 * `<img src="/ImagesFabric/jacket/sloping.png">` etc. (never catalog data in legacy — this
 * feature/its styles don't exist as a real Mongo collection at all), stored here as the
 * same bare-relative-path convention `StyleOptionButton.tsx` already documents ("renders
 * `image` as-is, no base-URL convention exists yet") rather than inventing one.
 *
 * Monogram Position: verified directly in `MissingFabric.jsx` (grep "Monogram Position"),
 * not assumed from the task doc's suggested list, which turned out to be wrong. The block
 * only actually renders for: the standalone-item path's "shirt" branch (line ~1815) and its
 * "jacket" branch (line ~2300 — nested inside a `product['name'] !== 'vest'` check that's
 * dead code in context, since that branch is only reached when `product['name'] === "jacket"`
 * already); the Suit-specific render's jacket-component section (line ~3117); and the
 * Tuxedo-specific render's tuxedojacket-component section (line ~4049). The standalone
 * ternary chain (`pant` -> nothing, `shirt` -> the block, `jacket` -> the block) has no
 * final `else`, so vest/overcoat/pant never get Monogram Position at all in legacy — not
 * "jacket/tuxedojacket/vest/overcoat, not shirt" as originally guessed in the task doc.
 * Real, verified list: jacket, tuxedojacket, shirt.
 */
const RENDER_SLOT_FEATURE_PLAN: RenderSlotFeaturePlan[] = [
  {
    name: "Shoulder Type",
    renderSlot: "shoulder_type",
    productNames: ["jacket", "tuxedojacket", "shirt", "overcoat"],
    styleNames: [
      { name: "Sloping", image: "/ImagesFabric/jacket/sloping.png" },
      { name: "Standard", image: "/ImagesFabric/jacket/standard.png" },
      { name: "Square", image: "/ImagesFabric/jacket/square.png" },
    ],
  },
  {
    name: "Monogram Position",
    renderSlot: "monogram_position",
    productNames: ["jacket", "tuxedojacket", "shirt"],
    styleNames: [{ name: "Left Side" }, { name: "Right Side" }],
  },
];

export async function seedRenderSlotFeatures(tenantId: string): Promise<EtlDomainResult[]> {
  return withTenant(tenantId, async (tx) => {
    const results: EtlDomainResult[] = [];

    for (const plan of RENDER_SLOT_FEATURE_PLAN) {
      const skipped: EtlSkip[] = [];
      let migrated = 0;

      let feature = await tx.query.features.findFirst({
        where: and(eq(features.renderSlot, plan.renderSlot), isNull(features.deletedAt)),
      });
      if (!feature) {
        [feature] = await tx
          .insert(features)
          .values({ tenantId, name: plan.name, type: "choice", renderSlot: plan.renderSlot, isRequired: false })
          .returning();
        migrated++;
      }
      if (!feature) throw new Error(`catalog seed: failed to create feature "${plan.name}"`);
      const featureId = feature.id;

      for (const stylePlan of plan.styleNames) {
        const existingStyle = await tx.query.styles.findFirst({
          where: and(eq(styles.featureId, featureId), eq(styles.name, stylePlan.name), isNull(styles.deletedAt)),
        });
        if (!existingStyle) {
          await tx.insert(styles).values({ featureId, name: stylePlan.name, image: stylePlan.image ?? null });
          migrated++;
        }
      }

      for (const productName of plan.productNames) {
        const product = await tx.query.products.findFirst({
          where: and(eq(products.tenantId, tenantId), eq(products.name, productName), isNull(products.deletedAt)),
        });
        if (!product) {
          skipped.push({ legacyId: `${plan.name}/${productName}`, reason: `product "${productName}" not found for this tenant yet — run again once it exists` });
          continue;
        }

        const existingLink = await tx.query.featureProducts.findFirst({
          where: and(eq(featureProducts.featureId, featureId), eq(featureProducts.productId, product.id)),
        });
        if (!existingLink) {
          await tx.insert(featureProducts).values({ featureId, productId: product.id });
          migrated++;
        }
      }

      results.push({ domain: `render-slot catalog seed: ${plan.name}`, found: plan.productNames.length, migrated, skipped });
    }

    return results;
  });
}

/**
 * PHASE_9_TASKS.md Group 0: "an explicit, logged, one-time UPDATE ... not an inferred
 * runtime rule" — `type` alone can't distinguish required-piping-shaped `choice` features
 * from required-lapel-shaped ones, so this flips `is_required` to `false` on every existing
 * `text`/`structured` feature (fabric, lining code, monogram — Phase 7 ETL's
 * `findOrCreateSimpleFeature` output) and every feature literally named "piping"
 * (case-insensitive, matching Phase 7's real backfilled Piping catalog feature). Idempotent:
 * only touches rows still `is_required = true`, so a second run reports 0 migrated.
 */
export async function backfillFeatureRequiredFlags(tenantId: string): Promise<EtlDomainResult> {
  return withTenant(tenantId, async (tx) => {
    const eligible = await tx.query.features.findMany({
      where: and(
        isNull(features.deletedAt),
        or(inArray(features.type, ["text", "structured"]), sql`lower(trim(${features.name})) = 'piping'`)
      ),
    });

    const toUpdate = eligible.filter((f) => f.isRequired);
    for (const f of toUpdate) {
      await tx.update(features).set({ isRequired: false, updatedAt: new Date() }).where(eq(features.id, f.id));
    }

    return { domain: "features.is_required backfill (text/structured + piping)", found: eligible.length, migrated: toUpdate.length, skipped: [] };
  });
}

/**
 * The real user-reported UX bug this fixes: Piping was migrated as an ordinary `type:
 * "choice"` feature (Phase 7 ETL), so `FeatureSelector.tsx` routed it into the generic tabbed
 * style picker alongside Lapel/Pocket/Front Button. Legacy never rendered it that way — it was
 * its own always-visible swatch grid, same layout as Monogram Color (see the `piping`
 * `featureRenderSlotEnum` value's own doc comment in `catalog.ts`). This is a pure UPDATE, not
 * a merge/dedup — unlike fabric/lining-code/monogram, the Phase 7 ETL already backfilled
 * Piping as a single feature row per tenant (matched case-insensitively by name, same as
 * `backfillFeatureRequiredFlags` above), so there's exactly one row to tag. Idempotent: only
 * touches rows still `render_slot IS NULL`.
 */
export async function backfillPipingRenderSlot(tenantId: string): Promise<EtlDomainResult> {
  return withTenant(tenantId, async (tx) => {
    const eligible = await tx.query.features.findMany({
      where: and(isNull(features.deletedAt), isNull(features.renderSlot), sql`lower(trim(${features.name})) = 'piping'`),
    });

    for (const f of eligible) {
      await tx.update(features).set({ renderSlot: "piping", updatedAt: new Date() }).where(eq(features.id, f.id));
    }

    return { domain: "features.render_slot backfill (piping)", found: eligible.length, migrated: eligible.length, skipped: [] };
  });
}

/**
 * The real user-reported layout bug this fixes: Fabric and Lining Code both default to
 * `feature_products.sequence_order = 0` (Phase 7 ETL never assigned either a real value), so
 * `listFeaturesInTx`'s `ORDER BY sequence_order` has a tie with no defined tiebreak — verified
 * directly against the dev DB, it currently returns Lining Code before Fabric for jacket, the
 * opposite of the requested "Fabric then Lining" order. This is a data-hygiene fix (give
 * `sequence_order` its intended real values), not a client-side name-based sort — sorting by
 * name in `FeatureSelector.tsx` would silently override whatever an admin sets here later,
 * defeating the point of `sequence_order` being admin-configurable. Idempotent: only touches
 * a (fabric, lining) pair still tied/misordered relative to each other.
 */
export async function backfillFabricLiningSequenceOrder(tenantId: string): Promise<EtlDomainResult> {
  return withTenant(tenantId, async (tx) => {
    const selectLinks = (nameSql: ReturnType<typeof sql>) =>
      tx
        .select({ id: featureProducts.id, productId: featureProducts.productId, sequenceOrder: featureProducts.sequenceOrder })
        .from(featureProducts)
        .innerJoin(features, eq(featureProducts.featureId, features.id))
        .where(and(eq(features.tenantId, tenantId), isNull(features.deletedAt), nameSql));

    const fabricLinks = await selectLinks(sql`lower(trim(${features.name})) = 'fabric'`);
    const liningLinks = await selectLinks(sql`lower(trim(${features.name})) = 'lining code'`);
    const liningByProduct = new Map(liningLinks.map((link) => [link.productId, link]));

    let migrated = 0;
    for (const fabricLink of fabricLinks) {
      const liningLink = liningByProduct.get(fabricLink.productId);
      if (!liningLink || fabricLink.sequenceOrder < liningLink.sequenceOrder) continue;
      await tx.update(featureProducts).set({ sequenceOrder: 0 }).where(eq(featureProducts.id, fabricLink.id));
      await tx.update(featureProducts).set({ sequenceOrder: 1 }).where(eq(featureProducts.id, liningLink.id));
      migrated++;
    }

    return {
      domain: "feature_products.sequence_order backfill (Fabric before Lining Code)",
      found: fabricLinks.length,
      migrated,
      skipped: [],
    };
  });
}
