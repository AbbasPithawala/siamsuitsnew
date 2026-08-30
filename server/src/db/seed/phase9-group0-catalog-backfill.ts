import { eq } from "drizzle-orm";
import { db } from "../index";
import { tenants } from "../schema/index";
import {
  seedRenderSlotFeatures,
  backfillFeatureRequiredFlags,
  backfillPipingRenderSlot,
  backfillFabricLiningSequenceOrder,
} from "./catalog-render-slots";
import { summarizeDomain } from "../etl/result";
import type { EtlDomainResult } from "../etl/result";

/**
 * PHASE_9_TASKS.md Group 0 — one-time (but safe to re-run) production-tenant backfill:
 * `features.is_required` correction on existing catalog data, the `features.render_slot`
 * Piping tag (fixes the tabbed-style-picker UI bug — Piping should render as its own
 * always-visible swatch grid, see `backfillPipingRenderSlot`'s own doc comment), plus the
 * "Shoulder Type"/"Monogram Position" render-slot catalog seed. Matches `db/etl/production.ts`'s
 * pattern (find the "siam-suits" tenant, run each domain, log an `EtlDomainResult` summary)
 * even though this doesn't read from legacy Mongo — see `catalog-render-slots.ts`'s doc comment.
 *
 * `db/seed/index.ts`'s dev seed calls the same functions against the same tenant, so this
 * script's only real purpose is being independently re-runnable/inspectable in isolation (e.g.
 * right after `etl:production` populates real products for the first time).
 */
async function run(): Promise<void> {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
  if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run `npm run db:seed` first");
  const tenantId = tenant.id;

  console.log(`Running Phase 9 Group 0 catalog backfill against tenant "${tenant.name}" (${tenantId})\n`);

  const results: EtlDomainResult[] = [];

  console.log("== features.is_required backfill ==");
  results.push(await backfillFeatureRequiredFlags(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== features.render_slot backfill (Piping) ==");
  results.push(await backfillPipingRenderSlot(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== feature_products.sequence_order backfill (Fabric before Lining Code) ==");
  results.push(await backfillFabricLiningSequenceOrder(tenantId));
  console.log(summarizeDomain(results.at(-1)!));

  console.log("\n== Render-slot catalog seed (Shoulder Type / Monogram Position) ==");
  results.push(...(await seedRenderSlotFeatures(tenantId)));
  for (const r of results.slice(3)) console.log(summarizeDomain(r));

  console.log("\n===== Summary =====");
  for (const r of results) {
    console.log(`${r.domain}: ${r.migrated}/${r.found} migrated, ${r.skipped.length} skipped`);
  }
}

run()
  .catch((err) => {
    console.error("Phase 9 Group 0 catalog backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
