import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index";
import { permissions, rolePermissions, roles, userRoles } from "../db/schema/index";

/**
 * Resolves the full set of permission keys a user holds across all of their roles.
 * Not request-cached — if this join ever shows up as a real cost, cache it per-request
 * (a user's permissions don't change mid-request), not globally (roles/permissions can
 * change between requests).
 */
export async function resolveUserPermissions(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), isNull(roles.deletedAt)));

  return new Set(rows.map((row) => row.key));
}
