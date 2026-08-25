import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import {
  customers,
  orderGroups,
  orders,
  retailerInvoices,
  retailerUsers,
  retailers,
  roles,
  rolePermissions,
  shippingBoxes,
  userRoles,
  users,
} from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

/**
 * PHASE_10_TASKS.md Workstream E Group 2 — row-level retailer data isolation.
 *
 * Proves the identity-based mechanism (Decision 3): a retailer-linked session's
 * `actor.retailerId` forces every retailer-scoped list/get to its own retailer, ignoring
 * a spoofed `retailerId` query param and never fetching another retailer's resource by id
 * (same 404 an actually-missing resource gets — not a fetch-then-403), for each of
 * customers/orders/invoices/shipping-boxes. Also proves a staff (non-retailer-linked)
 * session's behavior is unchanged, and the identity-based self-edit allowance on
 * `retailers.service.ts#updateRetailer`.
 */
describe("row-level retailer data isolation (PHASE_10_TASKS.md Workstream E Group 2)", () => {
  let server: Server;
  let baseUrl: string;

  let staff: Awaited<ReturnType<typeof createTenantWithUser>>;
  let tenantId: string;

  let retailerA: { id: string; code: string };
  let retailerB: { id: string; code: string };

  let customerA: { id: string };
  let customerB: { id: string };
  let orderA: { id: string };
  let orderB: { id: string };
  let groupA: { id: string };
  let groupB: { id: string };
  let invoiceA: { id: string };
  let invoiceB: { id: string };
  let boxA: { id: string };
  let boxB: { id: string };

  let retailerUserAId: string;
  let retailerUserBId: string;
  let retailerRoleAId: string;
  let retailerRoleBId: string;
  let retailerTokenA: string;
  let retailerTokenB: string;

  /**
   * A real login-capable user linked to `retailerId` via `retailer_users`, holding the
   * given permissions directly (not the seeded "Retailer" role) — isolates the
   * `actor.retailerId` mechanism under test here from Group 3's separate permission-set
   * concerns, the same way `shipping.routes.test.ts` isolates its OR-permission logic
   * from any specific seeded role.
   */
  async function createRetailerLinkedUser(retailerId: string, permissionKeys: string[]) {
    const suffix = randomUUID();
    const [role] = await db.insert(roles).values({ tenantId, name: `RetailerLinked-${suffix}` }).returning();
    if (!role) throw new Error("Failed to create role");

    const permissionRows = await db.query.permissions.findMany({ where: (p, { inArray }) => inArray(p.key, permissionKeys) });
    if (permissionRows.length !== permissionKeys.length) throw new Error(`Missing seeded permissions among [${permissionKeys.join(", ")}]`);
    for (const permission of permissionRows) {
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
    }

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [user] = await db
      .insert(users)
      .values({ tenantId, name: "Retailer Linked Test User", username: `ret-linked-${suffix}`, passwordHash })
      .returning();
    if (!user) throw new Error("Failed to create user");
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
    await db.insert(retailerUsers).values({ userId: user.id, retailerId });

    const token = issueToken({ sub: user.id, tenantId, actorType: "user" });
    return { userId: user.id, roleId: role.id, token };
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

    staff = await createTenantWithUser([
      "customers.manage",
      "orders.view",
      "invoices.view",
      "invoices.manage",
      "shipping.view",
      "shipping.manage",
      "retailers.manage",
    ]);
    tenantId = staff.tenantId;

    const suffix = randomUUID();
    const [rA] = await db
      .insert(retailers)
      .values({ tenantId, name: `Isolation Retailer A ${suffix}`, code: `ISOA-${suffix.slice(0, 6)}` })
      .returning();
    const [rB] = await db
      .insert(retailers)
      .values({ tenantId, name: `Isolation Retailer B ${suffix}`, code: `ISOB-${suffix.slice(0, 6)}` })
      .returning();
    if (!rA || !rB) throw new Error("Failed to create test retailers");
    retailerA = rA;
    retailerB = rB;

    const [cA] = await db.insert(customers).values({ tenantId, retailerId: retailerA.id, firstName: "Customer A" }).returning();
    const [cB] = await db.insert(customers).values({ tenantId, retailerId: retailerB.id, firstName: "Customer B" }).returning();
    if (!cA || !cB) throw new Error("Failed to create test customers");
    customerA = cA;
    customerB = cB;

    const [oA] = await db
      .insert(orders)
      .values({ tenantId, retailerId: retailerA.id, customerId: customerA.id, orderNumber: `${retailerA.code}-ISO-A` })
      .returning();
    const [oB] = await db
      .insert(orders)
      .values({ tenantId, retailerId: retailerB.id, customerId: customerB.id, orderNumber: `${retailerB.code}-ISO-B` })
      .returning();
    if (!oA || !oB) throw new Error("Failed to create test orders");
    orderA = oA;
    orderB = oB;

    const [gA] = await db
      .insert(orderGroups)
      .values({ tenantId, retailerId: retailerA.id, orderNumber: `${retailerA.code}-ISO-G-A` })
      .returning();
    const [gB] = await db
      .insert(orderGroups)
      .values({ tenantId, retailerId: retailerB.id, orderNumber: `${retailerB.code}-ISO-G-B` })
      .returning();
    if (!gA || !gB) throw new Error("Failed to create test order groups");
    groupA = gA;
    groupB = gB;

    const [invA] = await db
      .insert(retailerInvoices)
      .values({ tenantId, retailerId: retailerA.id, invoiceNumber: `${retailerA.code}-INV-ISO-A` })
      .returning();
    const [invB] = await db
      .insert(retailerInvoices)
      .values({ tenantId, retailerId: retailerB.id, invoiceNumber: `${retailerB.code}-INV-ISO-B` })
      .returning();
    if (!invA || !invB) throw new Error("Failed to create test invoices");
    invoiceA = invA;
    invoiceB = invB;

    const [bA] = await db
      .insert(shippingBoxes)
      .values({ tenantId, retailerId: retailerA.id, trackingCode: `SHIP-ISO-A-${suffix}` })
      .returning();
    const [bB] = await db
      .insert(shippingBoxes)
      .values({ tenantId, retailerId: retailerB.id, trackingCode: `SHIP-ISO-B-${suffix}` })
      .returning();
    if (!bA || !bB) throw new Error("Failed to create test shipping boxes");
    boxA = bA;
    boxB = bB;

    const permissionKeys = ["customers.manage", "orders.view", "invoices.view", "invoices.manage", "shipping.view", "shipping.manage"];
    const retailerLinkedA = await createRetailerLinkedUser(retailerA.id, permissionKeys);
    const retailerLinkedB = await createRetailerLinkedUser(retailerB.id, permissionKeys);
    retailerUserAId = retailerLinkedA.userId;
    retailerRoleAId = retailerLinkedA.roleId;
    retailerTokenA = retailerLinkedA.token;
    retailerUserBId = retailerLinkedB.userId;
    retailerRoleBId = retailerLinkedB.roleId;
    retailerTokenB = retailerLinkedB.token;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(shippingBoxes).where(eq(shippingBoxes.id, boxA.id));
    await db.delete(shippingBoxes).where(eq(shippingBoxes.id, boxB.id));
    await db.delete(retailerInvoices).where(eq(retailerInvoices.id, invoiceA.id));
    await db.delete(retailerInvoices).where(eq(retailerInvoices.id, invoiceB.id));
    await db.delete(orders).where(eq(orders.id, orderA.id));
    await db.delete(orders).where(eq(orders.id, orderB.id));
    await db.delete(orderGroups).where(eq(orderGroups.id, groupA.id));
    await db.delete(orderGroups).where(eq(orderGroups.id, groupB.id));
    await db.delete(customers).where(eq(customers.id, customerA.id));
    await db.delete(customers).where(eq(customers.id, customerB.id));
    await db.delete(retailerUsers).where(eq(retailerUsers.userId, retailerUserAId));
    await db.delete(retailerUsers).where(eq(retailerUsers.userId, retailerUserBId));
    await db.delete(userRoles).where(eq(userRoles.userId, retailerUserAId));
    await db.delete(userRoles).where(eq(userRoles.userId, retailerUserBId));
    await db.delete(users).where(eq(users.id, retailerUserAId));
    await db.delete(users).where(eq(users.id, retailerUserBId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, retailerRoleAId));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, retailerRoleBId));
    await db.delete(roles).where(eq(roles.id, retailerRoleAId));
    await db.delete(roles).where(eq(roles.id, retailerRoleBId));
    await db.delete(retailers).where(eq(retailers.id, retailerA.id));
    await db.delete(retailers).where(eq(retailers.id, retailerB.id));
    await staff.cleanup();
  });

  describe("customers", () => {
    it("a spoofed retailerId list param is ignored — retailer A's session only ever sees retailer A's customers", async () => {
      const res = await fetch(`${baseUrl}/api/customers?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; retailerId: string }> };
      expect(body.data.map((c) => c.id)).not.toContain(customerB.id);
      expect(body.data.every((c) => c.retailerId === retailerA.id)).toBe(true);
      expect(body.data.map((c) => c.id)).toContain(customerA.id);
    });

    it("GET /customers/:id for another retailer's customer 404s (never fetched, not a 403)", async () => {
      const res = await fetch(`${baseUrl}/api/customers/${customerB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("CUSTOMER_NOT_FOUND");
    });

    it("cannot edit another retailer's customer even while holding customers.manage", async () => {
      const res = await fetch(`${baseUrl}/api/customers/${customerB.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${retailerTokenA}` },
        body: JSON.stringify({ contactNumber: "0800000000" }),
      });
      expect(res.status).toBe(404);
    });

    it("staff (non-retailer-linked) behavior is unaffected: an explicit retailerId filter still works as before", async () => {
      const res = await fetch(`${baseUrl}/api/customers?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((c) => c.id)).toContain(customerB.id);

      const getRes = await fetch(`${baseUrl}/api/customers/${customerB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(getRes.status).toBe(200);
    });
  });

  describe("orders", () => {
    it("a spoofed retailerId list param is ignored — retailer A's session only ever sees retailer A's orders", async () => {
      const res = await fetch(`${baseUrl}/api/orders?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; retailerId: string }> };
      expect(body.data.map((o) => o.id)).not.toContain(orderB.id);
      expect(body.data.every((o) => o.retailerId === retailerA.id)).toBe(true);
      expect(body.data.map((o) => o.id)).toContain(orderA.id);
    });

    it("GET /orders/:id for another retailer's order 404s (never fetched, not a 403)", async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("ORDER_NOT_FOUND");
    });

    it("staff (non-retailer-linked) behavior is unaffected: an explicit retailerId filter still works as before", async () => {
      const res = await fetch(`${baseUrl}/api/orders?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((o) => o.id)).toContain(orderB.id);

      const getRes = await fetch(`${baseUrl}/api/orders/${orderB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(getRes.status).toBe(200);
    });
  });

  describe("order groups", () => {
    it("a spoofed retailerId list param is ignored — retailer A's session only ever sees retailer A's order groups", async () => {
      const res = await fetch(`${baseUrl}/api/order-groups?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; retailerId: string }> };
      expect(body.data.map((g) => g.id)).not.toContain(groupB.id);
      expect(body.data.every((g) => g.retailerId === retailerA.id)).toBe(true);
      expect(body.data.map((g) => g.id)).toContain(groupA.id);
    });

    it("GET /order-groups/:id for another retailer's group 404s (never fetched, not a 403)", async () => {
      const res = await fetch(`${baseUrl}/api/order-groups/${groupB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("ORDER_GROUP_NOT_FOUND");
    });

    it("staff (non-retailer-linked) behavior is unaffected: an explicit retailerId filter still works as before", async () => {
      const res = await fetch(`${baseUrl}/api/order-groups?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((g) => g.id)).toContain(groupB.id);

      const getRes = await fetch(`${baseUrl}/api/order-groups/${groupB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(getRes.status).toBe(200);
    });
  });

  describe("invoices", () => {
    it("a spoofed retailerId list param is ignored — retailer A's session only ever sees retailer A's invoices", async () => {
      const res = await fetch(`${baseUrl}/api/invoices?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; retailerId: string }> };
      expect(body.data.map((i) => i.id)).not.toContain(invoiceB.id);
      expect(body.data.every((i) => i.retailerId === retailerA.id)).toBe(true);
      expect(body.data.map((i) => i.id)).toContain(invoiceA.id);
    });

    it("GET /invoices/:id for another retailer's invoice 404s (never fetched, not a 403)", async () => {
      const res = await fetch(`${baseUrl}/api/invoices/${invoiceB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVOICE_NOT_FOUND");
    });

    it("cannot transition another retailer's invoice status even while holding invoices.manage", async () => {
      const res = await fetch(`${baseUrl}/api/invoices/${invoiceB.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${retailerTokenA}` },
        body: JSON.stringify({ status: "Paid" }),
      });
      expect(res.status).toBe(404);
    });

    it("staff (non-retailer-linked) behavior is unaffected: an explicit retailerId filter still works as before", async () => {
      const res = await fetch(`${baseUrl}/api/invoices?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((i) => i.id)).toContain(invoiceB.id);

      const getRes = await fetch(`${baseUrl}/api/invoices/${invoiceB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(getRes.status).toBe(200);
    });
  });

  describe("shipping boxes", () => {
    it("a spoofed retailerId list param is ignored — retailer A's session only ever sees retailer A's shipping boxes", async () => {
      const res = await fetch(`${baseUrl}/api/shipping-boxes?retailerId=${retailerB.id}`, {
        headers: { Authorization: `Bearer ${retailerTokenA}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; retailerId: string }> };
      expect(body.data.map((b) => b.id)).not.toContain(boxB.id);
      expect(body.data.every((b) => b.retailerId === retailerA.id)).toBe(true);
      expect(body.data.map((b) => b.id)).toContain(boxA.id);
    });

    it("GET /shipping-boxes/:id for another retailer's box 404s (never fetched, not a 403)", async () => {
      const res = await fetch(`${baseUrl}/api/shipping-boxes/${boxB.id}`, { headers: { Authorization: `Bearer ${retailerTokenA}` } });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("SHIPPING_BOX_NOT_FOUND");
    });

    it("cannot close another retailer's shipping box even while holding shipping.manage", async () => {
      const res = await fetch(`${baseUrl}/api/shipping-boxes/${boxB.id}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${retailerTokenA}` },
      });
      expect(res.status).toBe(404);
    });

    it("staff (non-retailer-linked) behavior is unaffected: an explicit retailerId filter still works as before", async () => {
      const res = await fetch(`${baseUrl}/api/shipping-boxes?retailerId=${retailerB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data.map((b) => b.id)).toContain(boxB.id);

      const getRes = await fetch(`${baseUrl}/api/shipping-boxes/${boxB.id}`, { headers: { Authorization: `Bearer ${staff.token}` } });
      expect(getRes.status).toBe(200);
    });
  });

  describe("retailers.service.ts#updateRetailer — identity-based self-edit allowance", () => {
    it("a retailer-linked session can edit its own retailer record without retailers.manage", async () => {
      const res = await fetch(`${baseUrl}/api/retailers/${retailerA.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${retailerTokenA}` },
        body: JSON.stringify({ ownerName: "Self-Edited Owner" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { ownerName: string } };
      expect(body.data.ownerName).toBe("Self-Edited Owner");
    });

    it("the identity check is === : the same session cannot edit another retailer's record, even without retailers.manage anywhere in play", async () => {
      const res = await fetch(`${baseUrl}/api/retailers/${retailerB.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${retailerTokenA}` },
        body: JSON.stringify({ ownerName: "Should Not Apply" }),
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FORBIDDEN");

      const reloaded = await db.query.retailers.findFirst({ where: eq(retailers.id, retailerB.id) });
      expect(reloaded?.ownerName).not.toBe("Should Not Apply");
    });

    it("staff holding retailers.manage is unaffected: can still edit any retailer, including a retailer-linked user's own retailer", async () => {
      const res = await fetch(`${baseUrl}/api/retailers/${retailerB.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${staff.token}` },
        body: JSON.stringify({ ownerName: "Staff Edited Owner" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { ownerName: string } };
      expect(body.data.ownerName).toBe("Staff Edited Owner");
    });
  });
});
