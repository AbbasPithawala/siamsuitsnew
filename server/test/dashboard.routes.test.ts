import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import {
  retailers,
  retailerUsers,
  users,
  customers,
  orders,
  orderInvoices,
  products,
  superProducts,
  orderItems,
  orderItemComponents,
  processes,
  manufacturingSteps,
  tailors,
  jobs,
  extraPaymentCategories,
  extraPayments,
} from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface DashboardSummaryBody {
  data: {
    scope: "retailer" | "admin";
    stats: {
      totalOrders: number;
      activeOrders: number;
      totalRevenue: string;
      totalRetailers?: number;
      activeTailorJobs?: number;
      tailorCost?: string;
    };
    ordersByStatus: { status: string; count: number }[];
    ordersTrend: { date: string; count: number }[];
    revenueTrend: { date: string; revenue: string; tailorCost?: string }[];
    topRetailers?: { retailerId: string; name: string; orderCount: number; revenue: string }[];
    tailorJobsByStatus?: { status: string; count: number }[];
  };
}

describe("GET /api/dashboard/summary", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let tenantId: string;

  let retailerAId: string;
  let retailerBId: string;
  let retailerAUserToken: string;
  let retailerAUserId: string;

  let productId: string;
  let superProductId: string;
  let processId: string;
  let tailorId: string;
  const extraPaymentCategoryIds: string[] = [];

  const orderIds: string[] = [];
  const jobIds: string[] = [];
  const extraPaymentIds: string[] = [];
  const manufacturingStepIds: string[] = [];
  const orderItemComponentIds: string[] = [];
  const orderItemIds: string[] = [];
  const customerIds: string[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    owner = await createTenantWithUser([]);
    tenantId = owner.tenantId;

    const suffix = randomUUID();
    const [retailerA] = await db
      .insert(retailers)
      .values({ tenantId, name: `Dashboard Retailer A ${suffix}`, code: `DRA-${suffix.slice(0, 6)}` })
      .returning();
    const [retailerB] = await db
      .insert(retailers)
      .values({ tenantId, name: `Dashboard Retailer B ${suffix}`, code: `DRB-${suffix.slice(0, 6)}` })
      .returning();
    if (!retailerA || !retailerB) throw new Error("Failed to create test retailers");
    retailerAId = retailerA.id;
    retailerBId = retailerB.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [retailerAUser] = await db
      .insert(users)
      .values({ tenantId, name: "Dashboard Retailer A User", username: `dash-ret-a-${suffix}`, passwordHash })
      .returning();
    if (!retailerAUser) throw new Error("Failed to create retailer-linked user");
    retailerAUserId = retailerAUser.id;
    await db.insert(retailerUsers).values({ retailerId: retailerAId, userId: retailerAUserId });
    retailerAUserToken = issueToken({ sub: retailerAUserId, tenantId, actorType: "user" });

    const [customerA] = await db.insert(customers).values({ tenantId, retailerId: retailerAId, firstName: "Customer A" }).returning();
    const [customerB] = await db.insert(customers).values({ tenantId, retailerId: retailerBId, firstName: "Customer B" }).returning();
    if (!customerA || !customerB) throw new Error("Failed to create test customers");
    customerIds.push(customerA.id, customerB.id);

    const [product] = await db.insert(products).values({ tenantId, name: `Dashboard Product ${suffix}` }).returning();
    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `Dashboard Super Product ${suffix}` }).returning();
    const [process] = await db.insert(processes).values({ tenantId, name: `Dashboard Process ${suffix}` }).returning();
    if (!product || !superProduct || !process) throw new Error("Failed to create test catalog rows");
    productId = product.id;
    superProductId = superProduct.id;
    processId = process.id;

    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "Dashboard Tailor", username: `dash-tailor-${suffix}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;

    const categoryRows = await db
      .insert(extraPaymentCategories)
      .values([
        { tenantId, productId, processId, name: "Dashboard Extra Category A", cost: "0" },
        { tenantId, productId, processId, name: "Dashboard Extra Category B", cost: "0" },
        { tenantId, productId, processId, name: "Dashboard Extra Category C", cost: "0" },
      ])
      .returning();
    if (categoryRows.length !== 3) throw new Error("Failed to create test extra payment categories");
    extraPaymentCategoryIds.push(...categoryRows.map((c) => c.id));

    async function makeOrder(retailerId: string, customerId: string, status: string, orderNumber: string) {
      const [order] = await db
        .insert(orders)
        .values({ tenantId, retailerId, customerId, orderNumber, status })
        .returning();
      if (!order) throw new Error("Failed to create test order");
      orderIds.push(order.id);
      return order.id;
    }

    async function makeInvoice(orderId: string, total: string) {
      await db.insert(orderInvoices).values({ tenantId, orderId, total });
    }

    async function makeComponentWithSteps(orderId: string, statuses: string[]) {
      const [item] = await db.insert(orderItems).values({ orderId, superProductId, sequence: 1 }).returning();
      if (!item) throw new Error("Failed to create test order item");
      orderItemIds.push(item.id);
      const [component] = await db.insert(orderItemComponents).values({ orderItemId: item.id, productId, slotLabel: "Body" }).returning();
      if (!component) throw new Error("Failed to create test order item component");
      orderItemComponentIds.push(component.id);
      for (const [i, status] of statuses.entries()) {
        const [step] = await db
          .insert(manufacturingSteps)
          .values({ orderItemComponentId: component.id, processId, sequenceOrder: i + 1, status: status as "pending" | "assigned" | "complete" })
          .returning();
        if (!step) throw new Error("Failed to create test manufacturing step");
        manufacturingStepIds.push(step.id);
      }
    }

    const a1 = await makeOrder(retailerAId, customerA.id, "New Order", `DASH-A1-${suffix}`);
    const a2 = await makeOrder(retailerAId, customerA.id, "Processing", `DASH-A2-${suffix}`);
    const a3 = await makeOrder(retailerAId, customerA.id, "Sent", `DASH-A3-${suffix}`);
    const b1 = await makeOrder(retailerBId, customerB.id, "New Order", `DASH-B1-${suffix}`);
    const b2 = await makeOrder(retailerBId, customerB.id, "Sent", `DASH-B2-${suffix}`);

    await makeInvoice(a1, "100.00");
    await makeInvoice(a2, "50.00");
    await makeInvoice(b1, "200.00");
    await makeInvoice(b2, "300.00");

    await makeComponentWithSteps(a1, ["pending", "complete"]);
    await makeComponentWithSteps(b1, ["assigned"]);

    const [job1] = await db
      .insert(jobs)
      .values({ tenantId, manufacturingStepId: manufacturingStepIds[0]!, tailorId, cost: "30.00" })
      .returning();
    const [job2] = await db
      .insert(jobs)
      .values({ tenantId, manufacturingStepId: manufacturingStepIds[1]!, tailorId, cost: "20.00" })
      .returning();
    if (!job1 || !job2) throw new Error("Failed to create test jobs");
    jobIds.push(job1.id, job2.id);

    const [ep1] = await db
      .insert(extraPayments)
      .values({ jobId: job1.id, categoryId: extraPaymentCategoryIds[0]!, tailorId, cost: "5.00", approved: true, rejected: false })
      .returning();
    const [ep2] = await db
      .insert(extraPayments)
      .values({ jobId: job1.id, categoryId: extraPaymentCategoryIds[1]!, tailorId, cost: "15.00", approved: false, rejected: false })
      .returning();
    const [ep3] = await db
      .insert(extraPayments)
      .values({ jobId: job2.id, categoryId: extraPaymentCategoryIds[2]!, tailorId, cost: "25.00", approved: true, rejected: true })
      .returning();
    if (!ep1 || !ep2 || !ep3) throw new Error("Failed to create test extra payments");
    extraPaymentIds.push(ep1.id, ep2.id, ep3.id);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    for (const id of extraPaymentIds) await db.delete(extraPayments).where(eq(extraPayments.id, id));
    for (const id of jobIds) await db.delete(jobs).where(eq(jobs.id, id));
    for (const id of extraPaymentCategoryIds) await db.delete(extraPaymentCategories).where(eq(extraPaymentCategories.id, id));
    for (const id of manufacturingStepIds) await db.delete(manufacturingSteps).where(eq(manufacturingSteps.id, id));
    for (const id of orderItemComponentIds) await db.delete(orderItemComponents).where(eq(orderItemComponents.id, id));
    for (const id of orderItemIds) await db.delete(orderItems).where(eq(orderItems.id, id));
    for (const id of orderIds) await db.delete(orderInvoices).where(eq(orderInvoices.orderId, id));
    for (const id of orderIds) await db.delete(orders).where(eq(orders.id, id));
    if (tailorId) await db.delete(tailors).where(eq(tailors.id, tailorId));
    for (const id of customerIds) await db.delete(customers).where(eq(customers.id, id));
    if (retailerAUserId) {
      await db.delete(retailerUsers).where(eq(retailerUsers.userId, retailerAUserId));
      await db.delete(users).where(eq(users.id, retailerAUserId));
    }
    if (retailerAId) await db.delete(retailers).where(eq(retailers.id, retailerAId));
    if (retailerBId) await db.delete(retailers).where(eq(retailers.id, retailerBId));
    await owner.cleanup();
  });

  it("scopes a retailer-linked actor to only their own retailer's numbers", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { Authorization: `Bearer ${retailerAUserToken}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DashboardSummaryBody;

    expect(body.data.scope).toBe("retailer");
    expect(body.data).not.toHaveProperty("totalRetailers");
    expect(body.data.stats).not.toHaveProperty("totalRetailers");
    expect(body.data.stats).not.toHaveProperty("activeTailorJobs");
    expect(body.data.stats).not.toHaveProperty("tailorCost");
    expect(body.data).not.toHaveProperty("topRetailers");
    expect(body.data).not.toHaveProperty("tailorJobsByStatus");

    expect(body.data.stats.totalOrders).toBe(3);
    expect(body.data.stats.activeOrders).toBe(2);
    expect(Number(body.data.stats.totalRevenue)).toBeCloseTo(150, 2);

    const byStatus = Object.fromEntries(body.data.ordersByStatus.map((r) => [r.status, r.count]));
    expect(byStatus["New Order"]).toBe(1);
    expect(byStatus["Processing"]).toBe(1);
    expect(byStatus["Sent"]).toBe(1);

    for (const row of body.data.revenueTrend) expect(row).not.toHaveProperty("tailorCost");
  });

  it("gives an admin/staff actor tenant-wide numbers plus admin-only fields", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { Authorization: `Bearer ${owner.token}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DashboardSummaryBody;

    expect(body.data.scope).toBe("admin");
    expect(body.data.stats.totalOrders).toBe(5);
    expect(body.data.stats.activeOrders).toBe(3);

    expect(body.data.stats.totalRetailers).toBeGreaterThanOrEqual(2);
    expect(body.data.stats.activeTailorJobs).toBe(2);
    expect(Number(body.data.stats.tailorCost)).toBeCloseTo(55, 2);

    const grossRevenue = 100 + 50 + 0 + 200 + 300;
    expect(Number(body.data.stats.totalRevenue)).toBeCloseTo(grossRevenue - 55, 2);

    const tailorStatusMap = Object.fromEntries((body.data.tailorJobsByStatus ?? []).map((r) => [r.status, r.count]));
    expect(tailorStatusMap["pending"]).toBe(1);
    expect(tailorStatusMap["assigned"]).toBe(1);
    expect(tailorStatusMap["complete"]).toBeUndefined();

    // jobs/extraPayments in this fixture are all created "now" (default createdAt), same
    // calendar day as the orders driving revenue — so today's bucket carries both.
    const today = new Date().toISOString().slice(0, 10);
    const todayRow = body.data.revenueTrend.find((r) => r.date === today);
    expect(todayRow).toBeDefined();
    expect(todayRow?.tailorCost).toBeDefined();
    expect(Number(todayRow?.tailorCost)).toBeCloseTo(55, 2);

    const topRetailers = body.data.topRetailers ?? [];
    const retailerARow = topRetailers.find((r) => r.retailerId === retailerAId);
    const retailerBRow = topRetailers.find((r) => r.retailerId === retailerBId);
    expect(retailerARow?.orderCount).toBe(3);
    expect(Number(retailerARow?.revenue)).toBeCloseTo(150, 2);
    expect(retailerBRow?.orderCount).toBe(2);
    expect(Number(retailerBRow?.revenue)).toBeCloseTo(500, 2);
  });

  it("401s with no token", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/summary`);
    expect(res.status).toBe(401);
  });
});
