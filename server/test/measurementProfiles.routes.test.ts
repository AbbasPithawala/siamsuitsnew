import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers } from "../src/db/schema/index";
import { withTenant } from "../src/db/withTenant";
import { upsertCustomerMeasurementProfileValues } from "../src/services/measurementProfiles.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Ctx {
  token: string;
  tenantId: string;
}

/** Same bottom-up manual cascade `measurementProfiles.orderWritePath.test.ts` uses — needed here too since the new measurement-baseline describe block below places real orders (no cascading FK deletes in this schema by design). */
async function cleanupOrderTreeForRetailer(retailerId: string) {
  const orderRows = await db.query.orders.findMany({ where: (o, { eq }) => eq(o.retailerId, retailerId) });
  for (const order of orderRows) {
    const itemRows = await db.query.orderItems.findMany({ where: (i, { eq }) => eq(i.orderId, order.id) });
    for (const item of itemRows) {
      const componentRows = await db.query.orderItemComponents.findMany({ where: (c, { eq }) => eq(c.orderItemId, item.id) });
      for (const component of componentRows) {
        await db.execute(sql`delete from manufacturing_steps where order_item_component_id = ${component.id}`);
        await db.execute(sql`delete from order_item_component_measurements where order_item_component_id = ${component.id}`);
        await db.execute(sql`delete from order_item_component_features where order_item_component_id = ${component.id}`);
      }
      await db.execute(sql`delete from order_item_components where order_item_id = ${item.id}`);
    }
    await db.execute(sql`delete from order_items where order_id = ${order.id}`);
  }
  await db.execute(sql`delete from orders where retailer_id = ${retailerId}`);
}

