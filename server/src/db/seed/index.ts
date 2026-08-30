import { db } from "../index";
import { permissions, roles, rolePermissions, tenants, users, userRoles } from "../schema/index";
import { permissionCatalog } from "./permissions";
import { hashPassword } from "../../services/auth.service";
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

  console.log("Seeding default tenant...");
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, "siam-suits"),
  });
  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({ name: "Siam Suits", slug: "siam-suits", plan: "standard" })
      .returning();
  }
  if (!tenant) {
    throw new Error("Failed to create default tenant");
  }

  console.log("Seeding default Owner role...");
  // Matched by (tenantId, name) — not tenantId alone. With enough other roles accumulated
  // on this tenant (test roles, "Retailer", etc.), an unfiltered `findFirst` isn't
  // guaranteed to return the actual Owner role, since Postgres makes no row-order
  // guarantee without `ORDER BY`.
  let ownerRole = await db.query.roles.findFirst({
    where: and(eq(roles.tenantId, tenant.id), eq(roles.name, "Owner")),
  });
  if (!ownerRole) {
    [ownerRole] = await db.insert(roles).values({ tenantId: tenant.id, name: "Owner", isSystem: true }).returning();
  } else if (!ownerRole.isSystem) {
    // Backfill for a role seeded before `isSystem` existed (PHASE_8_TASKS.md Group 3).
    [ownerRole] = await db.update(roles).set({ isSystem: true }).where(eq(roles.id, ownerRole.id)).returning();
  }
  if (!ownerRole) {
    throw new Error("Failed to create Owner role");
  }

  // PHASE_10_TASKS.md Workstream E Group 5 decision (2026-08-19): the tenant Owner manages
  // the shop but does not place orders themselves — only the Retailer role does
  // (`orders.create`). Owner keeps every other permission, including `orders.edit` once
  // Group 6 introduces it — this is a single named carve-out from "all permissions", not a
  // move to an explicit allowlist, so Owner still auto-gains any future permission. A
  // separate cross-tenant "super admin" concept (managing tenants themselves) was raised
  // but explicitly deferred — not implemented here.
  const ownerExcludedPermissionKeys = ["orders.create"];

  const allPermissions = await db.query.permissions.findMany();
  for (const permission of allPermissions) {
    if (ownerExcludedPermissionKeys.includes(permission.key)) {
      continue;
    }
    const existingLink = await db.query.rolePermissions.findFirst({
      where: (rp, { and, eq }) => and(eq(rp.roleId, ownerRole!.id), eq(rp.permissionId, permission.id)),
    });
    if (!existingLink) {
      await db.insert(rolePermissions).values({ roleId: ownerRole.id, permissionId: permission.id });
    }
  }

  // Reconcile (not just top-up): the pre-Group-5 seed granted Owner literally every
  // permission, so a real dev/prod Owner role likely already holds `orders.create` from
  // before this decision — strip it, mirroring the Retailer role's own reconciliation below.
  const ownerExcludedPermissionRows = await db.query.permissions.findMany({
    where: (p, { inArray }) => inArray(p.key, ownerExcludedPermissionKeys),
  });
  const ownerExcludedPermissionIds = new Set(ownerExcludedPermissionRows.map((p) => p.id));
  const currentOwnerLinks = await db.query.rolePermissions.findMany({ where: eq(rolePermissions.roleId, ownerRole.id) });
  const ownerExtraLinks = currentOwnerLinks.filter((link) => ownerExcludedPermissionIds.has(link.permissionId));
  for (const link of ownerExtraLinks) {
    await db.delete(rolePermissions).where(eq(rolePermissions.id, link.id));
  }
  if (ownerExtraLinks.length > 0) {
    console.log(`Removed ${ownerExtraLinks.length} excluded permission grant(s) (orders.create) from the Owner role.`);
  }

  console.log("Seeding default admin user...");
  let adminUser = await db.query.users.findFirst({
    where: and(eq(users.tenantId, tenant.id), eq(users.username, "admin")),
  });
  if (!adminUser) {
    const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
    [adminUser] = await db
      .insert(users)
      .values({ tenantId: tenant.id, name: "Admin", username: "admin", passwordHash })
      .returning();
    console.log(`Created admin user "admin" with password "${SEED_ADMIN_PASSWORD}" — change this after first login.`);
  }
  if (!adminUser) {
    throw new Error("Failed to create admin user");
  }

  const existingAdminRoleLink = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, adminUser.id), eq(userRoles.roleId, ownerRole.id)),
  });
  if (!existingAdminRoleLink) {
    await db.insert(userRoles).values({ userId: adminUser.id, roleId: ownerRole.id });
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
