import { eq } from "drizzle-orm";
import { db } from "../index";
import { platformAdmins } from "../schema/index";
import { hashPassword } from "../../services/auth.service";

const PLATFORM_ADMIN_NAME = process.env.PLATFORM_ADMIN_NAME ?? "Platform Admin";
const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? "platform-admin@example.com";
const PLATFORM_ADMIN_USERNAME = process.env.PLATFORM_ADMIN_USERNAME ?? "platform-admin";
const PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? "ChangeMe123!";

/**
 * Standalone script, deliberately not folded into `db/seed/index.ts` (PHASE_11_TASKS.md A4)
 * — that script seeds one tenant's routine dev/CI data and is safe to re-run freely by
 * design; a platform admin is a cross-cutting, rarely-created credential that should never
 * be an accidental side effect of tenant seeding. Idempotent: safe to re-run.
 */
async function seedPlatformAdmin() {
  const existing = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.username, PLATFORM_ADMIN_USERNAME),
  });
  if (existing) {
    console.log(`Platform admin "${PLATFORM_ADMIN_USERNAME}" already exists — skipping.`);
    return;
  }

  const passwordHash = await hashPassword(PLATFORM_ADMIN_PASSWORD);
  await db.insert(platformAdmins).values({
    name: PLATFORM_ADMIN_NAME,
    email: PLATFORM_ADMIN_EMAIL,
    username: PLATFORM_ADMIN_USERNAME,
    passwordHash,
  });
  console.log(
    `Created platform admin "${PLATFORM_ADMIN_USERNAME}" with password "${PLATFORM_ADMIN_PASSWORD}" — change this after first login.`
  );
}

seedPlatformAdmin()
  .catch((err) => {
    console.error("Platform admin seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
