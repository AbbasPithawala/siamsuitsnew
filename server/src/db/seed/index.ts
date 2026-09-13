import { db } from "../index";
import { permissions, roles, rolePermissions } from "../schema/index";
import { permissionCatalog } from "./permissions";
import { provisionTenant } from "../../services/provisioning.service";
import { and, eq } from "drizzle-orm";
import {
  seedRenderSlotFeatures,
  backfillFeatureRequiredFlags,
  backfillPipingRenderSlot,
  backfillFabricLiningSequenceOrder,
} from "./catalog-render-slots";
import { summarizeDomain } from "../etl/result";

const SEED_ADMIN_PASSWORD = "ChangeMe123!";

/**
 * Idempotent: safe to re-run. Seeds the global permission catalog, plus a default
 * tenant + "Owner" role (all permissions, system-protected) and "Retailer" role
 * (tenant-configurable, retailer-scoped permission bundle) that Phase 2's Mongo->Postgres
 * ETL will migrate the existing Siam Suits business into.
 */
async function seed() {
  console.log("Seeding permission catalog...");
  for (const permission of permissionCatalog) {
    const existing = await db.query.permissions.findFirst({
      where: eq(permissions.key, permission.key),
    });
    if (!existing) {
      await db.insert(permissions).values(permission);
    }
  }

  // PHASE_11_TASKS.md Workstream C Group 0: this used to inline its own tenant/Owner-role/
  // admin-user creation (idempotent check-then-create); now delegates to the same
  // `provisionTenant()` a live approve-tenant-request route calls, dogfooding the extraction
  // for real dev/CI setup rather than only type-checking it in isolation.
  // `tempPassword`/`mustChangePassword` are passed explicitly so this seed's well-known dev
  // behavior (byte-for-byte: same admin username/password, no forced first-login) doesn't
  // silently change (PHASE_11_TASKS.md Decision C2).
  console.log("Provisioning default tenant + Owner role + admin user...");
  const { tenant, ownerUser: adminUser } = await provisionTenant({
    businessName: "Siam Suits",
    slug: "siam-suits",
    ownerName: "Admin",
    ownerEmail: "admin@siam-suits.local",
    ownerUsername: "admin",
    tempPassword: SEED_ADMIN_PASSWORD,
    mustChangePassword: false,
  });
  console.log(`Tenant "${tenant.slug}" ready; admin user "${adminUser.username}" ready (password "${SEED_ADMIN_PASSWORD}").`);

  const ownerRole = await db.query.roles.findFirst({
    where: and(eq(roles.tenantId, tenant.id), eq(roles.name, "Owner")),
  });
  if (!ownerRole) {
    throw new Error("Expected provisionTenant() to have created the Owner role");
  }

  // PHASE_10_TASKS.md Workstream E Group 3 — a real, tenant-configurable "Retailer" role
  // (not a system role like Owner: a tenant can still edit/rebalance its permission set
  // later, same as any other role). Deliberately excludes every `catalog.*.manage`
  // permission — that's the actual security boundary keeping retailers read-only on the
  // catalog (Decision 4). Reconciled (not just topped-up) on every run — an existing
  // same-named role is forced to exactly this bundle and to `isSystem: false` rather than
  // left as-is, because a stray/placeholder "Retailer" role predating this seed (e.g. a
  // manually-created demo login with an overbroad grant) would otherwise leave the actual
  // security boundary this task exists to establish silently unenforced.
  console.log("Seeding default Retailer role...");
  let retailerRole = await db.query.roles.findFirst({
    where: and(eq(roles.tenantId, tenant.id), eq(roles.name, "Retailer")),
  });
  if (!retailerRole) {
    [retailerRole] = await db.insert(roles).values({ tenantId: tenant.id, name: "Retailer", isSystem: false }).returning();
  } else if (retailerRole.isSystem) {
    [retailerRole] = await db.update(roles).set({ isSystem: false }).where(eq(roles.id, retailerRole.id)).returning();
  }
  if (!retailerRole) {
    throw new Error("Failed to create Retailer role");
  }

  const retailerPermissionKeys = [
    "customers.manage",
    "orders.create",
    "orders.view",
    "orders.repeat",
    "orders.group.create",
    "invoices.view",
    "shipping.view",
  ];
  const retailerPermissionRows = await Promise.all(
    retailerPermissionKeys.map(async (key) => {
      const permission = await db.query.permissions.findFirst({ where: eq(permissions.key, key) });
      if (!permission) {
        throw new Error(`Retailer role seed expected permission '${key}' to exist`);
      }
      return permission;
    })
  );
  for (const permission of retailerPermissionRows) {
    const existingLink = await db.query.rolePermissions.findFirst({
      where: (rp, { and: andOp, eq: eqOp }) => andOp(eqOp(rp.roleId, retailerRole!.id), eqOp(rp.permissionId, permission.id)),
    });
    if (!existingLink) {
      await db.insert(rolePermissions).values({ roleId: retailerRole.id, permissionId: permission.id });
    }
  }

  const allowedPermissionIds = new Set(retailerPermissionRows.map((p) => p.id));
  const currentRetailerLinks = await db.query.rolePermissions.findMany({ where: eq(rolePermissions.roleId, retailerRole.id) });
  const extraLinks = currentRetailerLinks.filter((link) => !allowedPermissionIds.has(link.permissionId));
  for (const link of extraLinks) {
    await db.delete(rolePermissions).where(eq(rolePermissions.id, link.id));
  }
  if (extraLinks.length > 0) {
    console.log(`Removed ${extraLinks.length} out-of-spec permission grant(s) from the Retailer role (pre-existing over-broad state).`);
  }

  // PHASE_9_TASKS.md Group 0 — real catalog data (Shoulder Type/Monogram Position render
  // slots) plus the one-time is_required backfill onto existing text/structured/piping
  // features. Idempotent, safe on every seed run; feature_products links are skipped (and
  // logged) for whichever of jacket/tuxedojacket/shirt/overcoat don't exist yet on a fresh
  // dev/CI database — `backfill:phase9-group0` re-runs this against the real production
  // tenant once `etl:production` has populated real products.
  console.log("Backfilling features.is_required...");
  console.log(summarizeDomain(await backfillFeatureRequiredFlags(tenant.id)));

  console.log("Backfilling features.render_slot (Piping)...");
  console.log(summarizeDomain(await backfillPipingRenderSlot(tenant.id)));

  console.log("Backfilling feature_products.sequence_order (Fabric before Lining Code)...");
  console.log(summarizeDomain(await backfillFabricLiningSequenceOrder(tenant.id)));

  console.log("Seeding render-slot catalog features (Shoulder Type / Monogram Position)...");
  for (const result of await seedRenderSlotFeatures(tenant.id)) {
    console.log(summarizeDomain(result));
  }

  console.log("Seed complete.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
