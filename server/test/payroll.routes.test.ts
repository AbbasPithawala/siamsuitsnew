import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import {
  retailers,
  customers,
  productProcesses,
  tailors,
  tailorProcesses,
  jobs,
  manufacturingSteps,
  orderItemComponents,
  orderItems,
  orders,
  workerAdvancePayments,
  paymentSettlements,
  paymentSettlementJobs,
} from "../src/db/schema/index";
import { hashPassword } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

interface Ctx {
  token: string;
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

async function createProcess(baseUrl: string, ctx: Ctx, name: string, price: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/processes", ctx.token, { name: `${name} ${randomUUID()}`, price });
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

async function createSuperProduct(baseUrl: string, ctx: Ctx, name: string, components: Array<{ productId: string; slotLabel: string }>) {
  const res = await postJson(baseUrl, "/api/super-products", ctx.token, {
    name: `${name} ${randomUUID()}`,
    components: components.map((c, i) => ({ ...c, sequence: i + 1 })),
  });
  const body = (await res.json()) as { data: { id: string; components: Array<{ id: string; productId: string }> } };
  return body.data;
}

async function createCustomer(baseUrl: string, ctx: Ctx, retailerId: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/customers", ctx.token, { retailerId, firstName: `Customer ${randomUUID()}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

describe("/api/tailors/:tailorId/advances and /api/tailors/:tailorId/settlements", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noAdvance: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noSettle: Awaited<ReturnType<typeof createTenantWithUser>>;

  let retailer: { id: string };
  let customerId: string;
  let productId: string;
  let processId: string;
  let tailorId: string;
  let superProduct: { id: string; components: Array<{ id: string; productId: string }> };

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const jobIds: string[] = [];
  const advanceIds: string[] = [];
  const settlementIds: string[] = [];

  async function createUnpaidJobId(): Promise<string> {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: superProduct.components[0]!.id, features: [] }] }],
    });
    const body = (await res.json()) as { data: { id: string; items: Array<{ components: Array<{ id: string }> }> } };
    orderIds.push(body.data.id);
    const componentId = body.data.items[0]!.components[0]!.id;
    componentIds.push(componentId);

    const assignRes = await postJson(baseUrl, `/api/manufacturing/components/${componentId}/assign`, owner.token, { tailorId });
    const assignBody = (await assignRes.json()) as { data: { job: { id: string } } };
    const jobId = assignBody.data.job.id;
    jobIds.push(jobId);

    // `createSettlement` requires the job's manufacturing step to be complete
    // (PHASE_7_TASKS.md Group 1 finding — was previously unenforced).
    const completeRes = await postJson(baseUrl, `/api/manufacturing/jobs/${jobId}/complete`, owner.token, {});
    if (!completeRes.ok) throw new Error(`Failed to complete job ${jobId}: ${completeRes.status}`);

    return jobId;
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
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.processes.manage",
      "customers.manage",
      "factory.jobs.assign",
      "factory.jobs.complete",
      "factory.advance_payments.manage",
      "factory.payroll.settle",
    ]);
    noAdvance = await createTenantWithUser(["factory.payroll.settle"]);
    noSettle = await createTenantWithUser(["factory.advance_payments.manage"]);

    const [retailerRow] = await db
      .insert(retailers)
      .values({ tenantId: owner.tenantId, name: `Payroll Route Retailer ${randomUUID()}`, code: `PRR-${randomUUID().slice(0, 6)}` })
      .returning();
    if (!retailerRow) throw new Error("Failed to create test retailer");
    retailer = retailerRow;
    customerId = await createCustomer(baseUrl, owner, retailer.id);

    productId = await createProduct(baseUrl, owner, "Payroll Jacket");
    processId = await createProcess(baseUrl, owner, "Payroll Stitching", "80.00");
    await setProductProcesses(baseUrl, owner, productId, [processId]);
    superProduct = await createSuperProduct(baseUrl, owner, "Payroll Suit", [{ productId, slotLabel: "Jacket" }]);

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId: owner.tenantId, name: "Payroll Route Tailor", username: `payroll-route-tailor-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;
    await db.insert(tailorProcesses).values({ tailorId, processId });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    await db.delete(workerAdvancePayments).where(eq(workerAdvancePayments.tailorId, tailorId));
    if (settlementIds.length) await db.delete(paymentSettlementJobs).where(inArray(paymentSettlementJobs.paymentSettlementId, settlementIds));
    if (settlementIds.length) await db.delete(paymentSettlements).where(inArray(paymentSettlements.id, settlementIds));

    if (jobIds.length) await db.delete(jobs).where(inArray(jobs.id, jobIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    await db.delete(tailorProcesses).where(eq(tailorProcesses.tailorId, tailorId));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailer.id));

    await Promise.all([noAdvance.cleanup(), noSettle.cleanup(), owner.cleanup()]);
  });

  it("403s an advance request from a user lacking factory.advance_payments.manage", async () => {
    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/advances`, noAdvance.token, { amount: 50 });
    expect(res.status).toBe(403);
  });

  it("401s an advance request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/tailors/${tailorId}/advances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 50 }),
    });
    expect(res.status).toBe(401);
  });

  it("creates an advance for a user holding factory.advance_payments.manage and increments advanceBalance", async () => {
    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/advances`, owner.token, { amount: 75 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { advance: { id: string; amount: string; cleared: boolean }; tailor: { advanceBalance: string } } };
    advanceIds.push(body.data.advance.id);

    expect(body.data.advance.amount).toBe("75.00");
    expect(body.data.advance.cleared).toBe(false);
    expect(body.data.tailor.advanceBalance).toBe("75.00");
  });

  it("rejects a non-positive advance amount with VALIDATION_ERROR", async () => {
    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/advances`, owner.token, { amount: 0 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("403s a settlement request from a user lacking factory.payroll.settle", async () => {
    const jobId = await createUnpaidJobId();
    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/settlements`, noSettle.token, { jobIds: [jobId] });
    expect(res.status).toBe(403);
  });

  it("settles unpaid jobs, deducting the outstanding advance and clearing it, and GET returns the same detail", async () => {
    const jobId = await createUnpaidJobId();

    // Outstanding advance balance is 75.00 from the earlier test in this file.
    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/settlements`, owner.token, {
      jobIds: [jobId],
      rent: 20,
      manualBill: 5,
      deductedAdvance: 75,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { id: string; subTotal: string; totalPay: string; deductedAdvance: string; rent: string; manualBill: string };
    };
    settlementIds.push(body.data.id);

    // subTotal = job.cost (80.00) + job.stylingPrice (0.00) = 80.00.
    // totalPay = 80 + 5 + 20 - 75 = 30.00.
    expect(body.data.subTotal).toBe("80.00");
    expect(body.data.totalPay).toBe("30.00");
    expect(body.data.deductedAdvance).toBe("75.00");

    const getRes = await getJson(baseUrl, `/api/tailors/${tailorId}/settlements/${body.data.id}`, owner.token);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { data: { settlement: { id: string }; jobs: Array<{ id: string; paid: boolean }> } };
    expect(getBody.data.settlement.id).toBe(body.data.id);
    expect(getBody.data.jobs).toHaveLength(1);
    expect(getBody.data.jobs[0]!.id).toBe(jobId);
    expect(getBody.data.jobs[0]!.paid).toBe(true);

    const reloadedTailor = await db.query.tailors.findFirst({ where: eq(tailors.id, tailorId) });
    expect(reloadedTailor?.advanceBalance).toBe("0.00");

    const reloadedAdvance = await db.query.workerAdvancePayments.findFirst({ where: eq(workerAdvancePayments.id, advanceIds[0]!) });
    expect(reloadedAdvance?.cleared).toBe(true);
    expect(reloadedAdvance?.paymentSettlementId).toBe(body.data.id);
  });

  it("computes subTotal/totalPay server-side from the real job cost — ignoring any client-submitted subTotal/totalPay", async () => {
    const jobId = await createUnpaidJobId();

    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/settlements`, owner.token, {
      jobIds: [jobId],
      subTotal: 999999.99,
      totalPay: 999999.99,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; subTotal: string; totalPay: string } };
    settlementIds.push(body.data.id);

    // job.cost = process price (80.00), no styling — subTotal/totalPay must be this real
    // computed value, not the bogus client-submitted ones above (which aren't even part of
    // createSettlementSchema, so they're stripped before the service ever sees them).
    expect(body.data.subTotal).toBe("80.00");
    expect(body.data.totalPay).toBe("80.00");
  });

  it("rejects re-settling an already-paid job", async () => {
    const jobId = await createUnpaidJobId();
    const firstSettle = await postJson(baseUrl, `/api/tailors/${tailorId}/settlements`, owner.token, { jobIds: [jobId] });
    expect(firstSettle.status).toBe(201);
    const firstBody = (await firstSettle.json()) as { data: { id: string } };
    settlementIds.push(firstBody.data.id);

    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/settlements`, owner.token, { jobIds: [jobId] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("JOB_ALREADY_PAID");
  });

  it("rejects a settlement body with an empty jobIds array with VALIDATION_ERROR", async () => {
    const res = await postJson(baseUrl, `/api/tailors/${tailorId}/settlements`, owner.token, { jobIds: [] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
