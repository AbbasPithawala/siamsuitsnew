import { randomUUID } from "node:crypto";
import http from "node:http";
import { eq } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/index";
import { rolePermissions, roles, tailors, tenants, userRoles, users } from "../db/schema/index";
import { hashPassword, issueToken } from "../services/auth.service";
import { authenticate } from "./authenticate";
import { requirePermission } from "./requirePermission";

const suffix = randomUUID();

const HAS_PERMISSION = "orders.view";
const LACKS_PERMISSION = "rbac.roles.manage";

describe("requirePermission", () => {
  let baseUrl: string;
  let server: http.Server;

  let tenantId: string;
  let limitedRoleId: string;
  let limitedUserId: string;
  let tailorId: string;

  let ownerAdminToken: string;
  let limitedUserToken: string;
  let tailorToken: string;

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const admin = await db.query.users.findFirst({
      where: (u, { and, eq: eqOp }) => and(eqOp(u.tenantId, tenantId), eqOp(u.username, "admin")),
    });
    if (!admin) throw new Error("Expected seeded 'admin' user — run db:seed first");
    ownerAdminToken = issueToken({ sub: admin.id, tenantId, actorType: "user" });

    const [limitedRole] = await db
      .insert(roles)
      .values({ tenantId, name: `Limited-mw-${suffix}` })
      .returning();
    if (!limitedRole) throw new Error("Failed to create Limited role");
    limitedRoleId = limitedRole.id;

    const hasPermissionRow = await db.query.permissions.findFirst({
      where: (p, { eq: eqOp }) => eqOp(p.key, HAS_PERMISSION),
    });
    if (!hasPermissionRow) throw new Error(`Expected seeded permission '${HAS_PERMISSION}'`);
    await db.insert(rolePermissions).values({ roleId: limitedRoleId, permissionId: hasPermissionRow.id });

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [limitedUser] = await db
      .insert(users)
      .values({ tenantId, name: "Limited MW Test User", username: `limited-mw-${suffix}`, passwordHash })
      .returning();
    if (!limitedUser) throw new Error("Failed to create limited test user");
    limitedUserId = limitedUser.id;
    await db.insert(userRoles).values({ userId: limitedUserId, roleId: limitedRoleId });
    limitedUserToken = issueToken({ sub: limitedUserId, tenantId, actorType: "user" });

    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "Test Tailor", username: `tailor-mw-${suffix}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;
    tailorToken = issueToken({ sub: tailorId, tenantId, actorType: "tailor" });

    const app = express();
    app.get("/protected-has", authenticate, requirePermission(HAS_PERMISSION), (_req, res) => {
      res.status(200).json({ data: { ok: true } });
    });
    app.get("/protected-lacks", authenticate, requirePermission(LACKS_PERMISSION), (_req, res) => {
      res.status(200).json({ data: { ok: true } });
    });
    app.use((err: { status?: number; code?: string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.status ?? 500).json({ error: { message: err.message ?? "error", code: err.code ?? "INTERNAL_ERROR" } });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

    await db.delete(userRoles).where(eq(userRoles.userId, limitedUserId));
    await db.delete(users).where(eq(users.id, limitedUserId));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, limitedRoleId));
    await db.delete(roles).where(eq(roles.id, limitedRoleId));
  });

  it("allows the Owner-role admin through a route requiring a permission it has", async () => {
    const res = await fetch(`${baseUrl}/protected-has`, {
      headers: { Authorization: `Bearer ${ownerAdminToken}` },
    });
    expect(res.status).toBe(200);
  });

  it("allows the Owner-role admin through a route requiring a permission the limited role lacks", async () => {
    const res = await fetch(`${baseUrl}/protected-lacks`, {
      headers: { Authorization: `Bearer ${ownerAdminToken}` },
    });
    expect(res.status).toBe(200);
  });

  it("allows the limited-role user through a route requiring a permission it has", async () => {
    const res = await fetch(`${baseUrl}/protected-has`, {
      headers: { Authorization: `Bearer ${limitedUserToken}` },
    });
    expect(res.status).toBe(200);
  });

  it("403s the limited-role user on a route requiring a permission it lacks", async () => {
    const res = await fetch(`${baseUrl}/protected-lacks`, {
      headers: { Authorization: `Bearer ${limitedUserToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("403s a tailor-issued token against any permission-protected route", async () => {
    const res = await fetch(`${baseUrl}/protected-has`, {
      headers: { Authorization: `Bearer ${tailorToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/protected-has`);
    expect(res.status).toBe(401);
  });
});
