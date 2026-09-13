import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { withTenant } from "../db/withTenant";
import { permissions, rolePermissions, roles, tenants, userRoles, users } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { omit } from "../utils/object";
import { generateTemporaryPassword, hashPassword } from "./auth.service";

/**
 * PHASE_10_TASKS.md Workstream E Group 5's carve-out, lifted verbatim from `db/seed/index.ts`:
 * Owner manages the shop but does not place orders themselves — only the Retailer role does.
 */
const ownerExcludedPermissionKeys = ["orders.create"];

/**
 * Every provisioned owner gets the same fixed username, mirroring the seed script's own
 * "admin" convention (uniqueness is per-tenant, `users.tenant_id`+`username`, so this never
 * collides across tenants) — shared by both `provisionTenant()` callers (approve-request and
 * direct superadmin creation), neither of which collects a distinct owner username.
 */
export const PROVISIONED_OWNER_USERNAME = "owner";

export interface ProvisionTenantInput {
  businessName: string;
  slug: string;
  plan?: string;
  ownerName: string;
  ownerEmail: string;
  ownerUsername: string;
  tempPassword?: string;
  mustChangePassword?: boolean;
  profileFields?: {
    logo?: string;
    address?: string;
    invoiceFooterText?: string;
  };
}

export interface ProvisionTenantResult {
  tenant: typeof tenants.$inferSelect;
  ownerUser: Omit<typeof users.$inferSelect, "passwordHash">;
  tempPassword: string;
}

/**
 * Real, live-route-invoked application code (PHASE_11_TASKS.md Workstream C, Decision C1) —
 * unlike the seed script this was extracted from, it cannot write to RLS-protected tables via
 * the plain, superuser-authenticated `db` object. Only the initial `tenants` insert (no
 * `tenant_id`/RLS on that row itself) is a plain write; everything after — the Owner role,
 * its permission grants, the owner `users` row, the `userRoles` link — runs inside one
 * `withTenant(tenant.id, ...)` transaction, exactly like every other service function here.
 *
 * Not a single atomic transaction spanning both halves (`withTenant` always opens its own
 * transaction — see its own doc comment). Partial-failure handling is idempotent retry
 * instead (C3): mirrors `db/seed/index.ts`'s own check-then-create pattern at every step, so
 * a retried call after a transient failure resumes cleanly instead of duplicating.
 */
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  let tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, input.slug) });
  // A slug match alone isn't sufficient to treat this as C3's "resume a partially-failed
  // retry of this exact call" case — `businessName` is never itself overridable (only
  // slug/plan/profileFields are, per C5), so a genuine retry of the same provisioning attempt
  // always carries the same businessName as whatever's already on the row. A different
  // businessName on the same slug means an unrelated tenant already holds it — a real C5
  // collision, not a resumable retry — and must 409, not silently reuse the wrong tenant
  // (which, before this check, could otherwise hand back a fabricated `tempPassword` for an
  // owner user whose real password was never touched).
  if (tenant && tenant.name !== input.businessName) {
    throw new HttpError(409, "TENANT_SLUG_TAKEN", `A tenant with slug "${input.slug}" already exists`);
  }
  if (!tenant) {
    const profileFields = input.profileFields;
    const profileFieldsProvided =
      profileFields !== undefined &&
      (profileFields.logo !== undefined || profileFields.address !== undefined || profileFields.invoiceFooterText !== undefined);

    [tenant] = await catchUniqueViolation(
      () =>
        db
          .insert(tenants)
          .values({
            name: input.businessName,
            slug: input.slug,
            ...(input.plan !== undefined ? { plan: input.plan } : {}),
            ...(profileFieldsProvided ? { ...profileFields, profileCompleted: true } : {}),
          })
          .returning(),
      "TENANT_SLUG_TAKEN",
      `A tenant with slug "${input.slug}" already exists`
    );
  }
  if (!tenant) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create tenant");
  const tenantId = tenant.id;

  const tempPassword = input.tempPassword ?? generateTemporaryPassword();
  const mustChangePassword = input.mustChangePassword ?? true;

  const ownerUser = await withTenant(tenantId, async (tx) => {
    let ownerRole = await tx.query.roles.findFirst({
      where: and(eq(roles.tenantId, tenantId), eq(roles.name, "Owner")),
    });
    if (!ownerRole) {
      [ownerRole] = await tx.insert(roles).values({ tenantId, name: "Owner", isSystem: true }).returning();
    }
    if (!ownerRole) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create Owner role");
    const ownerRoleId = ownerRole.id;

    const allPermissions = await tx.query.permissions.findMany();
    for (const permission of allPermissions) {
      if (ownerExcludedPermissionKeys.includes(permission.key)) continue;
      const existingLink = await tx.query.rolePermissions.findFirst({
        where: and(eq(rolePermissions.roleId, ownerRoleId), eq(rolePermissions.permissionId, permission.id)),
      });
      if (!existingLink) {
        await tx.insert(rolePermissions).values({ roleId: ownerRoleId, permissionId: permission.id });
      }
    }

    // Reconcile, not just top-up (mirrors `db/seed/index.ts`'s own Retailer-role reconciliation):
    // a pre-existing Owner role from before this carve-out existed may already hold an
    // excluded permission — strip it, so re-running provisioning against an older role
    // converges it to exactly "all permissions except the carve-out."
    const excludedPermissionRows = allPermissions.filter((p) => ownerExcludedPermissionKeys.includes(p.key));
    const excludedPermissionIds = new Set(excludedPermissionRows.map((p) => p.id));
    if (excludedPermissionIds.size > 0) {
      const currentLinks = await tx.query.rolePermissions.findMany({ where: eq(rolePermissions.roleId, ownerRoleId) });
      const extraLinks = currentLinks.filter((link) => excludedPermissionIds.has(link.permissionId));
      for (const link of extraLinks) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.id, link.id));
      }
    }

    let ownerUserRow = await tx.query.users.findFirst({
      where: and(eq(users.tenantId, tenantId), eq(users.username, input.ownerUsername)),
    });
    if (!ownerUserRow) {
      const passwordHash = await hashPassword(tempPassword);
      [ownerUserRow] = await tx
        .insert(users)
        .values({ tenantId, name: input.ownerName, username: input.ownerUsername, passwordHash, mustChangePassword })
        .returning();
    }
    if (!ownerUserRow) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create owner user");
    const ownerUserId = ownerUserRow.id;

    const existingRoleLink = await tx.query.userRoles.findFirst({
      where: and(eq(userRoles.userId, ownerUserId), eq(userRoles.roleId, ownerRoleId)),
    });
    if (!existingRoleLink) {
      await tx.insert(userRoles).values({ userId: ownerUserId, roleId: ownerRoleId });
    }

    return ownerUserRow;
  });

  return { tenant, ownerUser: omit(ownerUser, ["passwordHash"]), tempPassword };
}
