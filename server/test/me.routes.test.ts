import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers, retailerUsers, tailors, tenants, users } from "../src/db/schema/index";
import { permissionCatalog } from "../src/db/seed/permissions";
import { hashPassword, issueToken } from "../src/services/auth.service";

/**
 * Integration test against the real local dev Postgres database, exercising the seeded
 * admin user (full permission catalog) and a freshly created tailor (no permissions —
 * see PHASE_3_TASKS.md Group 0's decision that tailors have no permission system).
 */
describe("GET /api/me", () => {
  let server: Server;
  let baseUrl: string;

  let tenantId: string;
  let adminToken: string;

  let tailorId: string;
  let tailorToken: string;
  const tailorSuffix = randomUUID();

  let retailerId: string;
  let retailerUserId: string;
  let retailerUserToken: string;
  const retailerSuffix = randomUUID();

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const admin = await db.query.users.findFirst({
      where: (u, { and, eq: eqOp }) => and(eqOp(u.tenantId, tenantId), eqOp(u.username, "admin")),
    });
    if (!admin) throw new Error("Expected seeded 'admin' user — run db:seed first");
    adminToken = issueToken({ sub: admin.id, tenantId, actorType: "user" });

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "Me Route Test Tailor", username: `me-route-${tailorSuffix}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;
    tailorToken = issueToken({ sub: tailorId, tenantId, actorType: "tailor" });

    const [retailer] = await db
      .insert(retailers)
      .values({
        tenantId,
        name: `Me Route Retailer ${retailerSuffix}`,
        code: `MRR-${retailerSuffix.slice(0, 6)}`,
        logo: `/uploads/retailer-logos/${retailerSuffix}.png`,
      })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const [retailerUser] = await db
      .insert(users)
      .values({ tenantId, name: "Me Route Retailer User", username: `me-route-retailer-${retailerSuffix}`, passwordHash })
      .returning();
    if (!retailerUser) throw new Error("Failed to create test retailer-linked user");
    retailerUserId = retailerUser.id;
    await db.insert(retailerUsers).values({ retailerId, userId: retailerUserId });
    retailerUserToken = issueToken({ sub: retailerUserId, tenantId, actorType: "user" });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(retailerUsers).where(eq(retailerUsers.retailerId, retailerId));
    await db.delete(users).where(eq(users.id, retailerUserId));
    await db.delete(retailers).where(eq(retailers.id, retailerId));
  });

  it("returns the seeded admin's permission set (every permission except orders.create)", async () => {
    // PHASE_10_TASKS.md Workstream E Group 5: Owner is an exclusion list ("all permissions
    // except orders.create"), not an allowlist — order creation is Retailer-only.
    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: { id: string; name: string; username: string; actorType: string; tenantId: string; permissions: string[] };
    };
    expect(body.data.username).toBe("admin");
    expect(body.data.actorType).toBe("user");
    expect(body.data.tenantId).toBe(tenantId);
    expect(body.data.name).toBeTruthy();
    expect(body.data).not.toHaveProperty("passwordHash");

    expect(permissionCatalog).toHaveLength(30);
    expect(body.data.permissions).toHaveLength(29);
    expect(body.data.permissions).not.toContain("orders.create");
    for (const permission of permissionCatalog) {
      if (permission.key === "orders.create") continue;
      expect(body.data.permissions).toContain(permission.key);
    }
  });

  it("returns an empty permission array for a tailor", async () => {
    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${tailorToken}` } });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: { id: string; name: string; username: string; actorType: string; tenantId: string; permissions: string[] };
    };
    expect(body.data.id).toBe(tailorId);
    expect(body.data.username).toBe(`me-route-${tailorSuffix}`);
    expect(body.data.actorType).toBe("tailor");
    expect(body.data.tenantId).toBe(tenantId);
    expect(body.data.permissions).toEqual([]);
    expect(body.data).not.toHaveProperty("passwordHash");
  });

  it("header branding: a non-retailer-linked staff user gets the tenant's own logo", async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });

    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const body = (await res.json()) as { data: { retailerId: string | null; logo: string | null } };
    expect(body.data.retailerId).toBeNull();
    expect(body.data.logo).toBe(tenant?.logo ?? null);
  });

  it("header branding: a retailer-linked user gets their own retailer's logo, not the tenant's", async () => {
    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${retailerUserToken}` } });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { retailerId: string | null; logo: string | null } };
    expect(body.data.retailerId).toBe(retailerId);
    expect(body.data.logo).toBe(`/uploads/retailer-logos/${retailerSuffix}.png`);
  });

  it("header branding: a tailor always gets a null logo", async () => {
    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${tailorToken}` } });
    const body = (await res.json()) as { data: { logo: string | null } };
    expect(body.data.logo).toBeNull();
  });

  it("401s with no token", async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(401);
  });

  it("401s with an invalid token", async () => {
    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: "Bearer not-a-real-token" } });
    expect(res.status).toBe(401);
  });
});
