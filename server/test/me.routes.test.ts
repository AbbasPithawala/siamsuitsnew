import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { tailors, tenants } from "../src/db/schema/index";
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
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
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

  it("401s with no token", async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(401);
  });

  it("401s with an invalid token", async () => {
    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: "Bearer not-a-real-token" } });
    expect(res.status).toBe(401);
  });
});
