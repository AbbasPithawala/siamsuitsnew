import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { customers, retailers } from "../src/db/schema/index";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Test Retailer ${suffix}`, code: `TR-${suffix.slice(0, 8)}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

describe("/api/customers", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;
  let retailerA: Awaited<ReturnType<typeof createRetailer>>;
  let retailerB: Awaited<ReturnType<typeof createRetailer>>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [managerA, readOnlyA, managerB] = await Promise.all([
      createTenantWithUser(["customers.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["customers.manage"]),
    ]);

    [retailerA, retailerB] = await Promise.all([createRetailer(managerA.tenantId), createRetailer(managerB.tenantId)]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(customers).where(eq(customers.retailerId, retailerA.id));
    await db.delete(customers).where(eq(customers.retailerId, retailerB.id));
    await db.delete(retailers).where(eq(retailers.id, retailerA.id));
    await db.delete(retailers).where(eq(retailers.id, retailerB.id));
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  it("creates a customer and is tenant-scoped: tenant B cannot see tenant A's customer", async () => {
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ retailerId: retailerA.id, firstName: "Somchai", lastName: "Testcase" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string; firstName: string; retailerId: string } };
    expect(created.data.firstName).toBe("Somchai");
    expect(created.data.retailerId).toBe(retailerA.id);

    const getAsA = await fetch(`${baseUrl}/api/customers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/customers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/customers`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((c) => c.id)).not.toContain(created.data.id);
  });

  it("403s a create request from a user lacking customers.manage", async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ retailerId: retailerA.id, firstName: "Should Not Be Created" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects creating a customer against a retailer belonging to another tenant", async () => {
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ retailerId: retailerB.id, firstName: "Cross Tenant" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RETAILER_NOT_FOUND");
  });

  it("updates and soft-deletes a customer", async () => {
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ retailerId: retailerA.id, firstName: "Update Me" }),
    });
    const created = (await createRes.json()) as { data: { id: string } };

    const updateRes = await fetch(`${baseUrl}/api/customers/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ contactNumber: "0812345678" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { contactNumber: string } };
    expect(updated.data.contactNumber).toBe("0812345678");

    const deleteRes = await fetch(`${baseUrl}/api/customers/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/customers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });

  it("filters the list by retailerId", async () => {
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ retailerId: retailerA.id, firstName: `Filtered ${randomUUID()}` }),
    });
    const created = (await createRes.json()) as { data: { id: string } };

    const listRes = await fetch(`${baseUrl}/api/customers?retailerId=${retailerA.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: string; retailerId: string }> };
    expect(listBody.data.every((c) => c.retailerId === retailerA.id)).toBe(true);
    expect(listBody.data.map((c) => c.id)).toContain(created.data.id);
  });

  it("allows the read-only user through GET /api/customers", async () => {
    const res = await fetch(`${baseUrl}/api/customers`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/customers`);
    expect(res.status).toBe(401);
  });
});
