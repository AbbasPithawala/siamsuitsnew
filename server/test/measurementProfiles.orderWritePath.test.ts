import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers } from "../src/db/schema/index";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Ctx {
  token: string;
}

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
    .values({ tenantId, name: `Write Path Test Retailer ${suffix}`, code: `WP${suffix.slice(0, 6).toUpperCase()}` })
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

async function getJson(baseUrl: string, path: string, token: string) {
  return fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
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

async function createOnePieceSuperProduct(baseUrl: string, ctx: Ctx, productId: string) {
  const res = await postJson(baseUrl, "/api/super-products", ctx.token, {
    name: `Jacket Only ${randomUUID()}`,
    components: [{ productId, slotLabel: "Jacket", sequence: 1 }],
  });
  const body = (await res.json()) as { data: { id: string; components: Array<{ id: string }> } };
  return body.data;
}

type OrderMeasurement = { measurementDefinitionId: string; value: string; adjustmentValue: string; totalValue: string; changedFromProfile: boolean | null };
interface OrderResponse {
  data: {
    id: string;
    items: Array<{ components: Array<{ measurements: OrderMeasurement[] }> }>;
  };
}

describe("orders.service#buildOrder — customer measurement profile write-path hook", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let retailer: Awaited<ReturnType<typeof createRetailer>>;
  let customerId: string;
  let productId: string;
  let superProduct: { id: string; components: Array<{ id: string }> };
  let chestId: string;
  let waistId: string;

  // A second, independent product/super-product for the "second order" test — kept
  // separate from `productId`/`superProduct` above so that test's own "first order" is
  // genuinely the first submission for that customer+product pairing (no profile carried
  // over from the earlier test in this file), not an artifact of test execution order.
  let productId2: string;
  let superProduct2: { id: string; components: Array<{ id: string }> };

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

    retailer = await createRetailer(owner.tenantId);
    customerId = await createCustomer(baseUrl, owner, retailer.id);
    productId = await createProduct(baseUrl, owner, "Jacket");
    superProduct = await createOnePieceSuperProduct(baseUrl, owner, productId);
    chestId = await createMeasurementDefinition(baseUrl, owner, "Chest");
    waistId = await createMeasurementDefinition(baseUrl, owner, "Waist");

    productId2 = await createProduct(baseUrl, owner, "Vest");
    superProduct2 = await createOnePieceSuperProduct(baseUrl, owner, productId2);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupOrderTreeForRetailer(retailer.id);
    await cleanupRetailerScopedRowsForTenant(owner.tenantId);
    await owner.cleanup();
  });

  it("a first order with no prior profile: profile gets created with the submitted values, and every measurement's changedFromProfile is null", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: superProduct.id,
          components: [
            {
              superProductComponentId: superProduct.components[0]!.id,
              measurements: [
                { measurementDefinitionId: chestId, value: "40.00" },
                { measurementDefinitionId: waistId, value: "34.00" },
              ],
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as OrderResponse;
    const measurements = created.data.items[0]?.components[0]?.measurements ?? [];
    expect(measurements).toHaveLength(2);
    expect(measurements.every((m) => m.changedFromProfile === null)).toBe(true);

    const profileRes = await getJson(baseUrl, `/api/customers/${customerId}/measurement-profiles/${productId}`, owner.token);
    const profile = (await profileRes.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(profile.data.values).toHaveLength(2);
    expect(profile.data.values.find((v) => v.measurementDefinitionId === chestId)?.value).toBe("40.00");
    expect(profile.data.values.find((v) => v.measurementDefinitionId === waistId)?.value).toBe("34.00");
  });

  it("a second order for the same customer+product: profile updates, own rows show true/false correctly, and the FIRST order's own rows are frozen", async () => {
    const firstRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: superProduct2.id,
          components: [
            {
              superProductComponentId: superProduct2.components[0]!.id,
              measurements: [
                { measurementDefinitionId: chestId, value: "38.00" },
                { measurementDefinitionId: waistId, value: "32.00" },
              ],
            },
          ],
        },
      ],
    });
    expect(firstRes.status).toBe(201);
    const first = (await firstRes.json()) as OrderResponse;
    const firstMeasurementsBefore = first.data.items[0]?.components[0]?.measurements ?? [];
    const firstChestBefore = firstMeasurementsBefore.find((m) => m.measurementDefinitionId === chestId);
    const firstWaistBefore = firstMeasurementsBefore.find((m) => m.measurementDefinitionId === waistId);
    // This really is the first order ever placed for this customer+product2 pairing.
    expect(firstChestBefore?.changedFromProfile).toBeNull();
    expect(firstWaistBefore?.changedFromProfile).toBeNull();

    // Second order: chest differs (38.00 -> 41.00), waist matches (32.00 -> 32.00).
    const secondRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: superProduct2.id,
          components: [
            {
              superProductComponentId: superProduct2.components[0]!.id,
              measurements: [
                { measurementDefinitionId: chestId, value: "41.00" },
                { measurementDefinitionId: waistId, value: "32.00" },
              ],
            },
          ],
        },
      ],
    });
    expect(secondRes.status).toBe(201);
    const second = (await secondRes.json()) as OrderResponse;
    const secondMeasurements = second.data.items[0]?.components[0]?.measurements ?? [];
    const secondChest = secondMeasurements.find((m) => m.measurementDefinitionId === chestId);
    const secondWaist = secondMeasurements.find((m) => m.measurementDefinitionId === waistId);
    expect(secondChest?.changedFromProfile).toBe(true);
    expect(secondWaist?.changedFromProfile).toBe(false);

    // The profile now reflects the second order's submission.
    const profileRes = await getJson(baseUrl, `/api/customers/${customerId}/measurement-profiles/${productId2}`, owner.token);
    const profile = (await profileRes.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(profile.data.values.find((v) => v.measurementDefinitionId === chestId)?.value).toBe("41.00");
    expect(profile.data.values.find((v) => v.measurementDefinitionId === waistId)?.value).toBe("32.00");

    // Frozen-snapshot proof: re-fetching the FIRST order shows its own stored rows are completely unchanged.
    const firstRefetchRes = await getJson(baseUrl, `/api/orders/${first.data.id}`, owner.token);
    const firstRefetch = (await firstRefetchRes.json()) as OrderResponse;
    const firstMeasurementsAfter = firstRefetch.data.items[0]?.components[0]?.measurements ?? [];
    const firstChestAfter = firstMeasurementsAfter.find((m) => m.measurementDefinitionId === chestId);
    const firstWaistAfter = firstMeasurementsAfter.find((m) => m.measurementDefinitionId === waistId);

    expect(firstChestAfter?.value).toBe(firstChestBefore?.value);
    expect(firstChestAfter?.changedFromProfile).toBe(firstChestBefore?.changedFromProfile);
    expect(firstWaistAfter?.value).toBe(firstWaistBefore?.value);
    expect(firstWaistAfter?.changedFromProfile).toBe(firstWaistBefore?.changedFromProfile);
    // Sanity: the first order's own values are still "38.00"/"32.00", not silently rewritten to the second order's.
    expect(firstChestAfter?.value).toBe("38.00");
    expect(firstWaistAfter?.value).toBe("32.00");
  });
});
