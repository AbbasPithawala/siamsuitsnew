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
  extraPaymentCategories,
  extraPayments,
  paymentSettlements,
  paymentSettlementJobs,
} from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
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

async function deleteJson(baseUrl: string, path: string, token: string) {
  return fetch(`${baseUrl}${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
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

describe("/api/tailor-portal/...", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;

  let retailer: { id: string };
  let customerId: string;
  let productId: string;
  let processId: string;
  let superProduct: { id: string; components: Array<{ id: string; productId: string }> };
  let categoryId: string;

  let tailorAId: string;
  let tailorAToken: string;
  let tailorBId: string;
  let tailorBToken: string;

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const jobIds: string[] = [];
  const settlementIds: string[] = [];

  async function createComponentId(): Promise<string> {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: superProduct.components[0]!.id, features: [] }] }],
    });
    const body = (await res.json()) as { data: { id: string; items: Array<{ components: Array<{ id: string }> }> } };
    orderIds.push(body.data.id);
    const componentId = body.data.items[0]!.components[0]!.id;
    componentIds.push(componentId);
    return componentId;
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
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.processes.manage",
      "customers.manage",
      "factory.payroll.settle",
    ]);

    const [retailerRow] = await db
      .insert(retailers)
      .values({ tenantId: owner.tenantId, name: `Tailor Portal Retailer ${randomUUID()}`, code: `TPR-${randomUUID().slice(0, 6)}` })
      .returning();
    if (!retailerRow) throw new Error("Failed to create test retailer");
    retailer = retailerRow;
    customerId = await createCustomer(baseUrl, owner, retailer.id);

    productId = await createProduct(baseUrl, owner, "Tailor Portal Jacket");
    processId = await createProcess(baseUrl, owner, "Tailor Portal Stitching", "90.00");
    await setProductProcesses(baseUrl, owner, productId, [processId]);
    superProduct = await createSuperProduct(baseUrl, owner, "Tailor Portal Suit", [{ productId, slotLabel: "Jacket" }]);

    const [category] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId: owner.tenantId, productId, processId, name: `Tailor Portal Category ${randomUUID()}`, cost: "20.00" })
      .returning();
    if (!category) throw new Error("Failed to create test extra payment category");
    categoryId = category.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailorA] = await db
      .insert(tailors)
      .values({ tenantId: owner.tenantId, name: "Tailor Portal A", username: `tp-tailor-a-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailorA) throw new Error("Failed to create tailor A");
    tailorAId = tailorA.id;
    tailorAToken = issueToken({ sub: tailorAId, tenantId: owner.tenantId, actorType: "tailor" });
    await db.insert(tailorProcesses).values({ tailorId: tailorAId, processId });

    // Tailor B is intentionally NOT certified for `processId` — proves self-assign still
    // enforces certification exactly like staff-driven assignment does.
    const [tailorB] = await db
      .insert(tailors)
      .values({ tenantId: owner.tenantId, name: "Tailor Portal B", username: `tp-tailor-b-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailorB) throw new Error("Failed to create tailor B");
    tailorBId = tailorB.id;
    tailorBToken = issueToken({ sub: tailorBId, tenantId: owner.tenantId, actorType: "tailor" });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    if (settlementIds.length) await db.delete(paymentSettlementJobs).where(inArray(paymentSettlementJobs.paymentSettlementId, settlementIds));
    if (settlementIds.length) await db.delete(paymentSettlements).where(inArray(paymentSettlements.id, settlementIds));

    if (jobIds.length) await db.delete(extraPayments).where(inArray(extraPayments.jobId, jobIds));
    if (jobIds.length) await db.delete(jobs).where(inArray(jobs.id, jobIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    await db.delete(extraPaymentCategories).where(eq(extraPaymentCategories.id, categoryId));
    await db.delete(tailorProcesses).where(inArray(tailorProcesses.tailorId, [tailorAId, tailorBId]));
    await db.delete(tailors).where(inArray(tailors.id, [tailorAId, tailorBId]));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailer.id));

    await owner.cleanup();
  });

  it("401s a tailor-portal route with no token", async () => {
    const res = await getJson(baseUrl, "/api/tailor-portal/settlements", "");
    expect(res.status).toBe(401);
  });

  it("403s a staff (user) token on a tailor-portal route", async () => {
    const res = await getJson(baseUrl, "/api/tailor-portal/settlements", owner.token);
    expect(res.status).toBe(403);
  });

  it("403s a tailor token on a staff-only route", async () => {
    const res = await postJson(baseUrl, `/api/tailors/${tailorAId}/settlements`, tailorAToken, { jobIds: [] });
    expect(res.status).toBe(403);
  });

  it("self-assign: a certified tailor assigns the next step to themselves; an uncertified tailor is rejected", async () => {
    const componentId = await createComponentId();

    const uncertified = await postJson(baseUrl, `/api/tailor-portal/components/${componentId}/assign-self`, tailorBToken, {});
    expect(uncertified.status).toBe(403);
    const uncertifiedBody = (await uncertified.json()) as { error: { code: string } };
    expect(uncertifiedBody.error.code).toBe("NOT_CERTIFIED");

    const res = await postJson(baseUrl, `/api/tailor-portal/components/${componentId}/assign-self`, tailorAToken, {});
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { job: { id: string; tailorId: string } } };
    expect(body.data.job.tailorId).toBe(tailorAId);
    jobIds.push(body.data.job.id);
  });

  it("self-complete: the assignee can complete their own job; a different tailor 404s", async () => {
    const componentId = await createComponentId();
    const assignRes = await postJson(baseUrl, `/api/tailor-portal/components/${componentId}/assign-self`, tailorAToken, {});
    const assignBody = (await assignRes.json()) as { data: { job: { id: string } } };
    const jobId = assignBody.data.job.id;
    jobIds.push(jobId);

    const wrongTailor = await postJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/complete`, tailorBToken, {});
    expect(wrongTailor.status).toBe(404);

    const res = await postJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/complete`, tailorAToken, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("complete");
  });

  it("extra payments: the assignee can attach and remove one on their own job; a different tailor 404s on both", async () => {
    const componentId = await createComponentId();
    const assignRes = await postJson(baseUrl, `/api/tailor-portal/components/${componentId}/assign-self`, tailorAToken, {});
    const assignBody = (await assignRes.json()) as { data: { job: { id: string } } };
    const jobId = assignBody.data.job.id;
    jobIds.push(jobId);

    const wrongAttach = await postJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/extra-payments`, tailorBToken, { categoryId });
    expect(wrongAttach.status).toBe(404);

    const attach = await postJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/extra-payments`, tailorAToken, { categoryId });
    expect(attach.status).toBe(201);

    const wrongRemove = await deleteJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/extra-payments/${categoryId}`, tailorBToken);
    expect(wrongRemove.status).toBe(404);

    const remove = await deleteJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/extra-payments/${categoryId}`, tailorAToken);
    expect(remove.status).toBe(204);
  });

  it(
    "settlements + extra-payments queue: scoped to the logged-in tailor only, including the printable PDF slip",
    async () => {
      const componentId = await createComponentId();
      const assignRes = await postJson(baseUrl, `/api/tailor-portal/components/${componentId}/assign-self`, tailorAToken, {});
      const assignBody = (await assignRes.json()) as { data: { job: { id: string } } };
      const jobId = assignBody.data.job.id;
      jobIds.push(jobId);

      await postJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/extra-payments`, tailorAToken, { categoryId });
      await postJson(baseUrl, `/api/tailor-portal/jobs/${jobId}/complete`, tailorAToken, {});

      // Extra payments queue: tailor A sees their own pending attach; tailor B sees none of it.
      const ownExtraPayments = await getJson(baseUrl, "/api/tailor-portal/extra-payments?status=pending", tailorAToken);
      expect(ownExtraPayments.status).toBe(200);
      const ownExtraPaymentsBody = (await ownExtraPayments.json()) as { data: Array<{ jobId: string }> };
      expect(ownExtraPaymentsBody.data.some((ep) => ep.jobId === jobId)).toBe(true);

      const otherExtraPayments = await getJson(baseUrl, "/api/tailor-portal/extra-payments?status=pending", tailorBToken);
      const otherExtraPaymentsBody = (await otherExtraPayments.json()) as { data: Array<{ jobId: string }> };
      expect(otherExtraPaymentsBody.data.some((ep) => ep.jobId === jobId)).toBe(false);

      // Staff settles the (now complete) job.
      const settleRes = await postJson(baseUrl, `/api/tailors/${tailorAId}/settlements`, owner.token, { jobIds: [jobId] });
      expect(settleRes.status).toBe(201);
      const settleBody = (await settleRes.json()) as { data: { id: string } };
      const settlementId = settleBody.data.id;
      settlementIds.push(settlementId);

      // Tailor A sees it in their own list; tailor B's list is empty of it.
      const ownSettlements = await getJson(baseUrl, "/api/tailor-portal/settlements", tailorAToken);
      const ownSettlementsBody = (await ownSettlements.json()) as { data: Array<{ id: string }> };
      expect(ownSettlementsBody.data.some((s) => s.id === settlementId)).toBe(true);

      const otherSettlements = await getJson(baseUrl, "/api/tailor-portal/settlements", tailorBToken);
      const otherSettlementsBody = (await otherSettlements.json()) as { data: Array<{ id: string }> };
      expect(otherSettlementsBody.data.some((s) => s.id === settlementId)).toBe(false);

      // Detail: own succeeds, a different tailor 404s.
      const ownDetail = await getJson(baseUrl, `/api/tailor-portal/settlements/${settlementId}`, tailorAToken);
      expect(ownDetail.status).toBe(200);
      const wrongDetail = await getJson(baseUrl, `/api/tailor-portal/settlements/${settlementId}`, tailorBToken);
      expect(wrongDetail.status).toBe(404);

      // PDF: a different tailor 404s before ever rendering; the actual owner gets a real PDF.
      const wrongPdf = await postJson(baseUrl, `/api/tailor-portal/settlements/${settlementId}/pdf`, tailorBToken, {});
      expect(wrongPdf.status).toBe(404);

      const ownPdf = await postJson(baseUrl, `/api/tailor-portal/settlements/${settlementId}/pdf`, tailorAToken, {});
      expect(ownPdf.status).toBe(201);
      const ownPdfBody = (await ownPdf.json()) as { data: { path: string } };
      expect(ownPdfBody.data.path.length).toBeGreaterThan(0);
    },
    30000
  );
});
