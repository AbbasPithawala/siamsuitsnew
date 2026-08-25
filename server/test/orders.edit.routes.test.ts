import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers, retailerUsers, roles, rolePermissions, userRoles, users } from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Ctx {
  token: string;
}

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Order Edit Test Retailer ${suffix}`, code: `OE${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

/** Mirrors `orders.routes.test.ts`'s helper of the same purpose: another user in the same tenant, holding exactly the given permissions. */
async function createUserInTenant(tenantId: string, permissionKeys: string[]) {
  const suffix = randomUUID();
  const [role] = await db.insert(roles).values({ tenantId, name: `OrdersEdit-${suffix}` }).returning();
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
    .values({ tenantId, name: "Orders Edit Test User", username: `orders-edit-${suffix}`, passwordHash })
    .returning();
  if (!user) throw new Error("Failed to create user");
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id });

  const token = issueToken({ sub: user.id, tenantId, actorType: "user" });
  return {
    userId: user.id,
    roleId: role.id,
    token,
    async cleanup() {
      await db.delete(userRoles).where(eq(userRoles.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
    },
  };
}

/**
 * A real login-capable user linked to `retailerId` via `retailer_users`, holding the given
 * permissions directly (not the seeded "Retailer" role) — same isolation-from-permission-
 * concerns pattern `retailerIsolation.routes.test.ts` already established, needed here
 * because the real seeded Retailer role never holds `orders.edit` (Group 5's whole point).
 */
async function createRetailerLinkedUser(tenantId: string, retailerId: string, permissionKeys: string[]) {
  const suffix = randomUUID();
  const [role] = await db.insert(roles).values({ tenantId, name: `OrdersEditRetailerLinked-${suffix}` }).returning();
  if (!role) throw new Error("Failed to create role");

  const permissionRows = await db.query.permissions.findMany({ where: (p, { inArray }) => inArray(p.key, permissionKeys) });
  if (permissionRows.length !== permissionKeys.length) throw new Error(`Missing seeded permissions among [${permissionKeys.join(", ")}]`);
  for (const permission of permissionRows) {
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
  }

  const passwordHash = await hashPassword("irrelevant-for-this-test");
  const [user] = await db
    .insert(users)
    .values({ tenantId, name: "Retailer Linked Edit Test User", username: `orders-edit-ret-${suffix}`, passwordHash })
    .returning();
  if (!user) throw new Error("Failed to create user");
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
  await db.insert(retailerUsers).values({ userId: user.id, retailerId });

  const token = issueToken({ sub: user.id, tenantId, actorType: "user" });
  return {
    userId: user.id,
    roleId: role.id,
    token,
    async cleanup() {
      await db.delete(retailerUsers).where(eq(retailerUsers.userId, user.id));
      await db.delete(userRoles).where(eq(userRoles.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
    },
  };
}

/** No cascading deletes on the order tree (Phase 1 convention), so tear down bottom-up. Mirrors `orders.routes.test.ts`. */
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

async function patchJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
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

async function createChoiceFeatureWithStyle(baseUrl: string, ctx: Ctx, productId: string, styleName = "Notch") {
  const featureRes = await postJson(baseUrl, "/api/features", ctx.token, { name: `Lapel ${randomUUID()}`, type: "choice", productIds: [productId] });
  const feature = (await featureRes.json()) as { data: { id: string } };

  const createStyleRes = await fetch(`${baseUrl}/api/features/${feature.data.id}/styles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({ name: styleName }),
  });
  const style = (await createStyleRes.json()) as { data: { id: string } };

  return { featureId: feature.data.id, styleId: style.data.id };
}

interface OrderComponent {
  id: string;
  productId: string;
  slotLabel: string;
  measurementNote: string | null;
  stylingNote: string | null;
  referenceImage: string | null;
  manualSizeImage: string | null;
  measurements: Array<{ measurementDefinitionId: string; value: string; adjustmentValue: string; totalValue: string; changedFromProfile: boolean | null }>;
  features: Array<{ featureId: string; styleId: string | null }>;
  manufacturingSteps: Array<{ id: string; processId: string; sequenceOrder: number; status: string }>;
}
interface OrderItem {
  id: string;
  sequence: number;
  superProductId: string;
  components: OrderComponent[];
}
interface OrderDetail {
  id: string;
  status: string;
  retailerId: string;
  lastModifiedAt: string | null;
  items: OrderItem[];
}

describe("PATCH /api/orders/:id — order edit surface (PHASE_10_TASKS.md Workstream E Group 6.2)", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noEdit: Awaited<ReturnType<typeof createUserInTenant>>;

  let retailer: Awaited<ReturnType<typeof createRetailer>>;
  let retailer2: Awaited<ReturnType<typeof createRetailer>>;
  let customerId: string;

  let jacketId: string;
  let pantId: string;
  let cuttingId: string;
  let pressingId: string;

  let onePiece: { id: string; components: Array<{ id: string; productId: string; slotLabel: string }> };

  let chestDefId: string;
  let lapel: { featureId: string; styleId: string };
  let peakStyleId: string;

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
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.processes.manage",
      "catalog.measurements.manage",
      "catalog.features.manage",
      "customers.manage",
    ]);

    // Holds the real seeded Retailer role's exact 7-key bundle (PHASE_10_TASKS.md
    // Workstream E Group 3) — explicitly does NOT include `orders.edit`.
    noEdit = await createUserInTenant(owner.tenantId, [
      "customers.manage",
      "orders.create",
      "orders.view",
      "orders.repeat",
      "orders.group.create",
      "invoices.view",
      "shipping.view",
    ]);

    retailer = await createRetailer(owner.tenantId);
    retailer2 = await createRetailer(owner.tenantId);
    customerId = await createCustomer(baseUrl, owner, retailer.id);

    [jacketId, pantId] = await Promise.all([createProduct(baseUrl, owner, "Jacket"), createProduct(baseUrl, owner, "Pant")]);
    const processRes1 = await postJson(baseUrl, "/api/processes", owner.token, { name: `Cutting ${randomUUID()}` });
    cuttingId = ((await processRes1.json()) as { data: { id: string } }).data.id;
    const processRes2 = await postJson(baseUrl, "/api/processes", owner.token, { name: `Pressing ${randomUUID()}` });
    pressingId = ((await processRes2.json()) as { data: { id: string } }).data.id;

    await fetch(`${baseUrl}/api/products/${jacketId}/processes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ processIds: [cuttingId, pressingId] }),
    });

    onePiece = await createSuperProduct(baseUrl, owner, "Jacket Only", [{ productId: jacketId, slotLabel: "Jacket" }]);

    chestDefId = await createMeasurementDefinition(baseUrl, owner, "Chest");
    lapel = await createChoiceFeatureWithStyle(baseUrl, owner, jacketId, "Notch");
    const peakStyleRes = await fetch(`${baseUrl}/api/features/${lapel.featureId}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ name: "Peak" }),
    });
    peakStyleId = ((await peakStyleRes.json()) as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await deleteOrderTreeForRetailer(retailer.id);
    await deleteOrderTreeForRetailer(retailer2.id);
    await db.execute(sql`delete from customers where retailer_id in (${retailer.id}, ${retailer2.id})`);
    await db.execute(sql`delete from retailers where id in (${retailer.id}, ${retailer2.id})`);
    await noEdit.cleanup();
    await owner.cleanup();
  });

  async function createBaseOrder(items: unknown[]) {
    const res = await postJson(baseUrl, "/api/orders", owner.token, { retailerId: retailer.id, customerId, items });
    expect(res.status).toBe(201);
    return (await res.json()) as { data: OrderDetail };
  }

  it("adds a new line item, removes an existing one, and edits a kept unit's measurements/styling — preserving manufacturing_steps for untouched components and generating fresh ones only for new ones", async () => {
    const created = await createBaseOrder([
      {
        superProductId: onePiece.id,
        components: [
          {
            superProductComponentId: onePiece.components[0]!.id,
            measurements: [{ measurementDefinitionId: chestDefId, value: "40.00" }],
            measurementNote: "original note",
            features: [{ featureId: lapel.featureId, styleId: lapel.styleId }],
            stylingNote: "original styling",
          },
        ],
      },
      {
        superProductId: onePiece.id,
        components: [{ superProductComponentId: onePiece.components[0]!.id, measurements: [{ measurementDefinitionId: chestDefId, value: "40.00" }] }],
      },
    ]);

    expect(created.data.items).toHaveLength(2);
    expect(created.data.lastModifiedAt).toBeNull();
    const [keptItem, droppedItem] = created.data.items;
    const keptComponentId = keptItem!.components[0]!.id;
    const originalStepIds = keptItem!.components[0]!.manufacturingSteps.map((s) => s.id).sort();
    expect(originalStepIds).toHaveLength(2);

    const editRes = await patchJson(baseUrl, `/api/orders/${created.data.id}`, owner.token, {
      items: [
        {
          id: keptItem!.id,
          superProductId: onePiece.id,
          components: [
            {
              id: keptComponentId,
              superProductComponentId: onePiece.components[0]!.id,
              measurements: [{ measurementDefinitionId: chestDefId, value: "41.50" }],
              measurementNote: "edited note",
              features: [{ featureId: lapel.featureId, styleId: peakStyleId }],
              stylingNote: "edited styling",
            },
          ],
        },
        {
          superProductId: onePiece.id,
          components: [{ superProductComponentId: onePiece.components[0]!.id, measurements: [{ measurementDefinitionId: chestDefId, value: "39.00" }] }],
        },
      ],
    });
    expect(editRes.status).toBe(200);
    const edited = (await editRes.json()) as { data: OrderDetail };

    expect(edited.data.status).toBe("Modified");
    expect(edited.data.lastModifiedAt).not.toBeNull();
    expect(edited.data.items).toHaveLength(2);

    const editedKept = edited.data.items.find((i) => i.id === keptItem!.id)!;
    expect(editedKept.components[0]!.measurements[0]?.totalValue).toBe("41.50");
    expect(editedKept.components[0]!.measurementNote).toBe("edited note");
    expect(editedKept.components[0]!.stylingNote).toBe("edited styling");
    expect(editedKept.components[0]!.features[0]?.styleId).toBe(peakStyleId);
    // Manufacturing steps for the untouched-but-kept component are the SAME rows, not regenerated.
    expect(editedKept.components[0]!.manufacturingSteps.map((s) => s.id).sort()).toEqual(originalStepIds);

    expect(edited.data.items.map((i) => i.id)).not.toContain(droppedItem!.id);

    const newItem = edited.data.items.find((i) => i.id !== keptItem!.id)!;
    expect(newItem.components[0]!.measurements[0]?.totalValue).toBe("39.00");
    expect(newItem.components[0]!.manufacturingSteps).toHaveLength(2);
    expect(newItem.components[0]!.manufacturingSteps.every((s) => s.status === "pending")).toBe(true);

    const refetchRes = await getJson(baseUrl, `/api/orders/${created.data.id}`, owner.token);
    const refetched = (await refetchRes.json()) as { data: OrderDetail };
    expect(refetched.data.items).toHaveLength(2);
    expect(refetched.data.items.map((i) => i.id)).not.toContain(droppedItem!.id);
  });

  it("shared/per-unit correctness via edit (mirrors the create-path proof): resubmitting identical measurements/measurementNote/manualSizeImage across sibling units stores them byte-identical, keeping styling independently distinct", async () => {
    const created = await createBaseOrder([
      { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id, stylingNote: "unit 1 original" }] },
      { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id, stylingNote: "unit 2 original" }] },
      { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id, stylingNote: "unit 3 original" }] },
    ]);
    expect(created.data.items).toHaveLength(3);

    const sharedMeasurements = [{ measurementDefinitionId: chestDefId, value: "44.00", adjustmentValue: "0.50" }];
    const sharedNote = "shared across siblings via edit";
    const sharedManualSizeImage = "https://example.com/manual-size-shared.png";

    const editRes = await patchJson(baseUrl, `/api/orders/${created.data.id}`, owner.token, {
      items: created.data.items.map((item, index) => ({
        id: item.id,
        superProductId: onePiece.id,
        components: [
          {
            id: item.components[0]!.id,
            superProductComponentId: onePiece.components[0]!.id,
            measurements: sharedMeasurements,
            measurementNote: sharedNote,
            manualSizeImage: sharedManualSizeImage,
            stylingNote: `unit ${index + 1} edited`,
          },
        ],
      })),
    });
    expect(editRes.status).toBe(200);
    const edited = (await editRes.json()) as { data: OrderDetail };

    const components = edited.data.items.map((i) => i.components[0]!);
    expect(components).toHaveLength(3);

    const measurementSnapshots = components.map((c) => JSON.stringify(c.measurements.map((m) => ({ v: m.value, a: m.adjustmentValue, t: m.totalValue }))));
    expect(new Set(measurementSnapshots).size).toBe(1);
    expect(components.every((c) => c.measurements[0]?.totalValue === "44.50")).toBe(true);
    expect(components.every((c) => c.measurementNote === sharedNote)).toBe(true);
    expect(components.every((c) => c.manualSizeImage === sharedManualSizeImage)).toBe(true);

    expect(new Set(components.map((c) => c.stylingNote)).size).toBe(3);
  });

  it("an edit updates customer_measurement_profiles the same way order creation does", async () => {
    const created = await createBaseOrder([
      {
        superProductId: onePiece.id,
        components: [{ superProductComponentId: onePiece.components[0]!.id, measurements: [{ measurementDefinitionId: chestDefId, value: "36.00" }] }],
      },
    ]);
    const item = created.data.items[0]!;

    const editRes = await patchJson(baseUrl, `/api/orders/${created.data.id}`, owner.token, {
      items: [
        {
          id: item.id,
          superProductId: onePiece.id,
          components: [
            {
              id: item.components[0]!.id,
              superProductComponentId: onePiece.components[0]!.id,
              measurements: [{ measurementDefinitionId: chestDefId, value: "37.25" }],
            },
          ],
        },
      ],
    });
    expect(editRes.status).toBe(200);
    const edited = (await editRes.json()) as { data: OrderDetail };
    expect(edited.data.items[0]!.components[0]!.measurements[0]?.changedFromProfile).toBe(true);

    const profileRes = await getJson(baseUrl, `/api/customers/${customerId}/measurement-profiles/${jacketId}`, owner.token);
    const profile = (await profileRes.json()) as { data: { values: Array<{ measurementDefinitionId: string; value: string }> } };
    expect(profile.data.values.find((v) => v.measurementDefinitionId === chestDefId)?.value).toBe("37.25");
  });

  it("PATCH /orders/:id/status (cancel) touches nothing but the order's own status/lastModifiedAt — no side effects on items/measurements/manufacturing_steps", async () => {
    const created = await createBaseOrder([
      {
        superProductId: onePiece.id,
        components: [{ superProductComponentId: onePiece.components[0]!.id, measurements: [{ measurementDefinitionId: chestDefId, value: "40.00" }] }],
      },
    ]);
    expect(created.data.status).toBe("New Order");

    const cancelRes = await patchJson(baseUrl, `/api/orders/${created.data.id}/status`, owner.token, { status: "Cancelled" });
    expect(cancelRes.status).toBe(200);
    const cancelled = (await cancelRes.json()) as { data: OrderDetail };
    expect(cancelled.data.status).toBe("Cancelled");
    expect(cancelled.data.lastModifiedAt).not.toBeNull();

    expect(cancelled.data.items).toHaveLength(created.data.items.length);
    expect(cancelled.data.items[0]!.components[0]!.measurements).toEqual(created.data.items[0]!.components[0]!.measurements);
    expect(cancelled.data.items[0]!.components[0]!.manufacturingSteps.map((s) => s.id).sort()).toEqual(
      created.data.items[0]!.components[0]!.manufacturingSteps.map((s) => s.id).sort()
    );
  });

  it("PATCH /orders/:id/retailer reassigns the order's retailerId", async () => {
    const created = await createBaseOrder([
      { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] },
    ]);
    expect(created.data.retailerId).toBe(retailer.id);

    const reassignRes = await patchJson(baseUrl, `/api/orders/${created.data.id}/retailer`, owner.token, { retailerId: retailer2.id });
    expect(reassignRes.status).toBe(200);
    const reassigned = (await reassignRes.json()) as { data: OrderDetail };
    expect(reassigned.data.retailerId).toBe(retailer2.id);
    expect(reassigned.data.lastModifiedAt).not.toBeNull();

    // Move it back so this order's later cleanup (by original retailer.id) still finds it.
    await patchJson(baseUrl, `/api/orders/${created.data.id}/retailer`, owner.token, { retailerId: retailer.id });
  });

  it("422s an edit that references an id not belonging to this order", async () => {
    const created = await createBaseOrder([
      { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] },
    ]);
    const editRes = await patchJson(baseUrl, `/api/orders/${created.data.id}`, owner.token, {
      items: [{ id: randomUUID(), superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(editRes.status).toBe(422);
    const body = (await editRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ORDER_ITEM_NOT_FOUND");
  });

  it("403s the edit, status, and retailer routes for a session holding the real Retailer permission bundle (no orders.edit), even for its own tenant's order", async () => {
    const created = await createBaseOrder([
      { superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] },
    ]);

    const editRes = await patchJson(baseUrl, `/api/orders/${created.data.id}`, noEdit.token, {
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(editRes.status).toBe(403);

    const statusRes = await patchJson(baseUrl, `/api/orders/${created.data.id}/status`, noEdit.token, { status: "Cancelled" });
    expect(statusRes.status).toBe(403);

    const retailerRes = await patchJson(baseUrl, `/api/orders/${created.data.id}/retailer`, noEdit.token, { retailerId: retailer2.id });
    expect(retailerRes.status).toBe(403);
  });

  describe("row-level retailer isolation (PHASE_10_TASKS.md Workstream E Group 2 convention)", () => {
    it("a retailer-linked actor holding orders.edit cannot edit, status-transition, or reassign another retailer's order — 404, not fetched", async () => {
      const retailerLinkedA = await createRetailerLinkedUser(owner.tenantId, retailer.id, ["orders.view", "orders.edit"]);
      try {
        const orderUnderRetailer2 = await postJson(baseUrl, "/api/orders", owner.token, {
          retailerId: retailer2.id,
          customerId: await createCustomer(baseUrl, owner, retailer2.id),
          items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
        });
        expect(orderUnderRetailer2.status).toBe(201);
        const other = (await orderUnderRetailer2.json()) as { data: OrderDetail };

        const editRes = await patchJson(baseUrl, `/api/orders/${other.data.id}`, retailerLinkedA.token, {
          items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
        });
        expect(editRes.status).toBe(404);
        expect(((await editRes.json()) as { error: { code: string } }).error.code).toBe("ORDER_NOT_FOUND");

        const statusRes = await patchJson(baseUrl, `/api/orders/${other.data.id}/status`, retailerLinkedA.token, { status: "Cancelled" });
        expect(statusRes.status).toBe(404);

        const retailerRes = await patchJson(baseUrl, `/api/orders/${other.data.id}/retailer`, retailerLinkedA.token, { retailerId: retailer.id });
        expect(retailerRes.status).toBe(404);
      } finally {
        await retailerLinkedA.cleanup();
      }
    });
  });
});
