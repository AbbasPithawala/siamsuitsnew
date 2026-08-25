import { randomUUID } from "node:crypto";
import http from "node:http";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { db } from "../db/index";
import { rolePermissions, roles, tenants, userRoles, users } from "../db/schema/index";
import { hashPassword, issueToken } from "../services/auth.service";

const suffix = randomUUID();

/**
 * PHASE_10_TASKS.md Workstream E Group 3 — `shipping.routes.ts`'s GETs must accept
 * EITHER `shipping.view` (retailer-safe, read-only) OR `shipping.manage` (factory-floor
 * pack/close); only `shipping.manage` may reach the write routes.
 */
describe("shipping.routes — shipping.view / shipping.manage OR-gating", () => {
  let baseUrl: string;
  let server: http.Server;

  let tenantId: string;
  let viewOnlyRoleId: string;
  let manageRoleId: string;
  let neitherRoleId: string;
  let viewOnlyUserId: string;
  let manageUserId: string;
  let neitherUserId: string;

  let viewOnlyToken: string;
  let manageToken: string;
  let neitherToken: string;

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const shippingViewPermission = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "shipping.view") });
    const shippingManagePermission = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "shipping.manage") });
    if (!shippingViewPermission) throw new Error("Expected seeded 'shipping.view' permission — run db:seed first");
    if (!shippingManagePermission) throw new Error("Expected seeded 'shipping.manage' permission — run db:seed first");

    const [viewOnlyRole] = await db.insert(roles).values({ tenantId, name: `ShipView-${suffix}` }).returning();
    const [manageRole] = await db.insert(roles).values({ tenantId, name: `ShipManage-${suffix}` }).returning();
    const [neitherRole] = await db.insert(roles).values({ tenantId, name: `ShipNeither-${suffix}` }).returning();
    if (!viewOnlyRole || !manageRole || !neitherRole) throw new Error("Failed to create test roles");
    viewOnlyRoleId = viewOnlyRole.id;
    manageRoleId = manageRole.id;
    neitherRoleId = neitherRole.id;

    await db.insert(rolePermissions).values({ roleId: viewOnlyRoleId, permissionId: shippingViewPermission.id });
    await db.insert(rolePermissions).values({ roleId: manageRoleId, permissionId: shippingManagePermission.id });

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [viewOnlyUser] = await db
      .insert(users)
      .values({ tenantId, name: "Ship View Test User", username: `ship-view-${suffix}`, passwordHash })
      .returning();
    const [manageUser] = await db
      .insert(users)
      .values({ tenantId, name: "Ship Manage Test User", username: `ship-manage-${suffix}`, passwordHash })
      .returning();
    const [neitherUser] = await db
      .insert(users)
      .values({ tenantId, name: "Ship Neither Test User", username: `ship-neither-${suffix}`, passwordHash })
      .returning();
    if (!viewOnlyUser || !manageUser || !neitherUser) throw new Error("Failed to create test users");
    viewOnlyUserId = viewOnlyUser.id;
    manageUserId = manageUser.id;
    neitherUserId = neitherUser.id;

    await db.insert(userRoles).values({ userId: viewOnlyUserId, roleId: viewOnlyRoleId });
    await db.insert(userRoles).values({ userId: manageUserId, roleId: manageRoleId });
    await db.insert(userRoles).values({ userId: neitherUserId, roleId: neitherRoleId });

    viewOnlyToken = issueToken({ sub: viewOnlyUserId, tenantId, actorType: "user" });
    manageToken = issueToken({ sub: manageUserId, tenantId, actorType: "user" });
    neitherToken = issueToken({ sub: neitherUserId, tenantId, actorType: "user" });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

    await db.delete(userRoles).where(eq(userRoles.userId, viewOnlyUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, manageUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, neitherUserId));
    await db.delete(users).where(eq(users.id, viewOnlyUserId));
    await db.delete(users).where(eq(users.id, manageUserId));
    await db.delete(users).where(eq(users.id, neitherUserId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, viewOnlyRoleId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, manageRoleId));
    await db.delete(roles).where(eq(roles.id, viewOnlyRoleId));
    await db.delete(roles).where(eq(roles.id, manageRoleId));
    await db.delete(roles).where(eq(roles.id, neitherRoleId));
  });

  it("allows a shipping.view-only session through GET /shipping-boxes", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, { headers: { Authorization: `Bearer ${viewOnlyToken}` } });
    expect(res.status).toBe(200);
  });

  it("allows a shipping.manage session through GET /shipping-boxes (unaffected by the added OR)", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, { headers: { Authorization: `Bearer ${manageToken}` } });
    expect(res.status).toBe(200);
  });

  it("403s a session holding neither permission on GET /shipping-boxes", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, { headers: { Authorization: `Bearer ${neitherToken}` } });
    expect(res.status).toBe(403);
  });

  it("403s a shipping.view-only session on the write route POST /shipping-boxes — view never implies manage", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${viewOnlyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ retailerId: randomUUID() }),
    });
    expect(res.status).toBe(403);
  });
});