/** No cascading deletes on retailer-owned rows (Phase 1 convention), so tear down bottom-up before the tenant itself. */
async function cleanupRetailerScopedRowsForTenant(tenantId: string): Promise<void> {
  await db.execute(
    sql`delete from customer_measurement_profile_values where profile_id in (select id from customer_measurement_profiles where tenant_id = ${tenantId})`
  );
  await db.execute(sql`delete from customer_measurement_profiles where tenant_id = ${tenantId}`);
  await db.execute(sql`delete from customers where retailer_id in (select id from retailers where tenant_id = ${tenantId})`);
  await db.execute(sql`delete from retailers where tenant_id = ${tenantId}`);
}

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Profile Test Retailer ${suffix}`, code: `PT${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

async function postJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function createProduct(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/products", ctx.token, { name: `${name} ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createCustomer(baseUrl: string, ctx: Ctx, retailerId: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/customers", ctx.token, { retailerId, firstName: `Customer ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createMeasurementDefinition(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const suffix = randomUUID();
  const res = await postJson(baseUrl, "/api/measurement-definitions", ctx.token, {
    name: `${name} ${suffix}`,
    slug: `${name.toLowerCase()}-${suffix}`,
  });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

describe("/api/customers/:customerId/measurement-profiles/:productId", () => {
  let server: Server;
  let baseUrl: string;

  let ownerA: Awaited<ReturnType<typeof createTenantWithUser>>;
  let ownerB: Awaited<ReturnType<typeof createTenantWithUser>>;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [ownerA, ownerB] = await Promise.all([
      createTenantWithUser(["customers.manage", "catalog.products.manage", "catalog.measurements.manage"]),
      createTenantWithUser(["customers.manage", "catalog.products.manage", "catalog.measurements.manage"]),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupRetailerScopedRowsForTenant(ownerA.tenantId);
    await cleanupRetailerScopedRowsForTenant(ownerB.tenantId);
    await ownerA.cleanup();
    await ownerB.cleanup();
  });

  it("round-trips: writing profile values via the internal upsert makes them visible on GET", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Jacket");
    const chestId = await createMeasurementDefinition(baseUrl, ownerA, "Chest");
    const waistId = await createMeasurementDefinition(baseUrl, ownerA, "Waist");

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [
        { measurementDefinitionId: chestId, value: "40.00", adjustmentValue: "0.50" },
        { measurementDefinitionId: waistId, value: "34.00" },
      ])
    );

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as {
      data: { customerId: string; productId: string; values: Array<{ measurementDefinitionId: string; value: string; totalValue: string }> } | null;
    };
    expect(body.data).not.toBeNull();
    expect(body.data?.customerId).toBe(customerId);
    expect(body.data?.productId).toBe(productId);
    expect(body.data?.values).toHaveLength(2);

    const chest = body.data?.values.find((v) => v.measurementDefinitionId === chestId);
    const waist = body.data?.values.find((v) => v.measurementDefinitionId === waistId);
    expect(chest?.value).toBe("40.00");
    expect(chest?.totalValue).toBe("40.50");
    expect(waist?.value).toBe("34.00");
  });

  it("returns null (not a 404) for a brand-new customer+product pairing with no profile yet", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Vest");

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });

  it("per-row upserts only the submitted measurement, leaving untouched ones exactly as they were", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Pant");
    const [a, b, c] = await Promise.all([
      createMeasurementDefinition(baseUrl, ownerA, "A"),
      createMeasurementDefinition(baseUrl, ownerA, "B"),
      createMeasurementDefinition(baseUrl, ownerA, "C"),
    ]);

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [
        { measurementDefinitionId: a!, value: "10.00" },
        { measurementDefinitionId: b!, value: "20.00" },
        { measurementDefinitionId: c!, value: "30.00" },
      ])
    );

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerId, productId, [{ measurementDefinitionId: a!, value: "11.00" }])
    );

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    const body = (await getRes.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(body.data.values).toHaveLength(3);

    const valueFor = (id: string) => body.data.values.find((v) => v.measurementDefinitionId === id)?.value;
    expect(valueFor(a!)).toBe("11.00");
    expect(valueFor(b!)).toBe("20.00");
    expect(valueFor(c!)).toBe("30.00");
  });

  it("is tenant-isolated: a session from tenant B gets 404 for tenant A's customer id", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerId = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Overcoat");

    const getRes = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerB.token}` },
    });
    expect(getRes.status).toBe(404);
  });

  it("is customer-isolated: a different customer's lookup for the same product never sees the other customer's profile", async () => {
    const retailer = await createRetailer(ownerA.tenantId);
    const customerX = await createCustomer(baseUrl, ownerA, retailer.id);
    const customerY = await createCustomer(baseUrl, ownerA, retailer.id);
    const productId = await createProduct(baseUrl, ownerA, "Trouser");
    const defId = await createMeasurementDefinition(baseUrl, ownerA, "Inseam");

    await withTenant(ownerA.tenantId, (tx) =>
      upsertCustomerMeasurementProfileValues(tx, ownerA.tenantId, customerX, productId, [{ measurementDefinitionId: defId, value: "32.00" }])
    );

    const getResX = await fetch(`${baseUrl}/api/customers/${customerX}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    const bodyX = (await getResX.json()) as { data: { values: unknown[] } | null };
    expect(bodyX.data?.values).toHaveLength(1);

    const getResY = await fetch(`${baseUrl}/api/customers/${customerY}/measurement-profiles/${productId}`, {
      headers: { Authorization: `Bearer ${ownerA.token}` },
    });
    const bodyY = (await getResY.json()) as { data: unknown };
    expect(bodyY.data).toBeNull();
  });
});

describe("/api/customers/:customerId/measurement-baseline/:productId (PHASE_10_TASKS.md follow-up — order-builder live checkmark)", () => {
  let server: Server;
  let baseUrl: string;
  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  const createdRetailerIds: string[] = [];

  async function createOnePieceSuperProduct(productId: string) {
    const res = await postJson(baseUrl, "/api/super-products", owner.token, {
      name: `Baseline Endpoint Fixture ${randomUUID()}`,
      components: [{ productId, slotLabel: "Jacket", sequence: 1 }],
    });
    const body = (await res.json()) as { data: { id: string; components: Array<{ id: string }> } };
    return body.data;
  }

  async function placeOrder(customerId: string, retailerId: string, superProductId: string, componentId: string, defId: string, value: string) {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId,
      customerId,
      items: [{ superProductId, components: [{ superProductComponentId: componentId, measurements: [{ measurementDefinitionId: defId, value }] }] }],
    });
    const body = (await res.json()) as { data: { id: string } };
    return body.data.id;
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    owner = await createTenantWithUser([
      "orders.create",
      "orders.view",
      "customers.manage",
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.measurements.manage",
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const retailerId of createdRetailerIds) await cleanupOrderTreeForRetailer(retailerId);
    await cleanupRetailerScopedRowsForTenant(owner.tenantId);
    await owner.cleanup();
  });

  it("returns null when no prior order for this product exists at all", async () => {
    const retailer = await createRetailer(owner.tenantId);
    createdRetailerIds.push(retailer.id);
    const customerId = await createCustomer(baseUrl, owner, retailer.id);
    const productId = await createProduct(baseUrl, owner, "Robe");

    const res = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-baseline/${productId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });

  it("returns the customer's most recent real order's measurements for this product — the exact same source the server's own write-path comparison uses", async () => {
    const retailer = await createRetailer(owner.tenantId);
    createdRetailerIds.push(retailer.id);
    const customerId = await createCustomer(baseUrl, owner, retailer.id);
    const productId = await createProduct(baseUrl, owner, "Waistcoat");
    const defId = await createMeasurementDefinition(baseUrl, owner, "Chest");
    await fetch(`${baseUrl}/api/products/${productId}/measurements`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ measurementDefinitionIds: [defId] }),
    });
    const superProduct = await createOnePieceSuperProduct(productId);
    const componentId = superProduct.components[0]!.id;

    await placeOrder(customerId, retailer.id, superProduct.id, componentId, defId, "40.00");
    await placeOrder(customerId, retailer.id, superProduct.id, componentId, defId, "42.00");

    const res = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-baseline/${productId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string; totalValue: string }> } | null };
    // No `excludeOrderId` supplied — this is the order-CREATION flow, nothing to exclude yet —
    // so this reflects the most recent real order placed so far (the second one, 42.00).
    expect(body.data?.values.find((v) => v.measurementDefinitionId === defId)?.value).toBe("42.00");
  });

  it("excludeOrderId skips that specific order — the edit-mode case, so an order's own not-yet-resaved component never counts as its own baseline", async () => {
    const retailer = await createRetailer(owner.tenantId);
    createdRetailerIds.push(retailer.id);
    const customerId = await createCustomer(baseUrl, owner, retailer.id);
    const productId = await createProduct(baseUrl, owner, "Tuxedo Jacket");
    const defId = await createMeasurementDefinition(baseUrl, owner, "Shoulder");
    await fetch(`${baseUrl}/api/products/${productId}/measurements`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ measurementDefinitionIds: [defId] }),
    });
    const superProduct = await createOnePieceSuperProduct(productId);
    const componentId = superProduct.components[0]!.id;

    const firstOrderId = await placeOrder(customerId, retailer.id, superProduct.id, componentId, defId, "50.00");
    const secondOrderId = await placeOrder(customerId, retailer.id, superProduct.id, componentId, defId, "52.00");

    // Without excluding anything: most recent order is the second one (52.00).
    const withoutExclude = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-baseline/${productId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const withoutExcludeBody = (await withoutExclude.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(withoutExcludeBody.data.values.find((v) => v.measurementDefinitionId === defId)?.value).toBe("52.00");

    // Excluding the second order (as if its own edit form were open, so it can't be its own
    // baseline) — falls back to the first (50.00). This is the exact edit-mode case.
    const excludingSecond = await fetch(
      `${baseUrl}/api/customers/${customerId}/measurement-baseline/${productId}?excludeOrderId=${secondOrderId}`,
      { headers: { Authorization: `Bearer ${owner.token}` } }
    );
    const excludingSecondBody = (await excludingSecond.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(excludingSecondBody.data.values.find((v) => v.measurementDefinitionId === defId)?.value).toBe("50.00");

    // Excluding the FIRST order instead (as if IT were the one being edited) — the second order
    // isn't excluded by this, so it's still the answer. Proves `excludeOrderId` targets exactly
    // the order named, not "everything before/after it".
    const excludingFirst = await fetch(
      `${baseUrl}/api/customers/${customerId}/measurement-baseline/${productId}?excludeOrderId=${firstOrderId}`,
      { headers: { Authorization: `Bearer ${owner.token}` } }
    );
    const excludingFirstBody = (await excludingFirst.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(excludingFirstBody.data.values.find((v) => v.measurementDefinitionId === defId)?.value).toBe("52.00");
  });

  it("is tenant-isolated: a session from a different tenant gets 404 for this tenant's customer id", async () => {
    const otherTenant = await createTenantWithUser(["customers.manage", "catalog.products.manage"]);
    try {
      const retailer = await createRetailer(owner.tenantId);
      createdRetailerIds.push(retailer.id);
      const customerId = await createCustomer(baseUrl, owner, retailer.id);
      const productId = await createProduct(baseUrl, owner, "Ascot");

      const res = await fetch(`${baseUrl}/api/customers/${customerId}/measurement-baseline/${productId}`, {
        headers: { Authorization: `Bearer ${otherTenant.token}` },
      });
      expect(res.status).toBe(404);
    } finally {
      await otherTenant.cleanup();
    }
  });
});
