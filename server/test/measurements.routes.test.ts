import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/measurement-definitions", () => {
  let server: Server;
  let baseUrl: string;

  let managerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let readOnlyA: Awaited<ReturnType<typeof createTenantWithUser>>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [managerA, readOnlyA] = await Promise.all([
      createTenantWithUser(["catalog.measurements.manage", "catalog.products.manage"]),
      createTenantWithUser([]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await managerA.cleanup();
    await readOnlyA.cleanup();
  });

  it("creates a measurement definition and links it to a product", async () => {
    const productRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Jacket ${randomUUID()}` }),
    });
    const product = (await productRes.json()) as { data: { id: string } };

    const suffix = randomUUID();
    const defRes = await fetch(`${baseUrl}/api/measurement-definitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Chest", slug: `chest-${suffix}` }),
    });
    expect(defRes.status).toBe(201);
    const definition = (await defRes.json()) as { data: { id: string } };

    const linkRes = await fetch(`${baseUrl}/api/products/${product.data.id}/measurements`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ measurementDefinitionIds: [definition.data.id] }),
    });
    expect(linkRes.status).toBe(200);

    const getRes = await fetch(`${baseUrl}/api/products/${product.data.id}/measurements`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const links = (await getRes.json()) as { data: Array<{ measurementDefinition: { id: string; name: string } }> };
    expect(links.data).toHaveLength(1);
    expect(links.data[0]?.measurementDefinition.id).toBe(definition.data.id);
  });

  it("persists and can reverse the product's configured measurement order (PHASE_8_TASKS.md Group 1)", async () => {
    const productRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Order Test Product ${randomUUID()}` }),
    });
    const product = (await productRes.json()) as { data: { id: string } };

    const suffix = randomUUID();
    const [defARes, defBRes] = await Promise.all([
      fetch(`${baseUrl}/api/measurement-definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ name: "Length", slug: `length-${suffix}` }),
      }),
      fetch(`${baseUrl}/api/measurement-definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ name: "Chest", slug: `chest2-${suffix}` }),
      }),
    ]);
    const defA = ((await defARes.json()) as { data: { id: string } }).data;
    const defB = ((await defBRes.json()) as { data: { id: string } }).data;

    async function linkAndFetchOrder(orderedIds: string[]) {
      const linkRes = await fetch(`${baseUrl}/api/products/${product.data.id}/measurements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ measurementDefinitionIds: orderedIds }),
      });
      expect(linkRes.status).toBe(200);
      const getRes = await fetch(`${baseUrl}/api/products/${product.data.id}/measurements`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const body = (await getRes.json()) as { data: Array<{ measurementDefinitionId: string }> };
      return body.data.map((link) => link.measurementDefinitionId);
    }

    expect(await linkAndFetchOrder([defB.id, defA.id])).toEqual([defB.id, defA.id]);
    expect(await linkAndFetchOrder([defA.id, defB.id])).toEqual([defA.id, defB.id]);
  });

  it("403s a create request from a user lacking catalog.measurements.manage", async () => {
    const res = await fetch(`${baseUrl}/api/measurement-definitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: "Waist", slug: `waist-${randomUUID()}` }),
    });
    expect(res.status).toBe(403);
  });
});
