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
    .values({ tenantId, name: `Group Order Test Retailer ${suffix}`, code: `GO${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

async function createUserInTenant(tenantId: string, permissionKeys: string[]) {
  const suffix = randomUUID();
  const [role] = await db.insert(roles).values({ tenantId, name: `OrderGroups-${suffix}` }).returning();
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
    .values({ tenantId, name: "Order Groups Test User", username: `order-groups-${suffix}`, passwordHash })
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

/** No cascading deletes on the order tree (Phase 1 convention), so tear down bottom-up. Also clears order_groups, which normal orders' teardown doesn't need to know about. */
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
  await db.execute(sql`delete from order_groups where retailer_id = ${retailerId}`);

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

interface ManufacturingStep {
  id: string;
  orderItemComponentId: string;
  processId: string;
  sequenceOrder: number;
  status: string;
  tailorId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface OrderComponent {
  id: string;
  productId: string;
  slotLabel: string;
  measurements: unknown[];
  features: unknown[];
  manufacturingSteps: ManufacturingStep[];
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  type: string;
  groupId: string | null;
  status: string;
  items: Array<{ sequence: number; components: OrderComponent[] }>;
}

describe("/api/order-groups", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noGroupCreate: Awaited<ReturnType<typeof createUserInTenant>>;
  let noView: Awaited<ReturnType<typeof createUserInTenant>>;
  let otherTenant: Awaited<ReturnType<typeof createTenantWithUser>>;

  let retailer: Awaited<ReturnType<typeof createRetailer>>;
  let customerA: string;
  let customerB: string;
  let customerC: string;

  // Jacket: cutting -> stitching -> pressing (3 processes); Pant: cutting -> pressing (2 processes)
  let jacketId: string;
  let pantId: string;
  let cuttingId: string;
  let stitchingId: string;
  let pressingId: string;
  let twoPiece: { id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> };

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
      "orders.group.create",
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.processes.manage",
      "customers.manage",
    ]);
    otherTenant = await createTenantWithUser(["orders.view", "orders.group.create"]);

    [noGroupCreate, noView] = await Promise.all([
      createUserInTenant(owner.tenantId, ["orders.create", "orders.view"]),
      createUserInTenant(owner.tenantId, []),
    ]);

    retailer = await createRetailer(owner.tenantId);
    [customerA, customerB, customerC] = await Promise.all([
      createCustomer(baseUrl, owner, retailer.id),
      createCustomer(baseUrl, owner, retailer.id),
      createCustomer(baseUrl, owner, retailer.id),
    ]);

    [jacketId, pantId] = await Promise.all([createProduct(baseUrl, owner, "Jacket"), createProduct(baseUrl, owner, "Pant")]);
    [cuttingId, stitchingId, pressingId] = await Promise.all([
      createProcess(baseUrl, owner, "Cutting"),
      createProcess(baseUrl, owner, "Stitching"),
      createProcess(baseUrl, owner, "Pressing"),
    ]);
    await Promise.all([
      setProductProcesses(baseUrl, owner, jacketId, [cuttingId, stitchingId, pressingId]),
      setProductProcesses(baseUrl, owner, pantId, [cuttingId, pressingId]),
    ]);

    twoPiece = await createSuperProduct(baseUrl, owner, "Two Piece Suit", [
      { productId: jacketId, slotLabel: "Jacket" },
      { productId: pantId, slotLabel: "Pant" },
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await deleteOrderTreeForRetailer(retailer.id);
    await db.execute(sql`delete from customers where retailer_id = ${retailer.id}`);
    await db.execute(sql`delete from retailers where id = ${retailer.id}`);

    await Promise.all([noGroupCreate.cleanup(), noView.cleanup()]);
    await owner.cleanup();
    await otherTenant.cleanup();
  });

  function itemsFor(): unknown[] {
    return [
      {
        superProductId: twoPiece.id,
        components: twoPiece.components.map((c) => ({ superProductComponentId: c.id })),
      },
    ];
  }

  /** Strips values that legitimately differ between two independently-created orders (ids, FKs, timestamps), leaving only the shape: which fields exist. */
  function shapeOf(step: ManufacturingStep): string[] {
    return Object.keys(step).sort();
  }

  it("creates a group order with 2 customers whose child orders are structurally identical (manufacturing_steps shape) to a normal order", async () => {
    // Baseline: a completely normal (non-group) order against the same super product.
    const normalRes = await postJson(baseUrl, "/api/orders", owner.token, { retailerId: retailer.id, customerId: customerA, items: itemsFor() });
    expect(normalRes.status).toBe(201);
    const normal = ((await normalRes.json()) as { data: OrderDetail }).data;
    expect(normal.type).toBe("normal");
    expect(normal.groupId).toBeNull();

    const groupRes = await postJson(baseUrl, "/api/order-groups", owner.token, {
      retailerId: retailer.id,
      orders: [
        { customerId: customerB, items: itemsFor() },
        { customerId: customerC, items: itemsFor() },
      ],
    });
    expect(groupRes.status).toBe(201);
    const group = (await groupRes.json()) as { data: { id: string; orderNumber: string; retailerId: string; orders: OrderDetail[] } };

    expect(group.data.orderNumber).toMatch(new RegExp(`^${retailer.code}-G-\\d{4}$`));
    expect(group.data.orders).toHaveLength(2);

    const [childB, childC] = group.data.orders;
    // Every child's groupId matches the group's own id.
    for (const child of group.data.orders) {
      expect(child.groupId).toBe(group.data.id);
      expect(child.type).toBe("group");
      expect(child.status).toBe("New Order");
    }
    // Each child has a distinct, validly-formed order number (own normal-order numbering sequence).
    expect(childB!.orderNumber).not.toBe(childC!.orderNumber);
    for (const child of group.data.orders) expect(child.orderNumber).toMatch(new RegExp(`^${retailer.code}-\\d{4}$`));

    // Structural equivalence: for each of the 2 components, the group child's manufacturing_steps
    // have the identical shape (fields, sequenceOrder progression, status enum) as the normal order's.
    const normalJacket = normal.items[0]!.components.find((c) => c.productId === jacketId)!;
    const normalPant = normal.items[0]!.components.find((c) => c.productId === pantId)!;

    for (const child of group.data.orders) {
      const childJacket = child.items[0]!.components.find((c) => c.productId === jacketId)!;
      const childPant = child.items[0]!.components.find((c) => c.productId === pantId)!;

      // No group-level nesting anywhere: components carry manufacturingSteps directly, same as a normal order.
      expect(Array.isArray(childJacket.manufacturingSteps)).toBe(true);

      expect(childJacket.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual(normalJacket.manufacturingSteps.map((s) => s.sequenceOrder));
      expect(childJacket.manufacturingSteps.map((s) => s.processId)).toEqual(normalJacket.manufacturingSteps.map((s) => s.processId));
      expect(childJacket.manufacturingSteps.map((s) => s.status)).toEqual(normalJacket.manufacturingSteps.map((s) => s.status));
      expect(childJacket.manufacturingSteps.every((s) => s.status === "pending")).toBe(true);
      childJacket.manufacturingSteps.forEach((step, i) => expect(shapeOf(step)).toEqual(shapeOf(normalJacket.manufacturingSteps[i]!)));

      expect(childPant.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual(normalPant.manufacturingSteps.map((s) => s.sequenceOrder));
      expect(childPant.manufacturingSteps.map((s) => s.processId)).toEqual(normalPant.manufacturingSteps.map((s) => s.processId));
      childPant.manufacturingSteps.forEach((step, i) => expect(shapeOf(step)).toEqual(shapeOf(normalPant.manufacturingSteps[i]!)));

      // Every manufacturing_steps row belongs to a real order_item_component of THIS child order,
      // never a customer-keyed/group-keyed structure.
      expect(childJacket.manufacturingSteps.every((s) => s.orderItemComponentId === childJacket.id)).toBe(true);
      expect(childPant.manufacturingSteps.every((s) => s.orderItemComponentId === childPant.id)).toBe(true);
    }

    // Fetch-back parity: GET /api/order-groups/:id returns the same nested detail as the create response.
    const getRes = await getJson(baseUrl, `/api/order-groups/${group.data.id}`, owner.token);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { data: { id: string; orders: OrderDetail[] } };
    expect(fetched.data.id).toBe(group.data.id);
    expect(fetched.data.orders).toHaveLength(2);
    for (const child of fetched.data.orders) {
      expect(child.groupId).toBe(group.data.id);
      const jacket = child.items[0]!.components.find((c) => c.productId === jacketId)!;
      expect(jacket.manufacturingSteps.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
    }

    // Each child is also independently fetchable via the normal order-detail endpoint, with the identical shape.
    for (const child of group.data.orders) {
      const childGetRes = await getJson(baseUrl, `/api/orders/${child.id}`, owner.token);
      expect(childGetRes.status).toBe(200);
      const childFetched = ((await childGetRes.json()) as { data: OrderDetail }).data;
      expect(childFetched.type).toBe("group");
      expect(childFetched.groupId).toBe(group.data.id);
    }
  });

  it("lists order groups scoped to the tenant, and enforces tenant isolation on both list and detail", async () => {
    const groupRes = await postJson(baseUrl, "/api/order-groups", owner.token, {
      retailerId: retailer.id,
      orders: [
        { customerId: customerA, items: itemsFor() },
        { customerId: customerB, items: itemsFor() },
      ],
    });
    expect(groupRes.status).toBe(201);
    const group = (await groupRes.json()) as { data: { id: string } };

    const listRes = await getJson(baseUrl, `/api/order-groups?retailerId=${retailer.id}`, owner.token);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(list.data.some((g) => g.id === group.data.id)).toBe(true);

    // A user in a completely different tenant can't see this group at all.
    const otherListRes = await getJson(baseUrl, "/api/order-groups", otherTenant.token);
    expect(otherListRes.status).toBe(200);
    const otherList = (await otherListRes.json()) as { data: Array<{ id: string }> };
    expect(otherList.data.some((g) => g.id === group.data.id)).toBe(false);

    const otherGetRes = await getJson(baseUrl, `/api/order-groups/${group.data.id}`, otherTenant.token);
    expect(otherGetRes.status).toBe(404);
  });

  it("403s a create request from a user lacking orders.group.create", async () => {
    const res = await postJson(baseUrl, "/api/order-groups", noGroupCreate.token, {
      retailerId: retailer.id,
      orders: [
        { customerId: customerA, items: itemsFor() },
        { customerId: customerB, items: itemsFor() },
      ],
    });
    expect(res.status).toBe(403);
  });

  it("401s a request with no token, and 403s reads for a user lacking orders.view", async () => {
    const noAuthRes = await fetch(`${baseUrl}/api/order-groups`);
    expect(noAuthRes.status).toBe(401);

    const noPermRes = await getJson(baseUrl, "/api/order-groups", noView.token);
    expect(noPermRes.status).toBe(403);
  });

  it("rejects a group create with an empty orders array", async () => {
    const res = await postJson(baseUrl, "/api/order-groups", owner.token, { retailerId: retailer.id, orders: [] });
    expect(res.status).toBe(400);
  });
});
