import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import {
  customers,
  retailers,
  orders,
  retailerInvoices,
  shippingBoxes,
  tailors,
  users,
  roles,
  extraPaymentCategories,
  orderGroups,
  products,
  superProducts,
  features,
  measurementDefinitions,
  processes,
} from "../src/db/schema/index";
import { hashPassword } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Envelope<T> {
  data: T[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
}

describe("pagination (PHASE_10_TASKS.md Workstream C)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function getJson<T>(path: string, token: string): Promise<{ status: number; body: T }> {
    const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: (await res.json()) as T };
  }

  async function createRetailer(tenantId: string, name: string) {
    const suffix = randomUUID();
    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name, code: `PG-${suffix.slice(0, 8)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    return retailer;
  }

  // ---- Group 1: mandatory-pagination endpoints ----

  describe("mandatory mode", () => {
    it("GET /customers: paginates, composes with retailerId filter, defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser([]);
      const retailer = await createRetailer(tenant.tenantId, `Pg Cust Retailer ${randomUUID()}`);
      const otherRetailer = await createRetailer(tenant.tenantId, `Pg Cust Other Retailer ${randomUUID()}`);
      try {
        // 5 customers on `retailer`, asc firstName order.
        const names = ["A-1", "A-2", "A-3", "A-4", "A-5"];
        await db.insert(customers).values(names.map((firstName) => ({ tenantId: tenant.tenantId, retailerId: retailer.id, firstName })));
        // 1 customer on a different retailer — must never leak into `retailer`-filtered results.
        await db.insert(customers).values({ tenantId: tenant.tenantId, retailerId: otherRetailer.id, firstName: "Z-Other" });

        // Default (no page/pageSize): still page 1 of 25 — the whole point of mandatory mode.
        const unfiltered = await getJson<Envelope<{ firstName: string }>>("/api/customers", tenant.token);
        expect(unfiltered.status).toBe(200);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 6, totalPages: 1 });
        expect(unfiltered.body.data).toHaveLength(6);

        // Filter composes with pagination: only `retailer`'s 5 customers count/appear.
        const page1 = await getJson<Envelope<{ firstName: string }>>(
          `/api/customers?retailerId=${retailer.id}&page=1&pageSize=2`,
          tenant.token
        );
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
        expect(page1.body.data.map((c) => c.firstName)).toEqual(["A-1", "A-2"]);

        const page3 = await getJson<Envelope<{ firstName: string }>>(
          `/api/customers?retailerId=${retailer.id}&page=3&pageSize=2`,
          tenant.token
        );
        expect(page3.body.pagination).toEqual({ page: 3, pageSize: 2, total: 5, totalPages: 3 });
        expect(page3.body.data.map((c) => c.firstName)).toEqual(["A-5"]);
      } finally {
        await db.delete(customers).where(eq(customers.tenantId, tenant.tenantId));
        await db.delete(retailers).where(eq(retailers.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /retailers: paginates and defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const names = ["R-1", "R-2", "R-3"];
        await db.insert(retailers).values(
          names.map((name, i) => ({ tenantId: tenant.tenantId, name, code: `RPG-${i}-${randomUUID().slice(0, 6)}` }))
        );

        const unfiltered = await getJson<Envelope<{ name: string }>>("/api/retailers", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 3, totalPages: 1 });
        expect(unfiltered.body.data.map((r) => r.name)).toEqual(names);

        const page1 = await getJson<Envelope<{ name: string }>>("/api/retailers?page=1&pageSize=2", tenant.token);
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(page1.body.data.map((r) => r.name)).toEqual(["R-1", "R-2"]);

        const page2 = await getJson<Envelope<{ name: string }>>("/api/retailers?page=2&pageSize=2", tenant.token);
        expect(page2.body.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
        expect(page2.body.data.map((r) => r.name)).toEqual(["R-3"]);
      } finally {
        await db.delete(retailers).where(eq(retailers.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /orders: paginates, composes with retailerId filter, defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser(["orders.view"]);
      const retailer = await createRetailer(tenant.tenantId, `Pg Order Retailer ${randomUUID()}`);
      const otherRetailer = await createRetailer(tenant.tenantId, `Pg Order Other Retailer ${randomUUID()}`);
      const [customer] = await db.insert(customers).values({ tenantId: tenant.tenantId, retailerId: retailer.id, firstName: "Order Cust" }).returning();
      if (!customer) throw new Error("failed to create customer");
      try {
        const base = Date.now();
        const orderNumbers = ["O-1", "O-2", "O-3", "O-4", "O-5"];
        for (const [i, orderNumber] of orderNumbers.entries()) {
          await db.insert(orders).values({
            tenantId: tenant.tenantId,
            retailerId: retailer.id,
            customerId: customer.id,
            orderNumber,
            orderDate: new Date(base + i * 1000),
          });
        }
        // A different retailer's order — must never leak into `retailer`-filtered results.
        const [otherCustomer] = await db
          .insert(customers)
          .values({ tenantId: tenant.tenantId, retailerId: otherRetailer.id, firstName: "Other Cust" })
          .returning();
        if (!otherCustomer) throw new Error("failed");
        await db.insert(orders).values({
          tenantId: tenant.tenantId,
          retailerId: otherRetailer.id,
          customerId: otherCustomer.id,
          orderNumber: "O-OTHER",
          orderDate: new Date(base + 99 * 1000),
        });

        const unfiltered = await getJson<Envelope<{ orderNumber: string }>>("/api/orders", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 6, totalPages: 1 });

        // desc(orderDate): most recently dated order first.
        const page1 = await getJson<Envelope<{ orderNumber: string }>>(
          `/api/orders?retailerId=${retailer.id}&page=1&pageSize=2`,
          tenant.token
        );
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
        expect(page1.body.data.map((o) => o.orderNumber)).toEqual(["O-5", "O-4"]);

        const page3 = await getJson<Envelope<{ orderNumber: string }>>(
          `/api/orders?retailerId=${retailer.id}&page=3&pageSize=2`,
          tenant.token
        );
        expect(page3.body.pagination).toEqual({ page: 3, pageSize: 2, total: 5, totalPages: 3 });
        expect(page3.body.data.map((o) => o.orderNumber)).toEqual(["O-1"]);
      } finally {
        await db.delete(orders).where(eq(orders.tenantId, tenant.tenantId));
        await db.delete(customers).where(eq(customers.tenantId, tenant.tenantId));
        await db.delete(retailers).where(eq(retailers.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /invoices: paginates, composes with status filter, defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser(["invoices.view"]);
      const retailer = await createRetailer(tenant.tenantId, `Pg Invoice Retailer ${randomUUID()}`);
      try {
        const base = Date.now();
        const statuses = ["Unpaid", "Unpaid", "Unpaid", "Paid", "Paid"];
        for (const [i, status] of statuses.entries()) {
          await db.insert(retailerInvoices).values({
            tenantId: tenant.tenantId,
            retailerId: retailer.id,
            invoiceNumber: `INV-${i}-${randomUUID().slice(0, 6)}`,
            status,
            createdAt: new Date(base + i * 1000),
          });
        }

        const unfiltered = await getJson<Envelope<{ status: string }>>("/api/invoices", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 5, totalPages: 1 });

        const unpaidPage1 = await getJson<Envelope<{ status: string }>>(
          `/api/invoices?status=Unpaid&page=1&pageSize=2`,
          tenant.token
        );
        expect(unpaidPage1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(unpaidPage1.body.data.every((i) => i.status === "Unpaid")).toBe(true);

        const unpaidPage2 = await getJson<Envelope<{ status: string }>>(
          `/api/invoices?status=Unpaid&page=2&pageSize=2`,
          tenant.token
        );
        expect(unpaidPage2.body.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
        expect(unpaidPage2.body.data).toHaveLength(1);
      } finally {
        await db.delete(retailerInvoices).where(eq(retailerInvoices.tenantId, tenant.tenantId));
        await db.delete(retailers).where(eq(retailers.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /shipping-boxes: paginates, composes with isClosed filter, defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser(["shipping.manage"]);
      const retailer = await createRetailer(tenant.tenantId, `Pg Ship Retailer ${randomUUID()}`);
      try {
        const base = Date.now();
        const closedFlags = [false, false, false, true, true];
        for (const [i, isClosed] of closedFlags.entries()) {
          await db.insert(shippingBoxes).values({
            tenantId: tenant.tenantId,
            retailerId: retailer.id,
            trackingCode: `SHIP-PG-${i}-${randomUUID().slice(0, 6)}`,
            isClosed,
            createdAt: new Date(base + i * 1000),
          });
        }

        const unfiltered = await getJson<Envelope<{ isClosed: boolean }>>("/api/shipping-boxes", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 5, totalPages: 1 });

        const openPage1 = await getJson<Envelope<{ isClosed: boolean }>>(
          `/api/shipping-boxes?isClosed=false&page=1&pageSize=2`,
          tenant.token
        );
        expect(openPage1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(openPage1.body.data.every((b) => b.isClosed === false)).toBe(true);
      } finally {
        await db.delete(shippingBoxes).where(eq(shippingBoxes.tenantId, tenant.tenantId));
        await db.delete(retailers).where(eq(retailers.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /tailors: paginates and defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const passwordHash = await hashPassword("irrelevant-for-this-test");
        const names = ["T-1", "T-2", "T-3"];
        await db.insert(tailors).values(
          names.map((name) => ({ tenantId: tenant.tenantId, name, username: `${name}-${randomUUID()}`, passwordHash }))
        );

        const unfiltered = await getJson<Envelope<{ name: string }>>("/api/tailors", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 3, totalPages: 1 });
        expect(unfiltered.body.data.every((t) => !("passwordHash" in t))).toBe(true);

        const page1 = await getJson<Envelope<{ name: string }>>("/api/tailors?page=1&pageSize=2", tenant.token);
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(page1.body.data.map((t) => t.name)).toEqual(["T-1", "T-2"]);
      } finally {
        await db.delete(tailors).where(eq(tailors.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /users: paginates and defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser([]);
      let createdIds: string[] = [];
      try {
        const passwordHash = await hashPassword("irrelevant-for-this-test");
        const names = ["U-1", "U-2", "U-3"];
        const created = await db
          .insert(users)
          .values(names.map((name) => ({ tenantId: tenant.tenantId, name, username: `${name}-${randomUUID()}`, passwordHash })))
          .returning();
        createdIds = created.map((u) => u.id);

        // The fixture's own user counts too (name "Catalog Test User") — account for it.
        const unfiltered = await getJson<Envelope<{ name: string }>>("/api/users", tenant.token);
        expect(unfiltered.body.pagination!.total).toBe(4);

        const page1 = await getJson<Envelope<{ name: string }>>("/api/users?page=1&pageSize=2", tenant.token);
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 4, totalPages: 2 });
        expect(page1.body.data).toHaveLength(2);
      } finally {
        // Deleted by id, not by `tenantId` — the fixture's own user is also tenant-scoped
        // and still has a live `user_roles` row until `tenant.cleanup()` removes it below.
        if (createdIds.length) await db.delete(users).where(inArray(users.id, createdIds));
        await tenant.cleanup();
      }
    });

    it("GET /roles: paginates and defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser([]);
      let createdIds: string[] = [];
      try {
        const names = ["Ro-1", "Ro-2", "Ro-3"];
        const created = await db.insert(roles).values(names.map((name) => ({ tenantId: tenant.tenantId, name }))).returning();
        createdIds = created.map((r) => r.id);

        // The fixture's own role counts too (name `Catalog-<suffix>`) — account for it.
        const unfiltered = await getJson<Envelope<{ name: string }>>("/api/roles", tenant.token);
        expect(unfiltered.body.pagination!.total).toBe(4);

        const page1 = await getJson<Envelope<{ name: string }>>("/api/roles?page=1&pageSize=2", tenant.token);
        expect(page1.body.pagination!.total).toBe(4);
        expect(page1.body.data).toHaveLength(2);
      } finally {
        // Deleted by id, not by `tenantId` — the fixture's own role is also tenant-scoped
        // and still has a live `role_permissions`/`user_roles` row until `tenant.cleanup()`
        // removes it below.
        if (createdIds.length) await db.delete(roles).where(inArray(roles.id, createdIds));
        await tenant.cleanup();
      }
    });

    it("GET /extra-payment-categories: paginates and defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser([]);
      const [product] = await db.insert(products).values({ tenantId: tenant.tenantId, name: `Pg EPC Product ${randomUUID()}` }).returning();
      const [process] = await db.insert(processes).values({ tenantId: tenant.tenantId, name: `Pg EPC Process ${randomUUID()}`, price: "10.00" }).returning();
      if (!product || !process) throw new Error("failed to create fixtures");
      try {
        const names = ["E-1", "E-2", "E-3"];
        await db.insert(extraPaymentCategories).values(
          names.map((name) => ({ tenantId: tenant.tenantId, productId: product.id, processId: process.id, name }))
        );

        const unfiltered = await getJson<Envelope<{ name: string }>>("/api/extra-payment-categories", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 3, totalPages: 1 });

        const page1 = await getJson<Envelope<{ name: string }>>("/api/extra-payment-categories?page=1&pageSize=2", tenant.token);
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(page1.body.data.map((c) => c.name)).toEqual(["E-1", "E-2"]);
      } finally {
        await db.delete(extraPaymentCategories).where(eq(extraPaymentCategories.tenantId, tenant.tenantId));
        await db.delete(processes).where(eq(processes.tenantId, tenant.tenantId));
        await db.delete(products).where(eq(products.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /order-groups: paginates, composes with retailerId filter, defaults to page 1 of 25 when omitted", async () => {
      const tenant = await createTenantWithUser(["orders.view"]);
      const retailer = await createRetailer(tenant.tenantId, `Pg OG Retailer ${randomUUID()}`);
      const otherRetailer = await createRetailer(tenant.tenantId, `Pg OG Other Retailer ${randomUUID()}`);
      try {
        const base = Date.now();
        const numbers = ["G-1", "G-2", "G-3"];
        for (const [i, orderNumber] of numbers.entries()) {
          await db.insert(orderGroups).values({ tenantId: tenant.tenantId, retailerId: retailer.id, orderNumber, createdAt: new Date(base + i * 1000) });
        }
        await db.insert(orderGroups).values({ tenantId: tenant.tenantId, retailerId: otherRetailer.id, orderNumber: "G-OTHER", createdAt: new Date(base + 99 * 1000) });

        const unfiltered = await getJson<Envelope<{ orderNumber: string }>>("/api/order-groups", tenant.token);
        expect(unfiltered.body.pagination).toEqual({ page: 1, pageSize: 25, total: 4, totalPages: 1 });

        const page1 = await getJson<Envelope<{ orderNumber: string }>>(
          `/api/order-groups?retailerId=${retailer.id}&page=1&pageSize=2`,
          tenant.token
        );
        expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(page1.body.data.map((g) => g.orderNumber)).toEqual(["G-3", "G-2"]);
      } finally {
        await db.delete(orderGroups).where(eq(orderGroups.tenantId, tenant.tenantId));
        await db.delete(retailers).where(eq(retailers.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });
  });

  // ---- Group 2: opt-in-pagination endpoints ----

  describe("opt-in mode", () => {
    it("GET /products: omitting page/pageSize returns the exact same full unpaginated list (no `pagination` key); explicit params paginate", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const names = ["P-1", "P-2", "P-3"];
        for (const name of names) await db.insert(products).values({ tenantId: tenant.tenantId, name });
        // `createProduct` auto-creates a matching super product too — irrelevant here, direct
        // insert used instead, matching this test's need for exact, uncomplicated row counts.

        const unpaginated = await getJson<Envelope<{ name: string }>>("/api/products", tenant.token);
        expect(unpaginated.status).toBe(200);
        expect(unpaginated.body.data.map((p) => p.name)).toEqual(names);
        expect(unpaginated.body.pagination).toBeUndefined();
        expect("pagination" in unpaginated.body).toBe(false);

        const paginated = await getJson<Envelope<{ name: string }>>("/api/products?page=1&pageSize=2", tenant.token);
        expect(paginated.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(paginated.body.data.map((p) => p.name)).toEqual(["P-1", "P-2"]);

        const paginatedPage2 = await getJson<Envelope<{ name: string }>>("/api/products?page=2&pageSize=2", tenant.token);
        expect(paginatedPage2.body.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
        expect(paginatedPage2.body.data.map((p) => p.name)).toEqual(["P-3"]);
      } finally {
        await db.delete(products).where(eq(products.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /super-products: omitting page/pageSize returns the full unpaginated list unchanged; explicit params paginate", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const names = ["SP-1", "SP-2", "SP-3"];
        for (const name of names) await db.insert(superProducts).values({ tenantId: tenant.tenantId, name });

        const unpaginated = await getJson<Envelope<{ name: string; components: unknown[] }>>("/api/super-products", tenant.token);
        expect(unpaginated.body.data.map((p) => p.name)).toEqual(names);
        expect(unpaginated.body.data.every((p) => Array.isArray(p.components))).toBe(true);
        expect(unpaginated.body.pagination).toBeUndefined();

        const paginated = await getJson<Envelope<{ name: string }>>("/api/super-products?page=1&pageSize=2", tenant.token);
        expect(paginated.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(paginated.body.data.map((p) => p.name)).toEqual(["SP-1", "SP-2"]);
      } finally {
        await db.delete(superProducts).where(eq(superProducts.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /features (no productId): omitting page/pageSize returns the full unpaginated list unchanged; explicit params paginate; productId-filtered branch ignores pagination entirely", async () => {
      const tenant = await createTenantWithUser([]);
      const [product] = await db.insert(products).values({ tenantId: tenant.tenantId, name: `Pg Feature Product ${randomUUID()}` }).returning();
      if (!product) throw new Error("failed");
      try {
        const names = ["F-1", "F-2", "F-3"];
        const featureRows = await db
          .insert(features)
          .values(names.map((name) => ({ tenantId: tenant.tenantId, name, type: "text" as const })))
          .returning();

        const unpaginated = await getJson<Envelope<{ name: string }>>("/api/features", tenant.token);
        expect(unpaginated.body.data.map((f) => f.name)).toEqual(names);
        expect(unpaginated.body.pagination).toBeUndefined();

        const paginated = await getJson<Envelope<{ name: string }>>("/api/features?page=1&pageSize=2", tenant.token);
        expect(paginated.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(paginated.body.data.map((f) => f.name)).toEqual(["F-1", "F-2"]);

        // `productId`-filtered branch is untouched, always — no `feature_products` links
        // exist here, so the result is an empty full list, and pagination params are
        // simply ignored (no `pagination` key even though page/pageSize were sent).
        const filtered = await getJson<Envelope<{ name: string }>>(
          `/api/features?productId=${product.id}&page=1&pageSize=1`,
          tenant.token
        );
        expect(filtered.body.data).toEqual([]);
        expect(filtered.body.pagination).toBeUndefined();
        void featureRows;
      } finally {
        await db.delete(features).where(eq(features.tenantId, tenant.tenantId));
        await db.delete(products).where(eq(products.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /measurement-definitions: omitting page/pageSize returns the full unpaginated list unchanged; explicit params paginate", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const rows = [
          { name: "M-1", slug: "m-1" },
          { name: "M-2", slug: "m-2" },
          { name: "M-3", slug: "m-3" },
        ];
        for (const row of rows) await db.insert(measurementDefinitions).values({ tenantId: tenant.tenantId, ...row });

        const unpaginated = await getJson<Envelope<{ name: string }>>("/api/measurement-definitions", tenant.token);
        expect(unpaginated.body.data.map((m) => m.name)).toEqual(["M-1", "M-2", "M-3"]);
        expect(unpaginated.body.pagination).toBeUndefined();

        const paginated = await getJson<Envelope<{ name: string }>>("/api/measurement-definitions?page=1&pageSize=2", tenant.token);
        expect(paginated.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(paginated.body.data.map((m) => m.name)).toEqual(["M-1", "M-2"]);
      } finally {
        await db.delete(measurementDefinitions).where(eq(measurementDefinitions.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });

    it("GET /processes: omitting page/pageSize returns the full unpaginated list unchanged; explicit params paginate", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const names = ["Pr-1", "Pr-2", "Pr-3"];
        for (const name of names) await db.insert(processes).values({ tenantId: tenant.tenantId, name });

        const unpaginated = await getJson<Envelope<{ name: string }>>("/api/processes", tenant.token);
        expect(unpaginated.body.data.map((p) => p.name)).toEqual(names);
        expect(unpaginated.body.pagination).toBeUndefined();

        const paginated = await getJson<Envelope<{ name: string }>>("/api/processes?page=1&pageSize=2", tenant.token);
        expect(paginated.body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
        expect(paginated.body.data.map((p) => p.name)).toEqual(["Pr-1", "Pr-2"]);
      } finally {
        await db.delete(processes).where(eq(processes.tenantId, tenant.tenantId));
        await tenant.cleanup();
      }
    });
  });

  describe("shared convention edge cases", () => {
    it("rejects pageSize over 100", async () => {
      const tenant = await createTenantWithUser([]);
      try {
        const res = await fetch(`${baseUrl}/api/retailers?pageSize=101`, { headers: { Authorization: `Bearer ${tenant.token}` } });
        expect(res.status).toBe(400);
      } finally {
        await tenant.cleanup();
      }
    });
  });
});
