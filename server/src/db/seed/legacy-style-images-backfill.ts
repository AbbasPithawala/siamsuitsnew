import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { features, styles, styleOptions } from "../schema/index";
import { storageBackend } from "../../services/storage.service";
import type { EtlDomainResult, EtlSkip } from "../etl/result";

/**
 * One-time backfill: the 232 real style/style-option images downloaded from legacy's Mongo
 * catalog (`server/legacy-style-images/manifest.json` — see that session's own download
 * script) into `styles.image`/`style_options.image`, which the Phase 2 ETL left unset for
 * everything except the small set of hardcoded monogram/shoulder-type assets. Matches purely
 * by name (case-insensitive, trimmed) — `feature_products`/`styles.feature_id` duplication
 * (the same feature name legitimately recurs across products, PHASE_9_TASKS.md Group 0/
 * `catalog.ts`'s own doc comment) means one manifest entry can and should update *every*
 * matching row, not just the first, so no duplicate is left with a blank image just because
 * a sibling happened to get picked first.
 *
 * Follows `catalog-render-slots.ts`'s established shape (`EtlDomainResult`, idempotent, safe
 * to re-run) even though this doesn't read from legacy Mongo directly — it reads the already-
 * downloaded manifest instead. Idempotent via `needsRealImage` (see its own doc comment) —
 * a row already holding a real, resolvable URL (from a prior run of this script, or a real
 * admin-managed upload) is left alone; a bare legacy filename is not treated as "already set".
 */

interface ManifestEntry {
  level: "style" | "option";
  featureName: string;
  styleName: string;
  optionName: string | null;
  relPath: string;
  status: "ok" | "failed";
}

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

function contentTypeFor(relPath: string): string {
  const ext = path.extname(relPath).slice(1).toLowerCase();
  return EXTENSION_TO_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The Phase 2 ETL copied Mongo's `image` field verbatim into `styles.image`/
 * `style_options.image` — a bare legacy filename (e.g. `"download-1.jpg"`), never a
 * resolvable URL (`StyleOptionButton.tsx`'s own doc comment: "siam/server has no image
 * storage/CDN mechanism yet"). So `image IS NULL` is the wrong idempotency check here —
 * verified directly, every real row already has one of these bare filenames, not null, so
 * that check alone would skip all 232 rows and migrate nothing. A row only counts as
 * "already fixed" once it holds a real, resolvable URL (this backfill's own `storageBackend`
 * upload, or a `/uploads/...` path from some other real upload) — anything else, including a
 * bare legacy filename, still needs replacing.
 */
function needsRealImage(image: string | null): boolean {
  if (!image) return true;
  return !/^https?:\/\//i.test(image) && !image.startsWith("/uploads/");
}

export async function backfillLegacyStyleImages(
  tenantId: string,
  manifestPath: string,
  imagesRootDir: string
): Promise<EtlDomainResult> {
  const manifest: ManifestEntry[] = JSON.parse(await readFile(manifestPath, "utf8"));
  const okEntries = manifest.filter((e) => e.status === "ok");
  const skipped: EtlSkip[] = [];
  let migrated = 0;

  await withTenant(tenantId, async (tx) => {
    for (const entry of okEntries) {
      const legacyId = `${entry.featureName}/${entry.styleName}${entry.optionName ? `/${entry.optionName}` : ""}`;

      const matchingFeatures = await tx.query.features.findMany({
        where: and(eq(features.tenantId, tenantId), isNull(features.deletedAt), sql`lower(trim(${features.name})) = ${normalize(entry.featureName)}`),
      });
      if (matchingFeatures.length === 0) {
        skipped.push({ legacyId, reason: `no feature named "${entry.featureName}" found for this tenant` });
        continue;
      }
      const featureIds = matchingFeatures.map((f) => f.id);

      const matchingStyles = await tx.query.styles.findMany({
        where: and(inArray(styles.featureId, featureIds), isNull(styles.deletedAt), sql`lower(trim(${styles.name})) = ${normalize(entry.styleName)}`),
      });
      if (matchingStyles.length === 0) {
        skipped.push({ legacyId, reason: `no style named "${entry.styleName}" found under feature "${entry.featureName}"` });
        continue;
      }

      let targetRows: { id: string; image: string | null }[];
      if (entry.level === "style") {
        targetRows = matchingStyles;
      } else {
        const styleIds = matchingStyles.map((s) => s.id);
        targetRows = await tx.query.styleOptions.findMany({
          where: and(inArray(styleOptions.styleId, styleIds), isNull(styleOptions.deletedAt), sql`lower(trim(${styleOptions.name})) = ${normalize(entry.optionName!)}`),
        });
        if (targetRows.length === 0) {
          skipped.push({ legacyId, reason: `no option named "${entry.optionName}" found under style "${entry.styleName}"` });
          continue;
        }
      }

      const toUpdate = targetRows.filter((r) => needsRealImage(r.image));
      if (toUpdate.length === 0) {
        skipped.push({ legacyId, reason: "every matching row already has a real image URL set" });
        continue;
      }

      const buffer = await readFile(path.join(imagesRootDir, entry.relPath));
      const { url } = await storageBackend.upload(buffer, contentTypeFor(entry.relPath), "style-images");

      for (const row of toUpdate) {
        if (entry.level === "style") {
          await tx.update(styles).set({ image: url, updatedAt: new Date() }).where(eq(styles.id, row.id));
        } else {
          await tx.update(styleOptions).set({ image: url, updatedAt: new Date() }).where(eq(styleOptions.id, row.id));
        }
        migrated++;
      }
    }
  });

  return { domain: "styles/style_options.image backfill (legacy Mongo catalog images)", found: okEntries.length, migrated, skipped };
}
