import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/index";
import { rolePermissions, roles, tenants, userRoles, users } from "../db/schema/index";
import { permissionCatalog } from "../db/seed/permissions";
import { hashPassword } from "./auth.service";
import { resolveUserPermissions } from "./permissions.service";

const suffix = randomUUID();

describe("resolveUserPermissions", () => {
  let tenantId: string;
  let limitedRoleId: string;
  let limitedUserId: string;
  const limitedPermissionKeys = ["orders.view", "invoices.view"];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const [limitedRole] = await db
      .insert(roles)
      .values({ tenantId, name: `Limited-${suffix}` })
      .returning();
    if (!limitedRole) throw new Error("Failed to create Limited role");
    limitedRoleId = limitedRole.id;

    const limitedPermissionRows = await db.query.permissions.findMany({
      where: (p, { inArray }) => inArray(p.key, limitedPermissionKeys),
    });
    expect(limitedPermissionRows).toHaveLength(limitedPermissionKeys.length);
    for (const permission of limitedPermissionRows) {
      await db.insert(rolePermissions).values({ roleId: limitedRoleId, permissionId: permission.id });
    }

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [limitedUser] = await db
      .insert(users)
      .values({ tenantId, name: "Limited Test User", username: `limited-${suffix}`, passwordHash })
      .returning();
    if (!limitedUser) throw new Error("Failed to create limited test user");
    limitedUserId = limitedUser.id;

    await db.insert(userRoles).values({ userId: limitedUserId, roleId: limitedRoleId });
  });

  afterAll(async () => {
    await db.delete(userRoles).where(eq(userRoles.userId, limitedUserId));
    await db.delete(users).where(eq(users.id, limitedUserId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, limitedRoleId));
    await db.delete(roles).where(eq(roles.id, limitedRoleId));
  });

  it("resolves the seeded Owner-role admin user to the full permission catalog minus orders.create", async () => {
    // PHASE_10_TASKS.md Workstream E Group 5: the seeded Owner role holds every permission
    // EXCEPT orders.create (order creation is Retailer-only) — an exclusion, not an
    // allowlist, so Owner still auto-gains any future permission added to the catalog.
    const admin = await db.query.users.findFirst({
      where: (u, { and, eq: eqOp }) => and(eqOp(u.tenantId, tenantId), eqOp(u.username, "admin")),
    });
    if (!admin) throw new Error("Expected seeded 'admin' user — run db:seed first");

    const resolved = await resolveUserPermissions(admin.id);

    expect(permissionCatalog).toHaveLength(30);
    expect(resolved.size).toBe(permissionCatalog.length - 1);
    expect(resolved.has("orders.create")).toBe(false);
    expect(resolved.has("orders.edit")).toBe(true);
    expect(resolved.has("factory.payroll.settle")).toBe(true);
    expect(resolved.has("rbac.roles.manage")).toBe(true);
    for (const permission of permissionCatalog) {
      if (permission.key === "orders.create") continue;
      expect(resolved.has(permission.key)).toBe(true);
    }
  });

  it("resolves a deliberately-limited role to only its granted permissions", async () => {
    const resolved = await resolveUserPermissions(limitedUserId);

    expect(resolved.size).toBe(2);
    expect(resolved.has("orders.view")).toBe(true);
    expect(resolved.has("invoices.view")).toBe(true);
    expect(resolved.has("orders.create")).toBe(false);
    expect(resolved.has("rbac.roles.manage")).toBe(false);
  });

  it("resolves a user with no roles to an empty set", async () => {
    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [roleless] = await db
      .insert(users)
      .values({ tenantId, name: "Roleless Test User", username: `roleless-${suffix}`, passwordHash })
      .returning();
    if (!roleless) throw new Error("Failed to create roleless test user");

    try {
      const resolved = await resolveUserPermissions(roleless.id);
      expect(resolved.size).toBe(0);
    } finally {
      await db.delete(users).where(eq(users.id, roleless.id));
    }
  });
});
