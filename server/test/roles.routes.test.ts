import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { rolePermissions, roles } from "../src/db/schema/index";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/roles", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;

  const createdRoleIds: string[] = [];

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
      createTenantWithUser(["rbac.roles.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["rbac.roles.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of createdRoleIds) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      await db.delete(roles).where(eq(roles.id, id));
    }
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  async function createRole(token: string, overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID();
    const res = await fetch(`${baseUrl}/api/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Test Role ${suffix}`, ...overrides }),
    });
    const body = (await res.json()) as { data: { id: string } };
    if (res.status === 201) createdRoleIds.push(body.data.id);
    return { res, body, suffix };
  }

  it("creates a role and is tenant-scoped: tenant B cannot see tenant A's role", async () => {
    const { res: createRes, body: created } = await createRole(managerA.token);
    expect(createRes.status).toBe(201);

    const getAsA = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/roles`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((r) => r.id)).not.toContain(created.data.id);
  });

  it("403s a create request from a user lacking rbac.roles.manage", async () => {
    const res = await fetch(`${baseUrl}/api/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: `Should Not Be Created ${randomUUID()}` }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the read-only user through GET /api/roles", async () => {
    const res = await fetch(`${baseUrl}/api/roles`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/roles`);
    expect(res.status).toBe(401);
  });

  it("rejects a duplicate role name within the same tenant", async () => {
    const suffix = randomUUID();
    const name = `Dup Role ${suffix}`;
    const { res: firstRes } = await createRole(managerA.token, { name });
    expect(firstRes.status).toBe(201);

    const { res: secondRes, body: secondBody } = await createRole(managerA.token, { name });
    expect(secondRes.status).toBe(409);
    expect((secondBody as unknown as { error: { code: string } }).error.code).toBe("ROLE_NAME_TAKEN");
  });

  it("updates and soft-deletes a role", async () => {
    const { body: created } = await createRole(managerA.token);

    const updateRes = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Renamed Role ${randomUUID()}` }),
    });
    expect(updateRes.status).toBe(200);

    const deleteRes = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });

  describe("permission assignment", () => {
    it("assigns a permission to a role (nested as a full object on GET), rejects a duplicate with 409, and removes it", async () => {
      const { body: created } = await createRole(managerA.token);
      const permissionRow = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "orders.view") });
      if (!permissionRow) throw new Error("Expected seeded 'orders.view' permission");

      const assignRes = await fetch(`${baseUrl}/api/roles/${created.data.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ permissionId: permissionRow.id }),
      });
      expect(assignRes.status).toBe(201);
      const assignBody = (await assignRes.json()) as { data: Array<{ id: string; key: string }> };
      expect(assignBody.data.map((p) => p.id)).toContain(permissionRow.id);
      // Full permission objects nested, not just IDs.
      expect(assignBody.data.find((p) => p.id === permissionRow.id)?.key).toBe("orders.view");

      const getRes = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const getBody = (await getRes.json()) as { data: { permissions: Array<{ id: string; key: string; module: string }> } };
      const nested = getBody.data.permissions.find((p) => p.id === permissionRow.id);
      expect(nested).toBeDefined();
      expect(nested?.key).toBe("orders.view");
      expect(nested?.module).toBe("Orders");

      const duplicateRes = await fetch(`${baseUrl}/api/roles/${created.data.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ permissionId: permissionRow.id }),
      });
      expect(duplicateRes.status).toBe(409);
      const duplicateBody = (await duplicateRes.json()) as { error: { code: string } };
      expect(duplicateBody.error.code).toBe("ALREADY_GRANTED");

      const removeRes = await fetch(`${baseUrl}/api/roles/${created.data.id}/permissions/${permissionRow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(removeRes.status).toBe(204);

      const getAfterRes = await fetch(`${baseUrl}/api/roles/${created.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const getAfterBody = (await getAfterRes.json()) as { data: { permissions: Array<{ id: string }> } };
      expect(getAfterBody.data.permissions.map((p) => p.id)).not.toContain(permissionRow.id);

      const removeAgainRes = await fetch(`${baseUrl}/api/roles/${created.data.id}/permissions/${permissionRow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(removeAgainRes.status).toBe(404);
      const removeAgainBody = (await removeAgainRes.json()) as { error: { code: string } };
      expect(removeAgainBody.error.code).toBe("NOT_GRANTED");
    });

    it("403s a permission-assignment request from a user lacking rbac.roles.manage", async () => {
      const { body: created } = await createRole(managerA.token);
      const permissionRow = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "orders.view") });
      if (!permissionRow) throw new Error("Expected seeded 'orders.view' permission");

      const res = await fetch(`${baseUrl}/api/roles/${created.data.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
        body: JSON.stringify({ permissionId: permissionRow.id }),
      });
      expect(res.status).toBe(403);
    });

    it("404s assigning a nonexistent permission id", async () => {
      const { body: created } = await createRole(managerA.token);
      const res = await fetch(`${baseUrl}/api/roles/${created.data.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ permissionId: randomUUID() }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("PERMISSION_NOT_FOUND");
    });
  });

  describe("system role protection (PHASE_8_TASKS.md Group 3)", () => {
    async function createSystemRole() {
      const [role] = await db
        .insert(roles)
        .values({ tenantId: managerA.tenantId, name: `System Role ${randomUUID()}`, isSystem: true })
        .returning();
      if (!role) throw new Error("Failed to create system role fixture");
      createdRoleIds.push(role.id);
      return role;
    }

    it("rejects deleting a system role with 409 SYSTEM_ROLE_PROTECTED", async () => {
      const role = await createSystemRole();
      const res = await fetch(`${baseUrl}/api/roles/${role.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("SYSTEM_ROLE_PROTECTED");

      const stillThere = await db.query.roles.findFirst({ where: (r, { eq: eqOp }) => eqOp(r.id, role.id) });
      expect(stillThere?.deletedAt).toBeNull();
    });

    it("rejects removing a permission from a system role with 409 SYSTEM_ROLE_PROTECTED", async () => {
      const role = await createSystemRole();
      const permissionRow = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "orders.view") });
      if (!permissionRow) throw new Error("Expected seeded 'orders.view' permission");

      const grantRes = await fetch(`${baseUrl}/api/roles/${role.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ permissionId: permissionRow.id }),
      });
      expect(grantRes.status).toBe(201);

      const removeRes = await fetch(`${baseUrl}/api/roles/${role.id}/permissions/${permissionRow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(removeRes.status).toBe(409);
      const removeBody = (await removeRes.json()) as { error: { code: string } };
      expect(removeBody.error.code).toBe("SYSTEM_ROLE_PROTECTED");
    });
  });
});
