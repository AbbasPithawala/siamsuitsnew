import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/products", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;

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
      createTenantWithUser(["catalog.products.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["catalog.products.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  it("creates a product and is tenant-scoped: tenant B cannot see tenant A's product", async () => {
    const name = `Classic Jacket ${randomUUID()}`;
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string; name: string } };
    expect(created.data.name).toBe(name);

    const getAsA = await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/products`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((p) => p.id)).not.toContain(created.data.id);
  });

  it("403s a create request from a user lacking catalog.products.manage", async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: `Should Not Be Created ${randomUUID()}` }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the read-only user through GET /api/products", async () => {
    const res = await fetch(`${baseUrl}/api/products`, { headers: { Authorization: `Bearer ${readOnlyA.token}` } });
    expect(res.status).toBe(200);
  });

  it("updates and soft-deletes a product", async () => {
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Update Me ${randomUUID()}` }),
    });
    const created = (await createRes.json()) as { data: { id: string } };

    const updateRes = await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ description: "Updated description" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { description: string } };
    expect(updated.data.description).toBe("Updated description");

    const deleteRes = await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });

  it("401s a request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/products`);
    expect(res.status).toBe(401);
  });

  it("auto-creates a matching 1-component super product, keeps it in sync on rename, and soft-deletes it alongside the product", async () => {
    const name = `Auto Wrapper ${randomUUID()}`;
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name }),
    });
    const created = (await createRes.json()) as { data: { id: string; name: string } };

    const listAfterCreate = (await (
      await fetch(`${baseUrl}/api/super-products`, { headers: { Authorization: `Bearer ${managerA.token}` } })
    ).json()) as {
      data: Array<{ id: string; name: string; sourceProductId: string | null; components: Array<{ slotLabel: string; productId: string }> }>;
    };
    const linked = listAfterCreate.data.find((sp) => sp.sourceProductId === created.data.id);
    expect(linked).toBeDefined();
    expect(linked!.name).toBe(name);
    expect(linked!.components).toHaveLength(1);
    expect(linked!.components[0]!.productId).toBe(created.data.id);
    expect(linked!.components[0]!.slotLabel).toBe(name);

    const renamed = `Auto Wrapper Renamed ${randomUUID()}`;
    await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: renamed }),
    });
    const listAfterRename = (await (
      await fetch(`${baseUrl}/api/super-products`, { headers: { Authorization: `Bearer ${managerA.token}` } })
    ).json()) as { data: Array<{ sourceProductId: string | null; name: string; components: Array<{ slotLabel: string }> }> };
    const linkedAfterRename = listAfterRename.data.find((sp) => sp.sourceProductId === created.data.id);
    expect(linkedAfterRename!.name).toBe(renamed);
    expect(linkedAfterRename!.components[0]!.slotLabel).toBe(renamed);

    await fetch(`${baseUrl}/api/products/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const listAfterDelete = (await (
      await fetch(`${baseUrl}/api/super-products`, { headers: { Authorization: `Bearer ${managerA.token}` } })
    ).json()) as { data: Array<{ sourceProductId: string | null }> };
    expect(listAfterDelete.data.some((sp) => sp.sourceProductId === created.data.id)).toBe(false);
  });
});
