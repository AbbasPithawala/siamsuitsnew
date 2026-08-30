import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { tenants } from "../schema/index";
import { backfillLegacyStyleImages } from "./legacy-style-images-backfill";
import { summarizeDomain } from "../etl/result";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// `server/legacy-style-images/` — sibling of `src/`, not under it (a one-time download
// artifact, not application source), created by this session's own Mongo-catalog image
// download pass.
const IMAGES_ROOT = path.resolve(__dirname, "..", "..", "..", "legacy-style-images");
const MANIFEST_PATH = path.join(IMAGES_ROOT, "manifest.json");

async function run(): Promise<void> {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
  if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run `npm run db:seed` first");

  console.log(`Backfilling legacy style images against tenant "${tenant.name}" (${tenant.id})`);
  console.log(`Manifest: ${MANIFEST_PATH}\n`);

  const result = await backfillLegacyStyleImages(tenant.id, MANIFEST_PATH, IMAGES_ROOT);
  console.log(summarizeDomain(result));
}

run()
  .catch((err) => {
    console.error("Legacy style images backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
