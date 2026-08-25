import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailerUsers, retailers, tailors, tenants, userRoles, users } from "../src/db/schema/index";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("retailer user identity resolution (PHASE_10_TASKS.md Workstream E Group 0/1)", () => {
  let server: Server;
  let baseUrl: string;

  let manager: Awaited<ReturnType<typeof createTenantWithUser>>;
  let tenantSlug: string;

  const createdUserIds: string[] = [];
  const createdRetailerIds: string[] = [];
  const createdTailorIds: string[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    manager = await createTenantWithUser(["tenant.users.manage", "retailers.manage", "factory.tailors.manage"]);

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, manager.tenantId) });
    if (!tenant) throw new Error("Failed to resolve tenant");
    tenantSlug = tenant.slug;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of createdUserIds) {
      await db.delete(retailerUsers).where(eq(retailerUsers.userId, id));
      await db.delete(userRoles).where(eq(userRoles.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
    for (const id of createdTailorIds) {
      await db.delete(tailors).where(eq(tailors.id, id));
    }
    for (const id of createdRetailerIds) {
      await db.delete(retailers).where(eq(retailers.id, id));
    }
    await manager.cleanup();
  });

  async function createRetailer() {
    const suffix = randomUUID();
    const res = await fetch(`${baseUrl}/api/retailers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` },
      body: JSON.stringify({ name: `Retailer ${suffix}`, code: `R-${suffix.slice(0, 8)}` }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    createdRetailerIds.push(body.data.id);
    return body.data;
  }

  async function createUser(overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID();
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` },
      body: JSON.stringify({ name: `Test User ${suffix}`, username: `ru-${suffix}`, password: "Sup3rSecret!", ...overrides }),
    });
    const body = (await res.json()) as { data: { id: string; username: string; retailerId: string | null } };
    if (res.status === 201) createdUserIds.push(body.data.id);
    return { res, body, suffix };
  }

  async function rowsFor(userId: string) {
    return db.query.retailerUsers.findMany({ where: eq(retailerUsers.userId, userId) });
  }

  it("creating a user with a retailerId produces exactly one real retailer_users row", async () => {
    const retailer = await createRetailer();
    const { res, body } = await createUser({ retailerId: retailer.id });
    expect(res.status).toBe(201);
    expect(body.data.retailerId).toBe(retailer.id);

    const rows = await rowsFor(body.data.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.retailerId).toBe(retailer.id);
  });

  it("updating to a different retailerId replaces the row, never leaving two", async () => {
    const retailerOne = await createRetailer();
    const retailerTwo = await createRetailer();
    const { body: created } = await createUser({ retailerId: retailerOne.id });

    const updateRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` },
      body: JSON.stringify({ retailerId: retailerTwo.id }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { retailerId: string | null } };
    expect(updated.data.retailerId).toBe(retailerTwo.id);

    const rows = await rowsFor(created.data.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.retailerId).toBe(retailerTwo.id);
  });

  it("updating with retailerId: null removes the row entirely", async () => {
    const retailer = await createRetailer();
    const { body: created } = await createUser({ retailerId: retailer.id });
    expect(await rowsFor(created.data.id)).toHaveLength(1);

    const updateRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` },
      body: JSON.stringify({ retailerId: null }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { retailerId: string | null } };
    expect(updated.data.retailerId).toBeNull();

    expect(await rowsFor(created.data.id)).toHaveLength(0);
  });

  it("leaves the link untouched when retailerId is simply omitted from an update", async () => {
    const retailer = await createRetailer();
    const { body: created } = await createUser({ retailerId: retailer.id });

    const updateRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` },
      body: JSON.stringify({ name: "Renamed, No Retailer Change" }),
    });
    expect(updateRes.status).toBe(200);

    const rows = await rowsFor(created.data.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.retailerId).toBe(retailer.id);
  });

  it("404s creating a user with a retailerId that doesn't exist (or belongs to another tenant)", async () => {
    const { res, body } = await createUser({ retailerId: randomUUID() });
    expect(res.status).toBe(404);
    expect((body as unknown as { error: { code: string } }).error.code).toBe("RETAILER_NOT_FOUND");
  });

  it("a real login as a retailer-linked user resolves actor.retailerId correctly via /api/me", async () => {
    const retailer = await createRetailer();
    const plaintext = "Retailer-Login-Check-1!";
    const { body: created, suffix } = await createUser({ retailerId: retailer.id, password: plaintext });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenantSlug, username: `ru-${suffix}`, password: plaintext }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { token: string } };

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${loginBody.data.token}` } });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { data: { id: string; retailerId: string | null } };
    expect(meBody.data.id).toBe(created.data.id);
    expect(meBody.data.retailerId).toBe(retailer.id);
  });

  it("a staff (non-retailer-linked) login resolves actor.retailerId as null", async () => {
    const plaintext = "Staff-Login-Check-1!";
    const { suffix } = await createUser({ password: plaintext });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenantSlug, username: `ru-${suffix}`, password: plaintext }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { token: string } };

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${loginBody.data.token}` } });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { data: { retailerId: string | null } };
    expect(meBody.data.retailerId).toBeNull();
  });

  it("a tailor login resolves actor.retailerId as null (tailors have no retailer concept)", async () => {
    const suffix = randomUUID();
    const plaintext = "Tailor-Login-Check-1!";
    const createRes = await fetch(`${baseUrl}/api/tailors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` },
      body: JSON.stringify({ name: `Test Tailor ${suffix}`, username: `rt-${suffix}`, password: plaintext }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    createdTailorIds.push(created.data.id);

    const loginRes = await fetch(`${baseUrl}/api/tailor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenantSlug, username: `rt-${suffix}`, password: plaintext }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { token: string } };

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${loginBody.data.token}` } });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { data: { actorType: string; retailerId: string | null } };
    expect(meBody.data.actorType).toBe("tailor");
    expect(meBody.data.retailerId).toBeNull();
  });
});
