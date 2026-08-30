import { randomUUID } from "node:crypto";
import http from "node:http";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { db } from "../db/index";
import {
  rolePermissions,
  roles,
  tenants,
  userRoles,
  users,
  retailers,
  customers,
  products,
  superProducts,
  superProductComponents,
  orders,
  orderItems,
  orderItemComponents,
} from "../db/schema/index";
import { hashPassword, issueToken } from "../services/auth.service";
import { createOrder } from "../services/orders.service";
import { closePdfBrowser } from "../services/pdfRenderer";

const suffix = randomUUID();

/**
 * PHASE_10_TASKS.md Workstream E Group 3 — `shipping.routes.ts`'s GETs must accept
 * EITHER `shipping.view` (retailer-safe, read-only) OR `shipping.manage` (factory-floor
 * pack/close); only `shipping.manage` may reach the write routes.
 */
describe("shipping.routes — shipping.view / shipping.manage OR-gating", () => {
  let baseUrl: string;
  let server: http.Server;

  let tenantId: string;
  let viewOnlyRoleId: string;
  let manageRoleId: string;
  let neitherRoleId: string;
  let viewOnlyUserId: string;
  let manageUserId: string;
  let neitherUserId: string;

  let viewOnlyToken: string;
  let manageToken: string;
  let neitherToken: string;

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const shippingViewPermission = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "shipping.view") });
    const shippingManagePermission = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "shipping.manage") });
    if (!shippingViewPermission) throw new Error("Expected seeded 'shipping.view' permission — run db:seed first");
    if (!shippingManagePermission) throw new Error("Expected seeded 'shipping.manage' permission — run db:seed first");

    const [viewOnlyRole] = await db.insert(roles).values({ tenantId, name: `ShipView-${suffix}` }).returning();
    const [manageRole] = await db.insert(roles).values({ tenantId, name: `ShipManage-${suffix}` }).returning();
    const [neitherRole] = await db.insert(roles).values({ tenantId, name: `ShipNeither-${suffix}` }).returning();
    if (!viewOnlyRole || !manageRole || !neitherRole) throw new Error("Failed to create test roles");
    viewOnlyRoleId = viewOnlyRole.id;
    manageRoleId = manageRole.id;
    neitherRoleId = neitherRole.id;

    await db.insert(rolePermissions).values({ roleId: viewOnlyRoleId, permissionId: shippingViewPermission.id });
    await db.insert(rolePermissions).values({ roleId: manageRoleId, permissionId: shippingManagePermission.id });

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [viewOnlyUser] = await db
      .insert(users)
      .values({ tenantId, name: "Ship View Test User", username: `ship-view-${suffix}`, passwordHash })
      .returning();
    const [manageUser] = await db
      .insert(users)
      .values({ tenantId, name: "Ship Manage Test User", username: `ship-manage-${suffix}`, passwordHash })
      .returning();
    const [neitherUser] = await db
      .insert(users)
      .values({ tenantId, name: "Ship Neither Test User", username: `ship-neither-${suffix}`, passwordHash })
      .returning();
    if (!viewOnlyUser || !manageUser || !neitherUser) throw new Error("Failed to create test users");
    viewOnlyUserId = viewOnlyUser.id;
    manageUserId = manageUser.id;
    neitherUserId = neitherUser.id;

    await db.insert(userRoles).values({ userId: viewOnlyUserId, roleId: viewOnlyRoleId });
    await db.insert(userRoles).values({ userId: manageUserId, roleId: manageRoleId });
    await db.insert(userRoles).values({ userId: neitherUserId, roleId: neitherRoleId });

    viewOnlyToken = issueToken({ sub: viewOnlyUserId, tenantId, actorType: "user" });
    manageToken = issueToken({ sub: manageUserId, tenantId, actorType: "user" });
    neitherToken = issueToken({ sub: neitherUserId, tenantId, actorType: "user" });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

    await db.delete(userRoles).where(eq(userRoles.userId, viewOnlyUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, manageUserId));
    await db.delete(userRoles).where(eq(userRoles.userId, neitherUserId));
    await db.delete(users).where(eq(users.id, viewOnlyUserId));
    await db.delete(users).where(eq(users.id, manageUserId));
    await db.delete(users).where(eq(users.id, neitherUserId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, viewOnlyRoleId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, manageRoleId));
    await db.delete(roles).where(eq(roles.id, viewOnlyRoleId));
    await db.delete(roles).where(eq(roles.id, manageRoleId));
    await db.delete(roles).where(eq(roles.id, neitherRoleId));
  });

  it("allows a shipping.view-only session through GET /shipping-boxes", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, { headers: { Authorization: `Bearer ${viewOnlyToken}` } });
    expect(res.status).toBe(200);
  });

  it("allows a shipping.manage session through GET /shipping-boxes (unaffected by the added OR)", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, { headers: { Authorization: `Bearer ${manageToken}` } });
    expect(res.status).toBe(200);
  });

  it("403s a session holding neither permission on GET /shipping-boxes", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, { headers: { Authorization: `Bearer ${neitherToken}` } });
    expect(res.status).toBe(403);
  });

  it("403s a shipping.view-only session on the write route POST /shipping-boxes — view never implies manage", async () => {
    const res = await fetch(`${baseUrl}/api/shipping-boxes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${viewOnlyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ retailerId: randomUUID() }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /shipping/components/:componentId/slip-pdf", () => {
  let baseUrl: string;
  let server: http.Server;

  let tenantId: string;
  let manageRoleId: string;
  let viewOnlyRoleId: string;
  let manageUserId: string;
  let viewOnlyUserId: string;
  let manageToken: string;
  let viewOnlyToken: string;

  let retailerId: string;
  let customerId: string;
  let productId: string;
  let superProductId: string;
  let superProductComponentId: string;
  const orderIds: string[] = [];
  const componentIds: string[] = [];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const shippingManagePermission = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "shipping.manage") });
    const shippingViewPermission = await db.query.permissions.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.key, "shipping.view") });
    if (!shippingManagePermission || !shippingViewPermission) throw new Error("Expected seeded shipping permissions — run db:seed first");

    const [manageRole] = await db.insert(roles).values({ tenantId, name: `SlipManage-${suffix}` }).returning();
    const [viewOnlyRole] = await db.insert(roles).values({ tenantId, name: `SlipView-${suffix}` }).returning();
    if (!manageRole || !viewOnlyRole) throw new Error("Failed to create test roles");
    manageRoleId = manageRole.id;
    viewOnlyRoleId = viewOnlyRole.id;
    await db.insert(rolePermissions).values({ roleId: manageRoleId, permissionId: shippingManagePermission.id });
    await db.insert(rolePermissions).values({ roleId: viewOnlyRoleId, permissionId: shippingViewPermission.id });

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [manageUser] = await db
      .insert(users)
      .values({ tenantId, name: "Slip Manage Test User", username: `slip-manage-${suffix}`, passwordHash })
      .returning();
    const [viewOnlyUser] = await db
      .insert(users)
      .values({ tenantId, name: "Slip View Test User", username: `slip-view-${suffix}`, passwordHash })
      .returning();
    if (!manageUser || !viewOnlyUser) throw new Error("Failed to create test users");
    manageUserId = manageUser.id;
    viewOnlyUserId = viewOnlyUser.id;
    await db.insert(userRoles).values({ userId: manageUserId, roleId: manageRoleId });
    await db.insert(userRoles).values({ userId: viewOnlyUserId, roleId: viewOnlyRoleId });
    manageToken = issueToken({ sub: manageUserId, tenantId, actorType: "user" });
    viewOnlyToken = issueToken({ sub: viewOnlyUserId, tenantId, actorType: "user" });

    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name: `Slip Route Retailer ${suffix}`, code: `SLR-${suffix.slice(0, 6)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const [customer] = await db.insert(customers).values({ tenantId, retailerId, firstName: "Slip Route Customer" }).returning();
    if (!customer) throw new Error("Failed to create test customer");
    customerId = customer.id;

    const [product] = await db.insert(products).values({ tenantId, name: `SlipRouteProduct-${suffix}` }).returning();
    if (!product) throw new Error("Failed to create test product");
    productId = product.id;

    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `SlipRouteSuper-${suffix}` }).returning();
    if (!superProduct) throw new Error("Failed to create test super product");
    superProductId = superProduct.id;

    const [component] = await db
      .insert(superProductComponents)
      .values({ superProductId, productId, slotLabel: "Main", sequence: 1 })
      .returning();
    if (!component) throw new Error("Failed to create test super product component");
    superProductComponentId = component.id;

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await closePdfBrowser();

    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    await db.delete(superProductComponents).where(eq(superProductComponents.id, superProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, superProductId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailerId));

    await db.delete(userRoles).where(inArray(userRoles.userId, [manageUserId, viewOnlyUserId]));
    await db.delete(users).where(inArray(users.id, [manageUserId, viewOnlyUserId]));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, [manageRoleId, viewOnlyRoleId]));
    await db.delete(roles).where(inArray(roles.id, [manageRoleId, viewOnlyRoleId]));
  });

  async function createTestComponentId(): Promise<{ componentId: string; orderId: string }> {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [{ superProductId, components: [{ superProductComponentId }] }],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);
    return { componentId, orderId: order.id };
  }

  it("403s a shipping.view-only session — printing a slip is a write (it changes order status)", async () => {
    const { componentId } = await createTestComponentId();
    const res = await fetch(`${baseUrl}/api/shipping/components/${componentId}/slip-pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${viewOnlyToken}` },
    });
    expect(res.status).toBe(403);
  });

  it(
    "generates a real PDF and flips the order's status to Shipment, matching legacy's exact side effect",
    async () => {
      const { componentId, orderId } = await createTestComponentId();

      const res = await fetch(`${baseUrl}/api/shipping/components/${componentId}/slip-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${manageToken}` },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { path: string } };
      expect(body.data.path.length).toBeGreaterThan(0);

      const reloadedOrder = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
      expect(reloadedOrder?.status).toBe("Shipment");
    },
    30000
  );

  it("404s a bogus componentId", async () => {
    const res = await fetch(`${baseUrl}/api/shipping/components/${randomUUID()}/slip-pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${manageToken}` },
    });
    expect(res.status).toBe(404);
  });
});
