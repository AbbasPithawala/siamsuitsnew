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

async function patchJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
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

async function createOnePieceSuperProduct(baseUrl: string, ctx: Ctx, productId: string) {
  const res = await postJson(baseUrl, "/api/super-products", ctx.token, {
    name: `Jacket Only ${randomUUID()}`,
    components: [{ productId, slotLabel: "Jacket", sequence: 1 }],
  });
  const body = (await res.json()) as { data: { id: string; components: Array<{ id: string }> } };
  return body.data;
}

async function createSuperProduct(
  baseUrl: string,
  ctx: Ctx,
  name: string,
  components: Array<{ productId: string; slotLabel: string }>
) {
  const res = await postJson(baseUrl, "/api/super-products", ctx.token, {
    name: `${name} ${randomUUID()}`,
    components: components.map((c, i) => ({ ...c, sequence: i + 1 })),
  });
  const body = (await res.json()) as { data: { id: string; components: Array<{ id: string; productId: string; slotLabel: string }> } };
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

  // A third, independent pairing for the adjustment-only-change test below — same isolation
  // rationale as `productId2`/`superProduct2`.
  let productId3: string;
  let superProduct3: { id: string; components: Array<{ id: string }> };

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

    productId3 = await createProduct(baseUrl, owner, "Overcoat");
    superProduct3 = await createOnePieceSuperProduct(baseUrl, owner, productId3);
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

  it(
    "changedFromProfile compares total_value (body value + adjustment), matching legacy's own diff — " +
      "an adjustment-only edit with an unchanged body value still counts as changed",
    async () => {
      const firstRes = await postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: retailer.id,
        customerId,
        items: [
          {
            superProductId: superProduct3.id,
            components: [
              {
                superProductComponentId: superProduct3.components[0]!.id,
                measurements: [{ measurementDefinitionId: chestId, value: "40.00" }],
              },
            ],
          },
        ],
      });
      expect(firstRes.status).toBe(201);

      // Second order: body value unchanged (40.00 -> 40.00), only the adjustment changes (unset -> 1.00).
      const secondRes = await postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: retailer.id,
        customerId,
        items: [
          {
            superProductId: superProduct3.id,
            components: [
              {
                superProductComponentId: superProduct3.components[0]!.id,
                measurements: [{ measurementDefinitionId: chestId, value: "40.00", adjustmentValue: "1.00" }],
              },
            ],
          },
        ],
      });
      expect(secondRes.status).toBe(201);
      const second = (await secondRes.json()) as OrderResponse;
      const secondChest = second.data.items[0]?.components[0]?.measurements.find((m) => m.measurementDefinitionId === chestId);
      expect(secondChest?.value).toBe("40.00");
      expect(secondChest?.totalValue).toBe("41.00");
      expect(secondChest?.changedFromProfile).toBe(true);

      // Third order: total_value unchanged (41.00 -> 41.00, via a different value/adjustment split)
      // — not flagged, even though neither individual number matches the prior order's exactly.
      const thirdRes = await postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: retailer.id,
        customerId,
        items: [
          {
            superProductId: superProduct3.id,
            components: [
              {
                superProductComponentId: superProduct3.components[0]!.id,
                measurements: [{ measurementDefinitionId: chestId, value: "40.50", adjustmentValue: "0.50" }],
              },
            ],
          },
        ],
      });
      expect(thirdRes.status).toBe(201);
      const third = (await thirdRes.json()) as OrderResponse;
      const thirdChest = third.data.items[0]?.components[0]?.measurements.find((m) => m.measurementDefinitionId === chestId);
      expect(thirdChest?.totalValue).toBe("41.00");
      expect(thirdChest?.changedFromProfile).toBe(false);
    }
  );
});

