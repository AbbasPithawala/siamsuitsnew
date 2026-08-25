import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers } from "../src/db/schema/index";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/retailers", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;

  const createdRetailerIds: string[] = [];

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
      createTenantWithUser(["retailers.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["retailers.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (createdRetailerIds.length) {
      for (const id of createdRetailerIds) {
        await db.delete(retailers).where(eq(retailers.id, id));
      }
    }
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  async function createRetailer(token: string, overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID();
    const res = await fetch(`${baseUrl}/api/retailers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Test Retailer ${suffix}`, code: `TR-${suffix.slice(0, 8)}`, ...overrides }),
    });
    const body = (await res.json()) as { data: { id: string } };
    if (res.status === 201) createdRetailerIds.push(body.data.id);
    return { res, body };
  }

  it("creates a retailer and is tenant-scoped: tenant B cannot see tenant A's retailer", async () => {
    const { res: createRes, body: created } = await createRetailer(managerA.token, { ownerName: "Somchai" });
    expect(createRes.status).toBe(201);
    expect((created.data as unknown as { ownerName: string }).ownerName).toBe("Somchai");

    const getAsA = await fetch(`${baseUrl}/api/retailers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/retailers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/retailers`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((r) => r.id)).not.toContain(created.data.id);
  });

  it("403s a create request from a user lacking retailers.manage", async () => {
    const res = await fetch(`${baseUrl}/api/retailers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: "Should Not Be Created", code: `NOPE-${randomUUID().slice(0, 8)}` }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the read-only user through GET /api/retailers", async () => {
    const res = await fetch(`${baseUrl}/api/retailers`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/retailers`);
    expect(res.status).toBe(401);
  });

  it("rejects a duplicate retailer code within the same tenant", async () => {
    const suffix = randomUUID();
    const code = `DUP-${suffix.slice(0, 8)}`;
    const { res: firstRes } = await createRetailer(managerA.token, { code, name: `Dup A ${suffix}` });
    expect(firstRes.status).toBe(201);

    const { res: secondRes, body: secondBody } = await createRetailer(managerA.token, { code, name: `Dup B ${suffix}` });
    expect(secondRes.status).toBe(409);
    expect((secondBody as unknown as { error: { code: string } }).error.code).toBe("RETAILER_CODE_TAKEN");
  });

  it("updates and soft-deletes a retailer", async () => {
    const { body: created } = await createRetailer(managerA.token);

    const updateRes = await fetch(`${baseUrl}/api/retailers/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ ownerName: "Updated Owner", address: "123 Main St", phone: "+66-1234-5678" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { ownerName: string; address: string; phone: string } };
    expect(updated.data.ownerName).toBe("Updated Owner");
    expect(updated.data.address).toBe("123 Main St");
    expect(updated.data.phone).toBe("+66-1234-5678");

    const deleteRes = await fetch(`${baseUrl}/api/retailers/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/retailers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });
});
