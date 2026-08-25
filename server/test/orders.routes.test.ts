import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers, roles, rolePermissions, userRoles, users } from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Ctx {
  token: string;
}

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Order Test Retailer ${suffix}`, code: `OT${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

/** Adds another user (with its own role/permission set) to an *existing* tenant, so permission-gated tests can share the same retailer/customer/catalog fixtures without hitting cross-tenant 404s instead of the 403s they're meant to test. */
async function createUserInTenant(tenantId: string, permissionKeys: string[]) {
  const suffix = randomUUID();
  const [role] = await db.insert(roles).values({ tenantId, name: `Orders-${suffix}` }).returning();
  if (!role) throw new Error("Failed to create role");

  if (permissionKeys.length > 0) {
    const permissionRows = await db.query.permissions.findMany({ where: (p, { inArray }) => inArray(p.key, permissionKeys) });
    if (permissionRows.length !== permissionKeys.length) throw new Error(`Missing seeded permissions among [${permissionKeys.join(", ")}]`);
    for (const permission of permissionRows) {
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
    }
  }

  const passwordHash = await hashPassword("irrelevant-for-this-test");
  const [user] = await db
    .insert(users)
    .values({ tenantId, name: "Orders Test User", username: `orders-${suffix}`, passwordHash })
    .returning();
  if (!user) throw new Error("Failed to create user");
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id });

  const token = issueToken({ sub: user.id, tenantId, actorType: "user" });
  return {
    token,
    async cleanup() {
      await db.delete(userRoles).where(eq(userRoles.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
    },
  };
}

/** No cascading deletes on the order tree (Phase 1 convention), so tear down bottom-up. */
async function deleteOrderTreeForRetailer(retailerId: string) {
  const orderRows = await db.query.orders.findMany({ where: (o, { eq: eqOp }) => eqOp(o.retailerId, retailerId) });
  for (const order of orderRows) {
    const itemRows = await db.query.orderItems.findMany({ where: (i, { eq: eqOp }) => eqOp(i.orderId, order.id) });
    for (const item of itemRows) {
      const componentRows = await db.query.orderItemComponents.findMany({ where: (c, { eq: eqOp }) => eqOp(c.orderItemId, item.id) });
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

  // `buildOrder` (PHASE_10_TASKS.md Workstream D Group 2) writes a customer_measurement_
  // profiles row as a side effect of any order carrying measurements — must be torn down
  // before the retailer's customers, same FK-ordering reasoning as the order tree above.
  await db.execute(
    sql`delete from customer_measurement_profile_values where profile_id in (select id from customer_measurement_profiles where customer_id in (select id from customers where retailer_id = ${retailerId}))`
  );
  await db.execute(sql`delete from customer_measurement_profiles where customer_id in (select id from customers where retailer_id = ${retailerId})`);
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

async function createProcess(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/processes", ctx.token, { name: `${name} ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function setProductProcesses(baseUrl: string, ctx: Ctx, productId: string, processIds: string[]) {
  const res = await fetch(`${baseUrl}/api/products/${productId}/processes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({ processIds }),
  });
  if (res.status !== 200) throw new Error(`Failed to set product processes: ${res.status}`);
}

async function createSuperProduct(
  baseUrl: string,
  ctx: Ctx,
  name: string,
  components: Array<{ productId: string; slotLabel: string }>
): Promise<{ id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> }> {
  const res = await postJson(baseUrl, "/api/super-products", ctx.token, {
    name: `${name} ${randomUUID()}`,
    components: components.map((c, i) => ({ ...c, sequence: i + 1 })),
  });
  const body = (await res.json()) as { data: { id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> } };
  return body.data;
}

async function createCustomer(baseUrl: string, ctx: Ctx, retailerId: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/customers", ctx.token, { retailerId, firstName: `Customer ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createMeasurementDefinition(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const suffix = randomUUID();
  const res = await postJson(baseUrl, "/api/measurement-definitions", ctx.token, { name: `${name} ${suffix}`, slug: `${name.toLowerCase()}-${suffix}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createChoiceFeatureWithStyle(baseUrl: string, ctx: Ctx, productId: string) {
  const featureRes = await postJson(baseUrl, "/api/features", ctx.token, { name: `Lapel ${randomUUID()}`, type: "choice", productIds: [productId] });
  const feature = (await featureRes.json()) as { data: { id: string } };

  const createStyleRes = await fetch(`${baseUrl}/api/features/${feature.data.id}/styles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({ name: "Notch" }),
  });
  const style = (await createStyleRes.json()) as { data: { id: string } };

  return { featureId: feature.data.id, styleId: style.data.id };
}

describe("/api/orders", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noCreate: Awaited<ReturnType<typeof createUserInTenant>>;
  let noRush: Awaited<ReturnType<typeof createUserInTenant>>;
  let noRepeat: Awaited<ReturnType<typeof createUserInTenant>>;
  let noView: Awaited<ReturnType<typeof createUserInTenant>>;

  let retailer: Awaited<ReturnType<typeof createRetailer>>;
  let customerId: string;

  // Jacket: cutting -> stitching -> pressing (3 processes)
  // Pant: cutting -> pressing (2 processes)
  // Waistcoat: stitching (1 process)
  let jacketId: string;
  let pantId: string;
  let waistcoatId: string;
  let cuttingId: string;
  let stitchingId: string;
  let pressingId: string;

  let threePiece: { id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> };
  let onePiece: { id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> };

  let chestDefId: string;
  let lapel: { featureId: string; styleId: string };

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
      "orders.repeat",
      "orders.rush",
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.processes.manage",
      "catalog.measurements.manage",
      "catalog.features.manage",
      "customers.manage",
    ]);

    [noCreate, noRush, noRepeat, noView] = await Promise.all([
      createUserInTenant(owner.tenantId, ["orders.view"]),
      createUserInTenant(owner.tenantId, ["orders.create", "orders.view"]),
      createUserInTenant(owner.tenantId, ["orders.create", "orders.view"]),
      createUserInTenant(owner.tenantId, []),
    ]);

    retailer = await createRetailer(owner.tenantId);
    customerId = await createCustomer(baseUrl, owner, retailer.id);

    [jacketId, pantId, waistcoatId] = await Promise.all([
      createProduct(baseUrl, owner, "Jacket"),
      createProduct(baseUrl, owner, "Pant"),
      createProduct(baseUrl, owner, "Waistcoat"),
    ]);
    [cuttingId, stitchingId, pressingId] = await Promise.all([
      createProcess(baseUrl, owner, "Cutting"),
      createProcess(baseUrl, owner, "Stitching"),
      createProcess(baseUrl, owner, "Pressing"),
    ]);

    await Promise.all([
      setProductProcesses(baseUrl, owner, jacketId, [cuttingId, stitchingId, pressingId]),
      setProductProcesses(baseUrl, owner, pantId, [cuttingId, pressingId]),
      setProductProcesses(baseUrl, owner, waistcoatId, [stitchingId]),
    ]);

    threePiece = await createSuperProduct(baseUrl, owner, "Three Piece Suit", [
      { productId: jacketId, slotLabel: "Jacket" },
      { productId: pantId, slotLabel: "Pant" },
      { productId: waistcoatId, slotLabel: "Waistcoat" },
    ]);
    onePiece = await createSuperProduct(baseUrl, owner, "Jacket Only", [{ productId: jacketId, slotLabel: "Jacket" }]);

    chestDefId = await createMeasurementDefinition(baseUrl, owner, "Chest");
    lapel = await createChoiceFeatureWithStyle(baseUrl, owner, jacketId);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await deleteOrderTreeForRetailer(retailer.id);
    await db.execute(sql`delete from customers where retailer_id = ${retailer.id}`);
    await db.execute(sql`delete from retailers where id = ${retailer.id}`);

    await Promise.all([noCreate.cleanup(), noRush.cleanup(), noRepeat.cleanup(), noView.cleanup()]);
    await owner.cleanup();
  });

  it("creates an order against a 3-component super product with manufacturing_steps for all 3 components in correct per-component sequence", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: threePiece.id,
          components: threePiece.components.map((c) => {
            if (c.productId === jacketId) {
              return {
                superProductComponentId: c.id,
                measurements: [{ measurementDefinitionId: chestDefId, value: "40.00", adjustmentValue: "0.50" }],
                features: [{ featureId: lapel.featureId, styleId: lapel.styleId }],
              };
            }
            return { superProductComponentId: c.id };
          }),
        },
      ],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      data: {
        id: string;
        status: string;
        type: string;
        items: Array<{
          sequence: number;
          components: Array<{
            productId: string;
            slotLabel: string;
            measurements: Array<{ value: string; adjustmentValue: string; totalValue: string }>;
            features: Array<{ featureId: string; styleId: string }>;
            manufacturingSteps: Array<{ processId: string; sequenceOrder: number; status: string }>;
          }>;
        }>;
      };
    };

    expect(created.data.status).toBe("New Order");
    expect(created.data.type).toBe("normal");
    expect(created.data.items).toHaveLength(1);
    expect(created.data.items[0]?.sequence).toBe(1);
    expect(created.data.items[0]?.components).toHaveLength(3);

    const jacket = created.data.items[0]?.components.find((c) => c.productId === jacketId);
    const pant = created.data.items[0]?.components.find((c) => c.productId === pantId);
    const waistcoat = created.data.items[0]?.components.find((c) => c.productId === waistcoatId);

    expect(jacket?.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
    expect(jacket?.manufacturingSteps.map((s) => s.processId)).toEqual([cuttingId, stitchingId, pressingId]);
    expect(jacket?.manufacturingSteps.every((s) => s.status === "pending")).toBe(true);

    expect(pant?.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual([1, 2]);
    expect(pant?.manufacturingSteps.map((s) => s.processId)).toEqual([cuttingId, pressingId]);

    expect(waistcoat?.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual([1]);
    expect(waistcoat?.manufacturingSteps.map((s) => s.processId)).toEqual([stitchingId]);

    const totalSteps = created.data.items[0]!.components.reduce((sum, c) => sum + c.manufacturingSteps.length, 0);
    expect(totalSteps).toBe(6);

    expect(jacket?.measurements).toHaveLength(1);
    expect(jacket?.measurements[0]?.totalValue).toBe("40.50");
    expect(jacket?.features).toHaveLength(1);
    expect(jacket?.features[0]?.styleId).toBe(lapel.styleId);

    // Confirm the fetch-back detail endpoint returns the identical nested tree in one call.
    const getRes = await getJson(baseUrl, `/api/orders/${created.data.id}`, owner.token);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { data: { items: Array<{ components: unknown[] }> } };
    expect(fetched.data.items[0]?.components).toHaveLength(3);
  });

  it("creates an order against a 1-component super product identically (not hardcoded to 2 or 3 components)", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { data: { items: Array<{ components: Array<{ manufacturingSteps: Array<{ sequenceOrder: number }> }> }> } };
    expect(created.data.items).toHaveLength(1);
    expect(created.data.items[0]?.components).toHaveLength(1);
    expect(created.data.items[0]?.components[0]?.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
  });

  it("rejects an order missing one of the super product's real components", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: threePiece.id,
          components: threePiece.components.filter((c) => c.productId !== waistcoatId).map((c) => ({ superProductComponentId: c.id })),
        },
      ],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("COMPONENT_SET_MISMATCH");
  });

  it("rejects an order with an extra/unknown superProductComponentId", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: threePiece.id,
          components: [...threePiece.components.map((c) => ({ superProductComponentId: c.id })), { superProductComponentId: randomUUID() }],
        },
      ],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("COMPONENT_SET_MISMATCH");
  });

  it("rejects an order with a duplicated superProductComponentId", async () => {
    const jacketComponent = threePiece.components.find((c) => c.productId === jacketId)!;
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: threePiece.id,
          components: [{ superProductComponentId: jacketComponent.id }, { superProductComponentId: jacketComponent.id }],
        },
      ],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DUPLICATE_COMPONENT");
  });

  it("403s a create request from a user lacking orders.create", async () => {
    const res = await postJson(baseUrl, "/api/orders", noCreate.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(res.status).toBe(403);
  });

  it("403s an isRush:true request from a user lacking orders.rush, without silently dropping the flag", async () => {
    const res = await postJson(baseUrl, "/api/orders", noRush.token, {
      retailerId: retailer.id,
      customerId,
      isRush: true,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("orders.rush");
  });

  it("allows isRush:true for a user holding orders.rush", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      isRush: true,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { data: { isRush: boolean } };
    expect(created.data.isRush).toBe(true);
  });

  it("403s a repeatOfOrderId request from a user lacking orders.repeat", async () => {
    const res = await postJson(baseUrl, "/api/orders", noRepeat.token, {
      retailerId: retailer.id,
      customerId,
      repeatOfOrderId: randomUUID(),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("orders.repeat");
  });

  it("clones a prior order's item/component/measurement/feature tree verbatim when items are omitted, including measurementNote/stylingNote/referenceImage", async () => {
    const originalRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        {
          superProductId: threePiece.id,
          components: threePiece.components.map((c) => {
            if (c.productId === jacketId) {
              return {
                superProductComponentId: c.id,
                measurements: [{ measurementDefinitionId: chestDefId, value: "41.00" }],
                measurementNote: "chest is slightly uneven",
                stylingNote: "double-stitch the lapel",
                referenceImage: "https://example.com/ref-jacket.png",
              };
            }
            return { superProductComponentId: c.id };
          }),
        },
      ],
    });
    expect(originalRes.status).toBe(201);
    const original = (await originalRes.json()) as { data: { id: string; items: Array<{ components: Array<{ productId: string; slotLabel: string }> }> } };

    const repeatRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      repeatOfOrderId: original.data.id,
    });
    expect(repeatRes.status).toBe(201);
    const repeat = (await repeatRes.json()) as {
      data: {
        isRepeat: boolean;
        repeatOfOrderId: string;
        items: Array<{
          components: Array<{
            productId: string;
            slotLabel: string;
            measurements: Array<{ totalValue: string }>;
            manufacturingSteps: Array<{ status: string }>;
            measurementNote: string | null;
            stylingNote: string | null;
            referenceImage: string | null;
          }>;
        }>;
      };
    };

    expect(repeat.data.isRepeat).toBe(true);
    expect(repeat.data.repeatOfOrderId).toBe(original.data.id);
    expect(repeat.data.items).toHaveLength(1);
    expect(repeat.data.items[0]?.components.map((c) => c.slotLabel).sort()).toEqual(
      original.data.items[0]!.components.map((c) => c.slotLabel).sort()
    );

    const clonedJacket = repeat.data.items[0]?.components.find((c) => c.productId === jacketId);
    expect(clonedJacket?.measurements[0]?.totalValue).toBe("41.00");
    expect(clonedJacket?.measurementNote).toBe("chest is slightly uneven");
    expect(clonedJacket?.stylingNote).toBe("double-stitch the lapel");
    expect(clonedJacket?.referenceImage).toBe("https://example.com/ref-jacket.png");
    // Freshly generated steps for the new order, independent of the source order's steps.
    expect(clonedJacket?.manufacturingSteps.every((s) => s.status === "pending")).toBe(true);
  });

  it("accepts multiple items[] entries with the same superProductId and produces independent order_items rows with sequence = array index + 1", async () => {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [
        { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] },
        { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] },
        { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] },
      ],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      data: { items: Array<{ id: string; sequence: number; superProductId: string; components: Array<{ id: string }> }> };
    };

    expect(created.data.items).toHaveLength(3);
    expect(created.data.items.map((i) => i.sequence)).toEqual([1, 2, 3]);
    expect(new Set(created.data.items.map((i) => i.id)).size).toBe(3);
    expect(created.data.items.every((i) => i.superProductId === onePiece.id)).toBe(true);
    const componentIds = created.data.items.flatMap((i) => i.components.map((c) => c.id));
    expect(new Set(componentIds).size).toBe(3);
  });

  it("shared/per-unit correctness (Decision 3): a quantity-3 line item sent as 3 items[] entries shares byte-identical measurements/measurementNote across units but keeps features/stylingNote/referenceImage independently distinct", async () => {
    // Two more real styles on the same lapel feature, so each unit's chosen styleId is
    // genuinely distinct too, not just the note/image fields.
    const peakStyleRes = await fetch(`${baseUrl}/api/features/${lapel.featureId}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ name: "Peak" }),
    });
    const peakStyle = (await peakStyleRes.json()) as { data: { id: string } };
    const shawlStyleRes = await fetch(`${baseUrl}/api/features/${lapel.featureId}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ name: "Shawl" }),
    });
    const shawlStyle = (await shawlStyleRes.json()) as { data: { id: string } };

    const unitInputs = [
      { styleId: lapel.styleId, stylingNote: "unit 1 styling note", referenceImage: "https://example.com/unit-1.png" },
      { styleId: peakStyle.data.id, stylingNote: "unit 2 styling note", referenceImage: "https://example.com/unit-2.png" },
      { styleId: shawlStyle.data.id, stylingNote: "unit 3 styling note", referenceImage: "https://example.com/unit-3.png" },
    ];

    const sharedMeasurements = [{ measurementDefinitionId: chestDefId, value: "42.00", adjustmentValue: "1.00" }];
    const sharedMeasurementNote = "shared across all units of this line item";

    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: unitInputs.map((unit) => ({
        superProductId: onePiece.id,
        components: [
          {
            superProductComponentId: onePiece.components[0]!.id,
            measurements: sharedMeasurements,
            measurementNote: sharedMeasurementNote,
            features: [{ featureId: lapel.featureId, styleId: unit.styleId }],
            stylingNote: unit.stylingNote,
            referenceImage: unit.referenceImage,
          },
        ],
      })),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      data: {
        items: Array<{
          sequence: number;
          components: Array<{
            id: string;
            measurementNote: string | null;
            stylingNote: string | null;
            referenceImage: string | null;
            measurements: Array<{ measurementDefinitionId: string; value: string; adjustmentValue: string; totalValue: string }>;
            features: Array<{ featureId: string; styleId: string }>;
          }>;
        }>;
      };
    };

    expect(created.data.items).toHaveLength(3);
    const components = created.data.items.map((item) => {
      expect(item.components).toHaveLength(1);
      return item.components[0]!;
    });

    // 3 real, independent order_item_components rows.
    expect(new Set(components.map((c) => c.id)).size).toBe(3);

    // Byte-identical shared measurements + measurementNote across all 3 units (comparing
    // only the value fields — each row's own id/orderItemComponentId legitimately differs,
    // since these are 3 real, independent rows, not one shared row).
    const measurementSnapshots = components.map((c) =>
      JSON.stringify(c.measurements.map((m) => ({ measurementDefinitionId: m.measurementDefinitionId, value: m.value, adjustmentValue: m.adjustmentValue, totalValue: m.totalValue })))
    );
    expect(new Set(measurementSnapshots).size).toBe(1);
    expect(components.every((c) => c.measurements[0]?.totalValue === "43.00")).toBe(true);
    expect(components.every((c) => c.measurementNote === sharedMeasurementNote)).toBe(true);

    // Independently distinct features/stylingNote/referenceImage per unit.
    expect(components.map((c) => c.features[0]?.styleId)).toEqual(unitInputs.map((u) => u.styleId));
    expect(new Set(components.map((c) => c.features[0]?.styleId)).size).toBe(3);
    expect(components.map((c) => c.stylingNote)).toEqual(unitInputs.map((u) => u.stylingNote));
    expect(new Set(components.map((c) => c.stylingNote)).size).toBe(3);
    expect(components.map((c) => c.referenceImage)).toEqual(unitInputs.map((u) => u.referenceImage));
    expect(new Set(components.map((c) => c.referenceImage)).size).toBe(3);
  });

  it("401s a request with no token, and 403s GET for a user lacking orders.view", async () => {
    const noAuthRes = await fetch(`${baseUrl}/api/orders`);
    expect(noAuthRes.status).toBe(401);

    const noPermRes = await getJson(baseUrl, "/api/orders", noView.token);
    expect(noPermRes.status).toBe(403);
  });

  it("generates order numbers as retailerCode-NNNN and doesn't collide on concurrent creates", async () => {
    const freshRetailer = await createRetailer(owner.tenantId);
    const freshCustomerId = await createCustomer(baseUrl, owner, freshRetailer.id);

    const makeOrder = () =>
      postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: freshRetailer.id,
        customerId: freshCustomerId,
        items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
      });

    const first = await makeOrder();
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { data: { orderNumber: string } };
    expect(firstBody.data.orderNumber).toBe(`${freshRetailer.code}-0001`);

    const second = await makeOrder();
    const secondBody = (await second.json()) as { data: { orderNumber: string } };
    expect(secondBody.data.orderNumber).toBe(`${freshRetailer.code}-0002`);

    const concurrentResults = await Promise.all([makeOrder(), makeOrder(), makeOrder()]);
    for (const res of concurrentResults) expect(res.status).toBe(201);
    const concurrentBodies = (await Promise.all(concurrentResults.map((r) => r.json()))) as Array<{ data: { orderNumber: string } }>;
    const orderNumbers = concurrentBodies.map((b) => b.data.orderNumber);
    expect(new Set(orderNumbers).size).toBe(3);
    for (const num of orderNumbers) expect(num).toMatch(new RegExp(`^${freshRetailer.code}-\\d{4}$`));

    await deleteOrderTreeForRetailer(freshRetailer.id);
    await db.execute(sql`delete from customers where retailer_id = ${freshRetailer.id}`);
    await db.execute(sql`delete from retailers where id = ${freshRetailer.id}`);
  });
});
