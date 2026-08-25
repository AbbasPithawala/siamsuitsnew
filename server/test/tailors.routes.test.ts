import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { processes, tailorProcesses, tailors, tenants } from "../src/db/schema/index";
import { verifyPassword } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

describe("/api/tailors", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;
  let tenantASlug: string;

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

    [managerA, readOnlyA, managerB] = await Promise.all([
      createTenantWithUser(["factory.tailors.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["factory.tailors.manage"]),
    ]);

    const tenantA = await db.query.tenants.findFirst({ where: eq(tenants.id, managerA.tenantId) });
    if (!tenantA) throw new Error("Failed to resolve tenant A");
    tenantASlug = tenantA.slug;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of createdTailorIds) {
      await db.delete(tailorProcesses).where(eq(tailorProcesses.tailorId, id));
      await db.delete(tailors).where(eq(tailors.id, id));
    }
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  async function createTailor(token: string, overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID();
    const res = await fetch(`${baseUrl}/api/tailors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Test Tailor ${suffix}`, username: `tailor-${suffix}`, password: "Sup3rSecret!", ...overrides }),
    });
    const body = (await res.json()) as { data: { id: string; username: string } };
    if (res.status === 201) createdTailorIds.push(body.data.id);
    return { res, body, suffix };
  }

  it("creates a tailor and is tenant-scoped: tenant B cannot see tenant A's tailor", async () => {
    const { res: createRes, body: created } = await createTailor(managerA.token);
    expect(createRes.status).toBe(201);
    expect(created.data.username).toMatch(/^tailor-/);

    const getAsA = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/tailors`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((t) => t.id)).not.toContain(created.data.id);
  });

  it("403s a create request from a user lacking factory.tailors.manage", async () => {
    const res = await fetch(`${baseUrl}/api/tailors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: "Should Not Be Created", username: `nope-${randomUUID()}`, password: "Sup3rSecret!" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the read-only user through GET /api/tailors", async () => {
    const res = await fetch(`${baseUrl}/api/tailors`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/tailors`);
    expect(res.status).toBe(401);
  });

  it("hashes the submitted plaintext password — never returns it, never stores it as-is", async () => {
    const plaintext = "Sup3rSecret!";
    const { res: createRes, body: created } = await createTailor(managerA.token, { password: plaintext });
    expect(createRes.status).toBe(201);

    // The API response must never expose passwordHash at all.
    expect(created.data).not.toHaveProperty("passwordHash");

    const dbRow = await db.query.tailors.findFirst({ where: eq(tailors.id, created.data.id) });
    if (!dbRow) throw new Error("Expected tailor row to exist");

    expect(dbRow.passwordHash).not.toBe(plaintext);
    expect(dbRow.passwordHash).toMatch(BCRYPT_HASH_RE);
    await expect(verifyPassword(plaintext, dbRow.passwordHash)).resolves.toBe(true);
  });

  it("lets a freshly created tailor actually log in through /api/tailor/login with the plaintext password", async () => {
    const plaintext = "Real-Auth-Check-1!";
    const { res: createRes, body: created, suffix } = await createTailor(managerA.token, { password: plaintext });
    expect(createRes.status).toBe(201);

    const loginRes = await fetch(`${baseUrl}/api/tailor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenantASlug, username: `tailor-${suffix}`, password: plaintext }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { token: string } };
    expect(typeof loginBody.data.token).toBe("string");

    const meRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(meRes.status).toBe(200);
  });

  it("rejects a duplicate username within the same tenant", async () => {
    const suffix = randomUUID();
    const username = `dup-${suffix}`;
    const { res: firstRes } = await createTailor(managerA.token, { username });
    expect(firstRes.status).toBe(201);

    const { res: secondRes, body: secondBody } = await createTailor(managerA.token, { username });
    expect(secondRes.status).toBe(409);
    expect((secondBody as unknown as { error: { code: string } }).error.code).toBe("USERNAME_TAKEN");
  });

  it("updates and soft-deletes a tailor", async () => {
    const { body: created } = await createTailor(managerA.token);

    const updateRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ isActive: false }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { isActive: boolean } };
    expect(updated.data.isActive).toBe(false);
    expect(updated.data).not.toHaveProperty("passwordHash");

    const deleteRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });

  describe("process certification", () => {
    async function createProcess() {
      const [process] = await db
        .insert(processes)
        .values({ tenantId: managerA.tenantId, name: `Cert Process ${randomUUID()}` })
        .returning();
      if (!process) throw new Error("Failed to create test process");
      return process;
    }

    it("certifies a tailor for a process, rejects a duplicate certification with 409, and decertifies", async () => {
      const { body: created } = await createTailor(managerA.token);
      const process = await createProcess();

      const certifyRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ processId: process.id }),
      });
      expect(certifyRes.status).toBe(201);
      const certifyBody = (await certifyRes.json()) as { data: Array<{ id: string }> };
      expect(certifyBody.data.map((p) => p.id)).toContain(process.id);

      const getRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const getBody = (await getRes.json()) as { data: { certifications: Array<{ id: string; name: string }> } };
      expect(getBody.data.certifications.map((p) => p.id)).toContain(process.id);

      const duplicateRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ processId: process.id }),
      });
      expect(duplicateRes.status).toBe(409);
      const duplicateBody = (await duplicateRes.json()) as { error: { code: string } };
      expect(duplicateBody.error.code).toBe("ALREADY_CERTIFIED");

      const decertifyRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}/processes/${process.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(decertifyRes.status).toBe(204);

      const getAfterRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const getAfterBody = (await getAfterRes.json()) as { data: { certifications: Array<{ id: string }> } };
      expect(getAfterBody.data.certifications.map((p) => p.id)).not.toContain(process.id);

      const decertifyAgainRes = await fetch(`${baseUrl}/api/tailors/${created.data.id}/processes/${process.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(decertifyAgainRes.status).toBe(404);
      const decertifyAgainBody = (await decertifyAgainRes.json()) as { error: { code: string } };
      expect(decertifyAgainBody.error.code).toBe("NOT_CERTIFIED");
    });

    it("403s a certification request from a user lacking factory.tailors.manage", async () => {
      const { body: created } = await createTailor(managerA.token);
      const process = await createProcess();

      const res = await fetch(`${baseUrl}/api/tailors/${created.data.id}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
        body: JSON.stringify({ processId: process.id }),
      });
      expect(res.status).toBe(403);
    });
  });
});