describe(
  "orders.service — per-order baseline comparison (PHASE_10_TASKS.md follow-up: 'changed from profile' now compares each " +
    "component to a specific fixed prior order, not a shared mutable profile — fixes editing an older order silently " +
    "drifting/clobbering based on unrelated newer orders)",
  () => {
    let server: Server;
    let baseUrl: string;
    let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
    let retailer: Awaited<ReturnType<typeof createRetailer>>;

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
        "orders.edit",
        "customers.manage",
        "catalog.products.manage",
        "catalog.super_products.manage",
        "catalog.measurements.manage",
      ]);
      retailer = await createRetailer(owner.tenantId);
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await cleanupOrderTreeForRetailer(retailer.id);
      await cleanupRetailerScopedRowsForTenant(owner.tenantId);
      await owner.cleanup();
    });

    it(
      "a product missing from an intervening order is skipped, not treated as 'no baseline' — order 6's pant compares " +
        "against order 3's pant, correctly skipping order 5 (which has no pant at all)",
      async () => {
        const customerId = await createCustomer(baseUrl, owner, retailer.id);
        const jacketId = await createProduct(baseUrl, owner, "Jacket");
        const pantId = await createProduct(baseUrl, owner, "Pant");
        const shirtId = await createProduct(baseUrl, owner, "Shirt");
        const jacketChest = await createMeasurementDefinition(baseUrl, owner, "Jacket Chest");
        const pantWaist = await createMeasurementDefinition(baseUrl, owner, "Pant Waist");
        const shirtCollar = await createMeasurementDefinition(baseUrl, owner, "Shirt Collar");
        await Promise.all([
          fetch(`${baseUrl}/api/products/${jacketId}/measurements`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
            body: JSON.stringify({ measurementDefinitionIds: [jacketChest] }),
          }),
          fetch(`${baseUrl}/api/products/${pantId}/measurements`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
            body: JSON.stringify({ measurementDefinitionIds: [pantWaist] }),
          }),
          fetch(`${baseUrl}/api/products/${shirtId}/measurements`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
            body: JSON.stringify({ measurementDefinitionIds: [shirtCollar] }),
          }),
        ]);

        const suit = await createSuperProduct(baseUrl, owner, "Suit", [
          { productId: jacketId, slotLabel: "Jacket" },
          { productId: pantId, slotLabel: "Pant" },
        ]);
        const casual = await createSuperProduct(baseUrl, owner, "Casual", [
          { productId: jacketId, slotLabel: "Jacket" },
          { productId: shirtId, slotLabel: "Shirt" },
        ]);
        const suitJacketComponent = suit.components.find((c) => c.productId === jacketId)!;
        const suitPantComponent = suit.components.find((c) => c.productId === pantId)!;
        const casualJacketComponent = casual.components.find((c) => c.productId === jacketId)!;
        const casualShirtComponent = casual.components.find((c) => c.productId === shirtId)!;

        // Order 3: Suit — jacket chest 40.00, pant waist 30.00. First-ever orders for both
        // products, so both start with no baseline.
        const order3Res = await postJson(baseUrl, "/api/orders", owner.token, {
          retailerId: retailer.id,
          customerId,
          items: [
            {
              superProductId: suit.id,
              components: [
                { superProductComponentId: suitJacketComponent.id, measurements: [{ measurementDefinitionId: jacketChest, value: "40.00" }] },
                { superProductComponentId: suitPantComponent.id, measurements: [{ measurementDefinitionId: pantWaist, value: "30.00" }] },
              ],
            },
          ],
        });
        expect(order3Res.status).toBe(201);
        const order3 = (await order3Res.json()) as OrderResponse;
        const order3Jacket = order3.data.items[0]!.components.find((c) => c.measurements.some((m) => m.measurementDefinitionId === jacketChest))!;
        const order3Pant = order3.data.items[0]!.components.find((c) => c.measurements.some((m) => m.measurementDefinitionId === pantWaist))!;
        expect(order3Jacket.measurements[0]?.changedFromProfile).toBeNull();
        expect(order3Pant.measurements[0]?.changedFromProfile).toBeNull();

        // Order 5: Casual — jacket chest 42.00 (differs from order 3's jacket), shirt collar
        // 15.00 (first-ever shirt order, no baseline). No pant at all in this order.
        const order5Res = await postJson(baseUrl, "/api/orders", owner.token, {
          retailerId: retailer.id,
          customerId,
          items: [
            {
              superProductId: casual.id,
              components: [
                { superProductComponentId: casualJacketComponent.id, measurements: [{ measurementDefinitionId: jacketChest, value: "42.00" }] },
                { superProductComponentId: casualShirtComponent.id, measurements: [{ measurementDefinitionId: shirtCollar, value: "15.00" }] },
              ],
            },
          ],
        });
        expect(order5Res.status).toBe(201);
        const order5 = (await order5Res.json()) as OrderResponse;
        const order5Jacket = order5.data.items[0]!.components.find((c) => c.measurements.some((m) => m.measurementDefinitionId === jacketChest))!;
        const order5Shirt = order5.data.items[0]!.components.find((c) => c.measurements.some((m) => m.measurementDefinitionId === shirtCollar))!;
        // jacket: compares against order 3's jacket (40.00) — the customer's most recent prior jacket order.
        expect(order5Jacket.measurements[0]?.changedFromProfile).toBe(true);
        // shirt: no prior shirt order exists at all yet.
        expect(order5Shirt.measurements[0]?.changedFromProfile).toBeNull();

        // Order 6: Suit again — jacket chest 44.00, pant waist 30.00 (deliberately IDENTICAL
        // to order 3's pant, not order 5's — order 5 never had a pant at all).
        const order6Res = await postJson(baseUrl, "/api/orders", owner.token, {
          retailerId: retailer.id,
          customerId,
          items: [
            {
              superProductId: suit.id,
              components: [
                { superProductComponentId: suitJacketComponent.id, measurements: [{ measurementDefinitionId: jacketChest, value: "44.00" }] },
                { superProductComponentId: suitPantComponent.id, measurements: [{ measurementDefinitionId: pantWaist, value: "30.00" }] },
              ],
            },
          ],
        });
        expect(order6Res.status).toBe(201);
        const order6 = (await order6Res.json()) as OrderResponse;
        const order6Jacket = order6.data.items[0]!.components.find((c) => c.measurements.some((m) => m.measurementDefinitionId === jacketChest))!;
        const order6Pant = order6.data.items[0]!.components.find((c) => c.measurements.some((m) => m.measurementDefinitionId === pantWaist))!;
        // jacket: compares against order 5's jacket (42.00 vs 44.00) — genuinely changed.
        expect(order6Jacket.measurements[0]?.changedFromProfile).toBe(true);
        // pant: compares against order 3's pant (30.00 vs 30.00, skipping order 5 entirely,
        // which had no pant to compare against at all) — correctly unchanged, not null.
        expect(order6Pant.measurements[0]?.changedFromProfile).toBe(false);
      }
    );

    it(
      "editing an order keeps comparing against its own original fixed baseline even after a newer sibling order exists, " +
        "but DOES pick up that baseline order's own later edits (both explicitly confirmed, not assumed)",
      async () => {
        const customerId = await createCustomer(baseUrl, owner, retailer.id);
        const productId = await createProduct(baseUrl, owner, "Blazer");
        const defId = await createMeasurementDefinition(baseUrl, owner, "Shoulder");
        await fetch(`${baseUrl}/api/products/${productId}/measurements`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ measurementDefinitionIds: [defId] }),
        });
        const superProduct = await createOnePieceSuperProduct(baseUrl, owner, productId);
        const componentSlot = superProduct.components[0]!.id;

        async function placeOrder(value: string): Promise<{ id: string; componentId: string; changedFromProfile: boolean | null }> {
          const res = await postJson(baseUrl, "/api/orders", owner.token, {
            retailerId: retailer.id,
            customerId,
            items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value }] }] }],
          });
          expect(res.status).toBe(201);
          const body = (await res.json()) as OrderResponse;
          const item = body.data.items[0]!;
          const component = item.components[0]!;
          return { id: body.data.id, componentId: component.measurements[0]!.measurementDefinitionId, changedFromProfile: component.measurements[0]!.changedFromProfile };
        }

        // A (40, no baseline) -> B (45, baseline A, changed) -> C (50, baseline B, changed).
        const orderA = await placeOrder("40.00");
        expect(orderA.changedFromProfile).toBeNull();
        const orderB = await placeOrder("45.00");
        expect(orderB.changedFromProfile).toBe(true);
        const orderC = await placeOrder("50.00");
        expect(orderC.changedFromProfile).toBe(true);

        // Edit B back to exactly A's value (40.00). C already exists at this point. If B's
        // baseline had incorrectly shifted to "most recent other order" it would now compare
        // against C (50.00) and show `true`; comparing correctly against its own frozen
        // baseline (A, 40.00) shows `false` instead — the two are genuinely distinguishable.
        const orderBDetailRes1 = await getJson(baseUrl, `/api/orders/${orderB.id}`, owner.token);
        const orderBDetail1 = (await orderBDetailRes1.json()) as { data: { items: Array<{ id: string; components: Array<{ id: string }> }> } };
        const editB1 = await patchJson(baseUrl, `/api/orders/${orderB.id}`, owner.token, {
          items: [
            {
              id: orderBDetail1.data.items[0]!.id,
              superProductId: superProduct.id,
              components: [
                { id: orderBDetail1.data.items[0]!.components[0]!.id, superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value: "40.00" }] },
              ],
            },
          ],
        });
        expect(editB1.status).toBe(200);
        const editedB1 = (await editB1.json()) as OrderResponse;
        expect(editedB1.data.items[0]!.components[0]!.measurements[0]?.changedFromProfile).toBe(false);

        // Now edit A's own value to 45.00. B's baseline is still fixed to A's specific order —
        // but re-writing B again should now compare against A's NEW current value (45.00), by
        // explicit product decision (this session's discussion), not a value frozen at B's
        // original creation.
        const orderADetailRes = await getJson(baseUrl, `/api/orders/${orderA.id}`, owner.token);
        const orderADetail = (await orderADetailRes.json()) as { data: { items: Array<{ id: string; components: Array<{ id: string }> }> } };
        const editA = await patchJson(baseUrl, `/api/orders/${orderA.id}`, owner.token, {
          items: [
            {
              id: orderADetail.data.items[0]!.id,
              superProductId: superProduct.id,
              components: [
                { id: orderADetail.data.items[0]!.components[0]!.id, superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value: "45.00" }] },
              ],
            },
          ],
        });
        expect(editA.status).toBe(200);

        const orderBDetailRes = await getJson(baseUrl, `/api/orders/${orderB.id}`, owner.token);
        const orderBDetail = (await orderBDetailRes.json()) as { data: { items: Array<{ id: string; components: Array<{ id: string }> }> } };
        const editB2 = await patchJson(baseUrl, `/api/orders/${orderB.id}`, owner.token, {
          items: [
            {
              id: orderBDetail.data.items[0]!.id,
              superProductId: superProduct.id,
              components: [
                { id: orderBDetail.data.items[0]!.components[0]!.id, superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value: "40.00" }] },
              ],
            },
          ],
        });
        expect(editB2.status).toBe(200);
        const editedB2 = (await editB2.json()) as OrderResponse;
        // Same resubmitted value (40.00) as `editB1` above, but now flagged `true` — because A
        // (B's fixed baseline order) itself now holds 45.00, not the 40.00 it held before.
        expect(editedB2.data.items[0]!.components[0]!.measurements[0]?.changedFromProfile).toBe(true);
      }
    );

    it(
      "removing an order's component that a LATER order's baseline points at succeeds (onDelete: set null), " +
        "rather than failing with a foreign key violation — a real risk this same change introduced and had to guard against",
      async () => {
        const customerId = await createCustomer(baseUrl, owner, retailer.id);
        const productId = await createProduct(baseUrl, owner, "Cardigan");
        const defId = await createMeasurementDefinition(baseUrl, owner, "Length");
        await fetch(`${baseUrl}/api/products/${productId}/measurements`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ measurementDefinitionIds: [defId] }),
        });
        const superProduct = await createOnePieceSuperProduct(baseUrl, owner, productId);
        const componentSlot = superProduct.components[0]!.id;

        // Order X: a single component — the only candidate baseline for order Y below.
        const orderXRes = await postJson(baseUrl, "/api/orders", owner.token, {
          retailerId: retailer.id,
          customerId,
          items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value: "60.00" }] }] }],
        });
        expect(orderXRes.status).toBe(201);
        const orderX = (await orderXRes.json()) as OrderResponse;
        const orderXItemId = orderX.data.items[0]!.id;

        // Order Y: deterministically compares against (and stores baseline_component_id
        // pointing at) order X's one and only component.
        const orderYRes = await postJson(baseUrl, "/api/orders", owner.token, {
          retailerId: retailer.id,
          customerId,
          items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value: "62.00" }] }] }],
        });
        expect(orderYRes.status).toBe(201);
        const orderY = (await orderYRes.json()) as OrderResponse;
        expect(orderY.data.items[0]!.components[0]!.measurements[0]?.changedFromProfile).toBe(true);

        // Edit order X: resubmit its existing line item but with a component that has no `id`
        // — per `editOrderItems`' full-replace semantics, this deletes the old (now-unlisted)
        // component and inserts a fresh one in its place. The delete is the real exercise here:
        // it removes the exact row order Y's `baseline_component_id` points at. Must succeed
        // (200), not 500 with a Postgres foreign key violation.
        const editXRes = await patchJson(baseUrl, `/api/orders/${orderX.data.id}`, owner.token, {
          items: [
            {
              id: orderXItemId,
              superProductId: superProduct.id,
              components: [{ superProductComponentId: componentSlot, measurements: [{ measurementDefinitionId: defId, value: "60.50" }] }],
            },
          ],
        });
        expect(editXRes.status).toBe(200);

        // Order Y's own already-stored row is untouched by this — its `changed_from_profile`
        // was written once, at Y's own creation, and this edit to X never rewrites Y.
        const orderYRefetchRes = await getJson(baseUrl, `/api/orders/${orderY.data.id}`, owner.token);
        const orderYRefetch = (await orderYRefetchRes.json()) as OrderResponse;
        expect(orderYRefetch.data.items[0]!.components[0]!.measurements[0]?.changedFromProfile).toBe(true);
      }
    );
  }
);
