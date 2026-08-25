import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/fittings", () => {
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
      createTenantWithUser(["catalog.fittings.manage", "catalog.products.manage", "catalog.measurements.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["catalog.fittings.manage", "catalog.products.manage", "catalog.measurements.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  async function createProduct(token: string) {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Jacket ${randomUUID()}` }),
    });
    return ((await res.json()) as { data: { id: string } }).data;
  }

  async function createMeasurementDefinition(token: string, name: string) {
    const res = await fetch(`${baseUrl}/api/measurement-definitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, slug: `${name.toLowerCase()}-${randomUUID()}` }),
    });
    return ((await res.json()) as { data: { id: string } }).data;
  }

  it("does full CRUD on a product's fittings", async () => {
    const product = await createProduct(managerA.token);

    const createRes = await fetch(`${baseUrl}/api/products/${product.id}/fittings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Slim", thaiName: "Slim (TH)" }),
    });
    expect(createRes.status).toBe(201);
    const fitting = (await createRes.json()) as { data: { id: string; name: string; productId: string } };
    expect(fitting.data.name).toBe("Slim");
    expect(fitting.data.productId).toBe(product.id);

    const listRes = await fetch(`${baseUrl}/api/products/${product.id}/fittings`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(list.data.map((f) => f.id)).toContain(fitting.data.id);

    const getRes = await fetch(`${baseUrl}/api/fittings/${fitting.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as { data: { id: string; values: unknown[] } };
    expect(got.data.id).toBe(fitting.data.id);
    expect(got.data.values).toEqual([]);

    const updateRes = await fetch(`${baseUrl}/api/fittings/${fitting.data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Regular" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: { name: string } };
    expect(updated.data.name).toBe("Regular");

    const deleteRes = await fetch(`${baseUrl}/api/fittings/${fitting.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);
  });

  it("full-replaces a fitting's values, actually removing the old set (not just adding the new one)", async () => {
    const product = await createProduct(managerA.token);
    const [defA, defB, defC] = await Promise.all([
      createMeasurementDefinition(managerA.token, `Chest${randomUUID()}`),
      createMeasurementDefinition(managerA.token, `Waist${randomUUID()}`),
      createMeasurementDefinition(managerA.token, `Length${randomUUID()}`),
    ]);

    const createRes = await fetch(`${baseUrl}/api/products/${product.id}/fittings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Slim" }),
    });
    const fitting = ((await createRes.json()) as { data: { id: string } }).data;

    const firstSetRes = await fetch(`${baseUrl}/api/fittings/${fitting.id}/values`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({
        values: [
          { measurementDefinitionId: defA.id, value: "1.50" },
          { measurementDefinitionId: defB.id, value: "-0.50" },
        ],
      }),
    });
    expect(firstSetRes.status).toBe(200);
    const firstSet = (await firstSetRes.json()) as { data: Array<{ measurementDefinitionId: string; value: string }> };
    expect(firstSet.data.map((v) => v.measurementDefinitionId).sort()).toEqual([defA.id, defB.id].sort());

    const getAfterFirst = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const gotAfterFirst = (await getAfterFirst.json()) as {
      data: { values: Array<{ measurementDefinitionId: string; measurementDefinition: { id: string } }> };
    };
    expect(gotAfterFirst.data.values).toHaveLength(2);

    const secondSetRes = await fetch(`${baseUrl}/api/fittings/${fitting.id}/values`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({
        values: [{ measurementDefinitionId: defC.id, value: "2.00" }],
      }),
    });
    expect(secondSetRes.status).toBe(200);

    const getAfterSecond = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const gotAfterSecond = (await getAfterSecond.json()) as {
      data: { values: Array<{ measurementDefinitionId: string; value: string }> };
    };
    expect(gotAfterSecond.data.values).toHaveLength(1);
    expect(gotAfterSecond.data.values[0]?.measurementDefinitionId).toBe(defC.id);
    expect(gotAfterSecond.data.values[0]?.value).toBe("2.00");
    // The old defA/defB rows must actually be gone, not merely absent from this listing's head.
    expect(gotAfterSecond.data.values.map((v) => v.measurementDefinitionId)).not.toContain(defA.id);
    expect(gotAfterSecond.data.values.map((v) => v.measurementDefinitionId)).not.toContain(defB.id);
  });

  it("is tenant-scoped: tenant B cannot see or modify tenant A's fitting", async () => {
    const product = await createProduct(managerA.token);
    const createRes = await fetch(`${baseUrl}/api/products/${product.id}/fittings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Isolation Test ${randomUUID()}` }),
    });
    const fitting = ((await createRes.json()) as { data: { id: string } }).data;

    const getAsB = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const updateAsB = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerB.token}` },
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(deleteAsB.status).toBe(404);
  });

  it("soft-deletes: the fitting 404s afterward but the row still exists in the DB", async () => {
    const { db } = await import("../src/db/index");
    const { productFittings } = await import("../src/db/schema/index");
    const { eq } = await import("drizzle-orm");

    const product = await createProduct(managerA.token);
    const createRes = await fetch(`${baseUrl}/api/products/${product.id}/fittings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `To Be Deleted ${randomUUID()}` }),
    });
    const fitting = ((await createRes.json()) as { data: { id: string } }).data;

    const deleteRes = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getRes = await fetch(`${baseUrl}/api/fittings/${fitting.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(getRes.status).toBe(404);

    const rows = await db.select().from(productFittings).where(eq(productFittings.id, fitting.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).not.toBeNull();
  });

  it("403s a create request from a user lacking catalog.fittings.manage", async () => {
    const product = await createProduct(managerA.token);
    const res = await fetch(`${baseUrl}/api/products/${product.id}/fittings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: "Should Not Be Created" }),
    });
    expect(res.status).toBe(403);
  });
});
