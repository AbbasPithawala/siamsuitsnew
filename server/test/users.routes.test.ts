import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { rolePermissions, roles, tenants, userRoles, users } from "../src/db/schema/index";
import { verifyPassword } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

describe("/api/users", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;
  let tenantASlug: string;

  const createdUserIds: string[] = [];
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
      // Also granted rbac.roles.manage so the end-to-end acceptance test below (create
      // role -> grant permissions -> create user -> assign role -> login) can run
      // entirely through the API from a single actor, the way an actual admin would.
      createTenantWithUser(["tenant.users.manage", "rbac.roles.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["tenant.users.manage"]),
    ]);

    const tenantA = await db.query.tenants.findFirst({ where: eq(tenants.id, managerA.tenantId) });
    if (!tenantA) throw new Error("Failed to resolve tenant A");
    tenantASlug = tenantA.slug;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const id of createdUserIds) {
      await db.delete(userRoles).where(eq(userRoles.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
    for (const id of createdRoleIds) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      await db.delete(userRoles).where(eq(userRoles.roleId, id));
      await db.delete(roles).where(eq(roles.id, id));
    }
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  async function createUser(token: string, overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID();
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Test User ${suffix}`, username: `user-${suffix}`, password: "Sup3rSecret!", ...overrides }),
    });
    const body = (await res.json()) as { data: { id: string; username: string } };
    if (res.status === 201) createdUserIds.push(body.data.id);
    return { res, body, suffix };
  }

  it("creates a user and is tenant-scoped: tenant B cannot see tenant A's user", async () => {
    const { res: createRes, body: created } = await createUser(managerA.token);
    expect(createRes.status).toBe(201);
    expect(created.data.username).toMatch(/^user-/);

    const getAsA = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/users`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((u) => u.id)).not.toContain(created.data.id);
  });

  it("403s a create request from a user lacking tenant.users.manage", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: "Should Not Be Created", username: `nope-${randomUUID()}`, password: "Sup3rSecret!" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the read-only user through GET /api/users", async () => {
    const res = await fetch(`${baseUrl}/api/users`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/users`);
    expect(res.status).toBe(401);
  });

  it("hashes the submitted plaintext password — never returns it, never stores it as-is", async () => {
    const plaintext = "Sup3rSecret!";
    const { res: createRes, body: created } = await createUser(managerA.token, { password: plaintext });
    expect(createRes.status).toBe(201);

    expect(created.data).not.toHaveProperty("passwordHash");

    const dbRow = await db.query.users.findFirst({ where: eq(users.id, created.data.id) });
    if (!dbRow) throw new Error("Expected user row to exist");

    expect(dbRow.passwordHash).not.toBe(plaintext);
    expect(dbRow.passwordHash).toMatch(BCRYPT_HASH_RE);
    await expect(verifyPassword(plaintext, dbRow.passwordHash)).resolves.toBe(true);
  });

  it("lets a freshly created user actually log in through /api/auth/login with the plaintext password", async () => {
    const plaintext = "Real-Auth-Check-1!";
    const { res: createRes, body: created, suffix } = await createUser(managerA.token, { password: plaintext });
    expect(createRes.status).toBe(201);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenantASlug, username: `user-${suffix}`, password: plaintext }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { token: string } };
    expect(typeof loginBody.data.token).toBe("string");

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${loginBody.data.token}` } });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { data: { id: string; permissions: string[] } };
    expect(meBody.data.id).toBe(created.data.id);
    // Freshly created user has no roles yet — must resolve to zero permissions, not the
    // creating manager's.
    expect(meBody.data.permissions).toEqual([]);
  });

  it("rejects a duplicate username within the same tenant", async () => {
    const suffix = randomUUID();
    const username = `dup-${suffix}`;
    const { res: firstRes } = await createUser(managerA.token, { username });
    expect(firstRes.status).toBe(201);

    const { res: secondRes, body: secondBody } = await createUser(managerA.token, { username });
    expect(secondRes.status).toBe(409);
    expect((secondBody as unknown as { error: { code: string } }).error.code).toBe("USERNAME_TAKEN");
  });

  it("updates and soft-deletes a user", async () => {
    const { body: created } = await createUser(managerA.token);

    const updateRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ isActive: false }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { isActive: boolean } };
    expect(updated.data.isActive).toBe(false);
    expect(updated.data).not.toHaveProperty("passwordHash");

    const deleteRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });

  describe("role assignment", () => {
    async function createRoleForTenantA() {
      const [role] = await db
        .insert(roles)
        .values({ tenantId: managerA.tenantId, name: `Assignable Role ${randomUUID()}` })
        .returning();
      if (!role) throw new Error("Failed to create test role");
      createdRoleIds.push(role.id);
      return role;
    }

    it("assigns a role to a user (nested as a full object on GET), rejects a duplicate with 409, and unassigns", async () => {
      const { body: created } = await createUser(managerA.token);
      const role = await createRoleForTenantA();

      const assignRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ roleId: role.id }),
      });
      expect(assignRes.status).toBe(201);
      const assignBody = (await assignRes.json()) as { data: Array<{ id: string; name: string }> };
      expect(assignBody.data.map((r) => r.id)).toContain(role.id);
      expect(assignBody.data.find((r) => r.id === role.id)?.name).toBe(role.name);

      const getRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const getBody = (await getRes.json()) as { data: { roles: Array<{ id: string; name: string }> } };
      expect(getBody.data.roles.map((r) => r.id)).toContain(role.id);

      const duplicateRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ roleId: role.id }),
      });
      expect(duplicateRes.status).toBe(409);
      const duplicateBody = (await duplicateRes.json()) as { error: { code: string } };
      expect(duplicateBody.error.code).toBe("ALREADY_ASSIGNED");

      const unassignRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles/${role.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(unassignRes.status).toBe(204);

      const getAfterRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const getAfterBody = (await getAfterRes.json()) as { data: { roles: Array<{ id: string }> } };
      expect(getAfterBody.data.roles.map((r) => r.id)).not.toContain(role.id);

      const unassignAgainRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles/${role.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(unassignAgainRes.status).toBe(404);
      const unassignAgainBody = (await unassignAgainRes.json()) as { error: { code: string } };
      expect(unassignAgainBody.error.code).toBe("NOT_ASSIGNED");
    });

    it("403s a role-assignment request from a user lacking tenant.users.manage", async () => {
      const { body: created } = await createUser(managerA.token);
      const role = await createRoleForTenantA();

      const res = await fetch(`${baseUrl}/api/users/${created.data.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
        body: JSON.stringify({ roleId: role.id }),
      });
      expect(res.status).toBe(403);
    });

    it("404s assigning a role belonging to a different tenant (RLS-scoped resolution, not just a plain id lookup)", async () => {
      const { body: created } = await createUser(managerA.token);

      const res = await fetch(`${baseUrl}/api/users/${created.data.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ roleId: managerB.roleId }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("ROLE_NOT_FOUND");
    });
  });

  describe("system role — last active holder protection (PHASE_8_TASKS.md Group 3)", () => {
    async function createSystemRole() {
      const [role] = await db
        .insert(roles)
        .values({ tenantId: managerA.tenantId, name: `System Role ${randomUUID()}`, isSystem: true })
        .returning();
      if (!role) throw new Error("Failed to create system role fixture");
      createdRoleIds.push(role.id);
      return role;
    }

    it("blocks deactivating, deleting, and unassigning a system role from the tenant's last active holder", async () => {
      const role = await createSystemRole();
      const { body: created } = await createUser(managerA.token);
      const assignRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ roleId: role.id }),
      });
      expect(assignRes.status).toBe(201);

      const deactivateRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ isActive: false }),
      });
      expect(deactivateRes.status).toBe(409);
      expect(((await deactivateRes.json()) as { error: { code: string } }).error.code).toBe("LAST_SYSTEM_ROLE_HOLDER");

      const unassignRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles/${role.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(unassignRes.status).toBe(409);
      expect(((await unassignRes.json()) as { error: { code: string } }).error.code).toBe("LAST_SYSTEM_ROLE_HOLDER");

      const deleteRes = await fetch(`${baseUrl}/api/users/${created.data.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      expect(deleteRes.status).toBe(409);
      expect(((await deleteRes.json()) as { error: { code: string } }).error.code).toBe("LAST_SYSTEM_ROLE_HOLDER");

      // The user is still there, still active, still holding the role — nothing above
      // partially succeeded before being rejected.
      const stillThere = await db.query.users.findFirst({ where: (u, { eq: eqOp }) => eqOp(u.id, created.data.id) });
      expect(stillThere?.isActive).toBe(true);
      expect(stillThere?.deletedAt).toBeNull();
    });

    it("allows deactivating/unassigning once a second active user also holds the system role", async () => {
      const role = await createSystemRole();
      const { body: first } = await createUser(managerA.token);
      const { body: second } = await createUser(managerA.token);

      for (const userId of [first.data.id, second.data.id]) {
        const res = await fetch(`${baseUrl}/api/users/${userId}/roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
          body: JSON.stringify({ roleId: role.id }),
        });
        expect(res.status).toBe(201);
      }

      const deactivateFirstRes = await fetch(`${baseUrl}/api/users/${first.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ isActive: false }),
      });
      expect(deactivateFirstRes.status).toBe(200);

      // Now only `second` is an active holder — deactivating them should be blocked.
      const deactivateSecondRes = await fetch(`${baseUrl}/api/users/${second.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ isActive: false }),
      });
      expect(deactivateSecondRes.status).toBe(409);
    });
  });

  it("acceptance: a role created with a limited permission subset, assigned to a new user, grants exactly those permissions on login+/api/me — entirely through the API", async () => {
    const roleRes = await fetch(`${baseUrl}/api/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `E2E Role ${randomUUID()}` }),
    });
    expect(roleRes.status).toBe(201);
    const roleBody = (await roleRes.json()) as { data: { id: string } };
    createdRoleIds.push(roleBody.data.id);

    const grantKeys = ["orders.view", "invoices.view", "orders.repeat"];
    const permissionRows = await db.query.permissions.findMany({ where: (p, { inArray }) => inArray(p.key, grantKeys) });
    expect(permissionRows).toHaveLength(grantKeys.length);
    for (const permission of permissionRows) {
      const grantRes = await fetch(`${baseUrl}/api/roles/${roleBody.data.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ permissionId: permission.id }),
      });
      expect(grantRes.status).toBe(201);
    }

    const { res: createRes, body: created, suffix } = await createUser(managerA.token, { password: "E2E-Login-Check-1!" });
    expect(createRes.status).toBe(201);

    const assignRes = await fetch(`${baseUrl}/api/users/${created.data.id}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ roleId: roleBody.data.id }),
    });
    expect(assignRes.status).toBe(201);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenantASlug, username: `user-${suffix}`, password: "E2E-Login-Check-1!" }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { token: string } };

    const meRes = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${loginBody.data.token}` } });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { data: { permissions: string[] } };
    expect(new Set(meBody.data.permissions)).toEqual(new Set(grantKeys));
  });
});
