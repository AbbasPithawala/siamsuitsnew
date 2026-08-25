import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../index";
import { permissions, rolePermissions, roles } from "../schema/index";

/**
 * PHASE_10_TASKS.md Workstream E Group 3 — the seeded "Retailer" role, run against a
 * real `db:seed` (not re-created here: this asserts on what the seed script itself
 * already produced in this test database).
 */
describe("seeded Retailer role", () => {
  const expectedPermissionKeys = [
    "customers.manage",
    "orders.create",
    "orders.view",
    "orders.repeat",
    "orders.group.create",
    "invoices.view",
    "shipping.view",
  ];

  it("exists, per-tenant, and is not a system role — run db:seed first if this fails", async () => {
    const role = await db.query.roles.findFirst({ where: eq(roles.name, "Retailer") });
    expect(role).toBeTruthy();
    expect(role?.isSystem).toBe(false);
    expect(role?.deletedAt).toBeNull();
  });

  it("holds exactly the mandated permission bundle — no more, no less", async () => {
    const role = await db.query.roles.findFirst({ where: eq(roles.name, "Retailer") });
    if (!role) throw new Error("Expected seeded 'Retailer' role — run db:seed first");

    const links = await db.query.rolePermissions.findMany({ where: eq(rolePermissions.roleId, role.id) });
    const grantedPermissions = await Promise.all(
      links.map((link) => db.query.permissions.findFirst({ where: eq(permissions.id, link.permissionId) }))
    );
    const grantedKeys = grantedPermissions.map((p) => p?.key).filter((key): key is string => !!key);

    expect(grantedKeys.sort()).toEqual([...expectedPermissionKeys].sort());
  });

  it("holds zero catalog.*.manage grants — the actual enforcement point of Decision 4", async () => {
    const role = await db.query.roles.findFirst({ where: eq(roles.name, "Retailer") });
    if (!role) throw new Error("Expected seeded 'Retailer' role — run db:seed first");

    const links = await db.query.rolePermissions.findMany({ where: eq(rolePermissions.roleId, role.id) });
    const grantedPermissions = await Promise.all(
      links.map((link) => db.query.permissions.findFirst({ where: eq(permissions.id, link.permissionId) }))
    );

    const catalogManageGrants = grantedPermissions.filter((p) => p?.key.startsWith("catalog.") && p.key.endsWith(".manage"));
    expect(catalogManageGrants).toEqual([]);
  });
});
