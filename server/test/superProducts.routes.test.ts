import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

async function createProduct(baseUrl: string, token: string, name: string) {
  const res = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

describe("/api/super-products", () => {
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
      createTenantWithUser(["catalog.super_products.manage", "catalog.products.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["catalog.super_products.manage", "catalog.products.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  it("defines a brand-new super product combining three existing products with a slot label each, tenant-scoped", async () => {
    const [jacketId, pantId, waistcoatId] = await Promise.all([
      createProduct(baseUrl, managerA.token, `Jacket ${randomUUID()}`),
      createProduct(baseUrl, managerA.token, `Pant ${randomUUID()}`),
      createProduct(baseUrl, managerA.token, `Waistcoat ${randomUUID()}`),
    ]);

    const createRes = await fetch(`${baseUrl}/api/super-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({
        name: `Three-Piece Suit ${randomUUID()}`,
        components: [
          { productId: jacketId, slotLabel: "Jacket", sequence: 1 },
          { productId: pantId, slotLabel: "Pant", sequence: 2 },
          { productId: waistcoatId, slotLabel: "Waistcoat", sequence: 3 },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { id: string; components: Array<{ productId: string; slotLabel: string; sequence: number }> };
    };
    expect(created.data.components).toHaveLength(3);
    expect(created.data.components.map((c) => c.slotLabel).sort()).toEqual(["Jacket", "Pant", "Waistcoat"]);

    const getAsB = await fetch(`${baseUrl}/api/super-products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const getAsA = await fetch(`${baseUrl}/api/super-products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getAsA.status).toBe(200);
  });

  it("rejects a 4th component with TOO_MANY_COMPONENTS instead of truncating or allowing it", async () => {
    const [p1, p2, p3, p4] = await Promise.all([
      createProduct(baseUrl, managerA.token, `P1 ${randomUUID()}`),
      createProduct(baseUrl, managerA.token, `P2 ${randomUUID()}`),
      createProduct(baseUrl, managerA.token, `P3 ${randomUUID()}`),
      createProduct(baseUrl, managerA.token, `P4 ${randomUUID()}`),
    ]);

    const createRes = await fetch(`${baseUrl}/api/super-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({
        name: `Overstuffed Bundle ${randomUUID()}`,
        components: [
          { productId: p1, slotLabel: "Slot 1", sequence: 1 },
          { productId: p2, slotLabel: "Slot 2", sequence: 2 },
          { productId: p3, slotLabel: "Slot 3", sequence: 3 },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };

    const addFourthRes = await fetch(`${baseUrl}/api/super-products/${created.data.id}/components`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ productId: p4, slotLabel: "Slot 4" }),
    });
    expect(addFourthRes.status).toBe(422);
    const body = (await addFourthRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TOO_MANY_COMPONENTS");

    const getRes = await fetch(`${baseUrl}/api/super-products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const getBody = (await getRes.json()) as { data: { components: unknown[] } };
    expect(getBody.data.components).toHaveLength(3);
  });

  it("rejects a create request with 4 components up front, too", async () => {
    const ids = await Promise.all([1, 2, 3, 4].map((n) => createProduct(baseUrl, managerA.token, `Bulk${n} ${randomUUID()}`)));
    const res = await fetch(`${baseUrl}/api/super-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({
        name: `Rejected Bundle ${randomUUID()}`,
        components: ids.map((productId, i) => ({ productId, slotLabel: `Slot ${i + 1}` })),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("403s a create request from a user lacking catalog.super_products.manage", async () => {
    const res = await fetch(`${baseUrl}/api/super-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: `Should Not Be Created ${randomUUID()}` }),
    });
    expect(res.status).toBe(403);
  });
});
