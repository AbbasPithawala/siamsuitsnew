import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/processes", () => {
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
      createTenantWithUser(["catalog.processes.manage", "catalog.products.manage"]),
      createTenantWithUser([]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await managerA.cleanup();
    await readOnlyA.cleanup();
  });

  it("creates a process and sets/reorders a product's process sequence", async () => {
    const productRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Jacket ${randomUUID()}` }),
    });
    const product = (await productRes.json()) as { data: { id: string } };

    const [cutting, stitching, pressing] = await Promise.all(
      ["Cutting", "Stitching", "Pressing"].map(async (name) => {
        const res = await fetch(`${baseUrl}/api/processes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
          body: JSON.stringify({ name: `${name} ${randomUUID()}` }),
        });
        expect(res.status).toBe(201);
        const body = (await res.json()) as { data: { id: string } };
        return body.data.id;
      })
    );

    const setRes = await fetch(`${baseUrl}/api/products/${product.data.id}/processes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ processIds: [cutting, stitching, pressing] }),
    });
    expect(setRes.status).toBe(200);
    const sequence = (await setRes.json()) as { data: Array<{ processId: string; sequenceOrder: number }> };
    expect(sequence.data.map((s) => s.processId)).toEqual([cutting, stitching, pressing]);
    expect(sequence.data.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);

    const reorderRes = await fetch(`${baseUrl}/api/products/${product.data.id}/processes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ processIds: [pressing, cutting, stitching] }),
    });
    const reordered = (await reorderRes.json()) as { data: Array<{ processId: string; sequenceOrder: number }> };
    expect(reordered.data.map((s) => s.processId)).toEqual([pressing, cutting, stitching]);

    const getRes = await fetch(`${baseUrl}/api/products/${product.data.id}/processes`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const fetched = (await getRes.json()) as { data: Array<{ processId: string }> };
    expect(fetched.data.map((s) => s.processId)).toEqual([pressing, cutting, stitching]);
  });

  it("403s a create request from a user lacking catalog.processes.manage", async () => {
    const res = await fetch(`${baseUrl}/api/processes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: `Should Not Be Created ${randomUUID()}` }),
    });
    expect(res.status).toBe(403);
  });
});
