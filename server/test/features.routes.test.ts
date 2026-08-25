import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

describe("/api/features", () => {
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
      createTenantWithUser(["catalog.features.manage", "catalog.products.manage"]),
      createTenantWithUser([]),
      createTenantWithUser(["catalog.features.manage", "catalog.products.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await managerA.cleanup();
    await readOnlyA.cleanup();
    await managerB.cleanup();
  });

  it("returns the full choice/style/style_option tree, plus linked products, in one GET call", async () => {
    const productRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Jacket ${randomUUID()}` }),
    });
    const product = (await productRes.json()) as { data: { id: string; name: string } };

    const featureRes = await fetch(`${baseUrl}/api/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Lapel Style", type: "choice", productIds: [product.data.id] }),
    });
    expect(featureRes.status).toBe(201);
    const feature = (await featureRes.json()) as { data: { id: string; type: string; products: Array<{ id: string }> } };
    expect(feature.data.type).toBe("choice");
    expect(feature.data.products.map((p) => p.id)).toEqual([product.data.id]);

    const styleRes = await fetch(`${baseUrl}/api/features/${feature.data.id}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Notch Lapel", price: "10.00" }),
    });
    expect(styleRes.status).toBe(201);
    const style = (await styleRes.json()) as { data: { id: string } };

    const optionRes = await fetch(`${baseUrl}/api/styles/${style.data.id}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Wide" }),
    });
    expect(optionRes.status).toBe(201);

    // The one-call read: filter by productId, confirm feature -> styles -> options arrives nested, no follow-up requests.
    const listRes = await fetch(`${baseUrl}/api/features?productId=${product.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as {
      data: Array<{
        id: string;
        type: string;
        products: Array<{ id: string; name: string }>;
        styles: Array<{ id: string; name: string; options: Array<{ id: string; name: string }> }>;
      }>;
    };

    const found = list.data.find((f) => f.id === feature.data.id);
    expect(found).toBeDefined();
    expect(found?.products.map((p) => p.id)).toEqual([product.data.id]);
    expect(found?.styles).toHaveLength(1);
    expect(found?.styles[0]?.name).toBe("Notch Lapel");
    expect(found?.styles[0]?.options).toHaveLength(1);
    expect(found?.styles[0]?.options[0]?.name).toBe("Wide");
  });

  it("is tenant-scoped: tenant B cannot see tenant A's feature", async () => {
    const featureRes = await fetch(`${baseUrl}/api/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Fabric ${randomUUID()}`, type: "text" }),
    });
    const feature = (await featureRes.json()) as { data: { id: string } };

    const getAsB = await fetch(`${baseUrl}/api/features/${feature.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/features`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((f) => f.id)).not.toContain(feature.data.id);
  });

  it("rejects creating a style under a non-choice feature", async () => {
    const featureRes = await fetch(`${baseUrl}/api/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Lining ${randomUUID()}`, type: "text" }),
    });
    const feature = (await featureRes.json()) as { data: { id: string } };

    const styleRes = await fetch(`${baseUrl}/api/features/${feature.data.id}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: "Should Fail" }),
    });
    expect(styleRes.status).toBe(400);
    const body = (await styleRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FEATURE_NOT_CHOICE");
  });

  it("sets a product's feature order via PUT /products/:id/features, reorders on re-call, and leaves other products' links untouched (PHASE_8_TASKS.md Group 1)", async () => {
    const productRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Order Test Product ${randomUUID()}` }),
    });
    const product = (await productRes.json()) as { data: { id: string } };

    const otherProductRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ name: `Other Product ${randomUUID()}` }),
    });
    const otherProduct = (await otherProductRes.json()) as { data: { id: string } };

    const suffix = randomUUID();
    const [featureARes, featureBRes] = await Promise.all([
      fetch(`${baseUrl}/api/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ name: `Fabric ${suffix}`, type: "text" }),
      }),
      fetch(`${baseUrl}/api/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ name: `Lining ${suffix}`, type: "text" }),
      }),
    ]);
    const featureA = ((await featureARes.json()) as { data: { id: string } }).data;
    const featureB = ((await featureBRes.json()) as { data: { id: string } }).data;

    // This feature belongs only to `otherProduct` — must survive `product`'s full-replace untouched.
    const linkOtherRes = await fetch(`${baseUrl}/api/products/${otherProduct.data.id}/features`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
      body: JSON.stringify({ featureIds: [featureA.id] }),
    });
    expect(linkOtherRes.status).toBe(200);

    async function linkAndFetchOrder(orderedIds: string[]) {
      const linkRes = await fetch(`${baseUrl}/api/products/${product.data.id}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerA.token}` },
        body: JSON.stringify({ featureIds: orderedIds }),
      });
      expect(linkRes.status).toBe(200);
      const getRes = await fetch(`${baseUrl}/api/features?productId=${product.data.id}`, {
        headers: { Authorization: `Bearer ${managerA.token}` },
      });
      const body = (await getRes.json()) as { data: Array<{ id: string }> };
      return body.data.map((f) => f.id);
    }

    expect(await linkAndFetchOrder([featureB.id, featureA.id])).toEqual([featureB.id, featureA.id]);
    expect(await linkAndFetchOrder([featureA.id, featureB.id])).toEqual([featureA.id, featureB.id]);

    // otherProduct's own link to featureA must still be intact.
    const otherGetRes = await fetch(`${baseUrl}/api/features?productId=${otherProduct.data.id}`, {
      headers: { Authorization: `Bearer ${managerA.token}` },
    });
    const otherBody = (await otherGetRes.json()) as { data: Array<{ id: string }> };
    expect(otherBody.data.map((f) => f.id)).toEqual([featureA.id]);
  });

  it("403s a create request from a user lacking catalog.features.manage", async () => {
    const res = await fetch(`${baseUrl}/api/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readOnlyA.token}` },
      body: JSON.stringify({ name: `Should Not Be Created ${randomUUID()}`, type: "text" }),
    });
    expect(res.status).toBe(403);
  });
});
