import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { permissions, rolePermissions, roles } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export interface CreateRoleInput {
  name: string;
}

export type UpdateRoleInput = Partial<CreateRoleInput>;

/** `roles` carries `tenant_id` and an RLS policy, so resolving it through a `withTenant`-scoped `tx` already proves tenant ownership — see `catalog-helpers.ts` for the same pattern. */
export async function requireRole(tx: Transaction, roleId: string) {
  const role = await tx.query.roles.findFirst({
    where: (r, { and: andOp, eq: eqOp, isNull: isNullOp }) => andOp(eqOp(r.id, roleId), isNullOp(r.deletedAt)),
  });
  if (!role) throw new HttpError(404, "ROLE_NOT_FOUND", `Role ${roleId} not found`);
  return role;
}

/** `permissions` is a global catalog table, not tenant-scoped — no RLS check applies when resolving it. */
async function requirePermissionRecord(tx: Transaction, permissionId: string) {
  const permission = await tx.query.permissions.findFirst({ where: eq(permissions.id, permissionId) });
  if (!permission) throw new HttpError(404, "PERMISSION_NOT_FOUND", `Permission ${permissionId} not found`);
  return permission;
}

async function withPermissions(tx: Transaction, roleId: string) {
  const links = await tx.query.rolePermissions.findMany({
    where: eq(rolePermissions.roleId, roleId),
    with: { permission: true },
  });
  return links.map((link) => link.permission);
}

export function createRole(tenantId: string, input: CreateRoleInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const [role] = await tx.insert(roles).values({ tenantId, ...input }).returning();
        if (!role) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create role");
        return role;
      },
      "ROLE_NAME_TAKEN",
      `A role named "${input.name}" already exists`
    )
  );
}

export function listRoles(tenantId: string, pagination: PaginationParams = DEFAULT_PAGINATION) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(roles.deletedAt);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.roles.findMany({ where, orderBy: (r, { asc }) => asc(r.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(roles).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

export function getRole(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const role = await requireRole(tx, id);
    return { ...role, permissions: await withPermissions(tx, id) };
  });
}

export function updateRole(tenantId: string, id: string, input: UpdateRoleInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireRole(tx, id);
        const [updated] = await tx
          .update(roles)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(roles.id, id))
          .returning();
        if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update role");
        return { ...updated, permissions: await withPermissions(tx, id) };
      },
      "ROLE_NAME_TAKEN",
      `A role named "${input.name}" already exists`
    )
  );
}

export function softDeleteRole(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const role = await requireRole(tx, id);
    if (role.isSystem) {
      throw new HttpError(409, "SYSTEM_ROLE_PROTECTED", `Role ${id} is the tenant's system role and cannot be deleted`);
    }
    await tx.update(roles).set({ deletedAt: new Date() }).where(eq(roles.id, id));
  });
}

/**
 * Granting a role the same permission twice is an explicit 409 conflict, not a silent
 * no-op — same posture as `tailors.service.ts`'s `certifyTailor`/`ALREADY_CERTIFIED`.
 */
export function addPermission(tenantId: string, roleId: string, permissionId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireRole(tx, roleId);
    await requirePermissionRecord(tx, permissionId);

    const existing = await tx.query.rolePermissions.findFirst({
      where: and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)),
    });
    if (existing) {
      throw new HttpError(409, "ALREADY_GRANTED", `Role ${roleId} already has permission ${permissionId}`);
    }

    await catchUniqueViolation(
      () => tx.insert(rolePermissions).values({ roleId, permissionId }),
      "ALREADY_GRANTED",
      `Role ${roleId} already has permission ${permissionId}`
    );

    return withPermissions(tx, roleId);
  });
}

export function removePermission(tenantId: string, roleId: string, permissionId: string) {
  return withTenant(tenantId, async (tx) => {
    const role = await requireRole(tx, roleId);
    if (role.isSystem) {
      throw new HttpError(409, "SYSTEM_ROLE_PROTECTED", `Role ${roleId} is the tenant's system role and its permissions cannot be removed`);
    }

    const existing = await tx.query.rolePermissions.findFirst({
      where: and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)),
    });
    if (!existing) {
      throw new HttpError(404, "NOT_GRANTED", `Role ${roleId} does not have permission ${permissionId}`);
    }

    await tx.delete(rolePermissions).where(eq(rolePermissions.id, existing.id));

    return withPermissions(tx, roleId);
  });
}
