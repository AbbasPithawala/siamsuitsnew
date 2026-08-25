import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, inArray, and } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import {
  retailers,
  customers,
  productProcesses,
  tailors,
  tailorProcesses,
  extraPaymentCategories,
  extraPayments,
  jobs,
  manufacturingSteps,
  orderItemComponents,
  orderItemComponentFeatures,
  orderItems,
  orders,
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

async function patchJson(baseUrl: string, path: string, token: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
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

describe("/api/jobs/:jobId/extra-payments and /api/extra-payments/:id/approve", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noManage: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noApprove: Awaited<ReturnType<typeof createTenantWithUser>>;

  let retailer: { id: string };
  let customerId: string;
  let productId: string;
  let processId: string;
  let tailorId: string;
  let superProduct: { id: string; components: Array<{ id: string; productId: string }> };
  let lapel: { featureId: string; styleId: string };
  let categoryId: string;

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const jobIds: string[] = [];

  async function createAssignedJobId(): Promise<string> {
    const res = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: superProduct.components[0]!.id, features: [{ featureId: lapel.featureId, styleId: lapel.styleId }] }] }],
    });
    const body = (await res.json()) as { data: { id: string; items: Array<{ components: Array<{ id: string }> }> } };
    orderIds.push(body.data.id);
    const componentId = body.data.items[0]!.components[0]!.id;
    componentIds.push(componentId);

    const assignRes = await postJson(baseUrl, `/api/manufacturing/components/${componentId}/assign`, owner.token, { tailorId });
    const assignBody = (await assignRes.json()) as { data: { job: { id: string } } };
    jobIds.push(assignBody.data.job.id);
    return assignBody.data.job.id;
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
      "catalog.features.manage",
      "customers.manage",
      "factory.jobs.assign",
      "factory.extra_payments.manage",
      "factory.extra_payments.approve",
    ]);
    noManage = await createTenantWithUser(["factory.extra_payments.approve"]);
    noApprove = await createTenantWithUser(["factory.extra_payments.manage"]);

    const [retailerRow] = await db
      .insert(retailers)
      .values({ tenantId: owner.tenantId, name: `EP Route Retailer ${randomUUID()}`, code: `EPR-${randomUUID().slice(0, 6)}` })
      .returning();
    if (!retailerRow) throw new Error("Failed to create test retailer");
    retailer = retailerRow;
    customerId = await createCustomer(baseUrl, owner, retailer.id);

    productId = await createProduct(baseUrl, owner, "EP Jacket");
    processId = await createProcess(baseUrl, owner, "EP Stitching");
    await setProductProcesses(baseUrl, owner, productId, [processId]);
    superProduct = await createSuperProduct(baseUrl, owner, "EP Suit", [{ productId, slotLabel: "Jacket" }]);
    lapel = await createChoiceFeatureWithStyle(baseUrl, owner, productId);

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId: owner.tenantId, name: "EP Route Tailor", username: `ep-route-tailor-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;
    await db.insert(tailorProcesses).values({ tailorId, processId });

    const [category] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId: owner.tenantId, productId, processId, featureId: lapel.featureId, styleId: lapel.styleId, name: `EP Route Category ${randomUUID()}`, cost: "30.00" })
      .returning();
    if (!category) throw new Error("Failed to create test extra payment category");
    categoryId = category.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    if (jobIds.length) await db.delete(extraPayments).where(inArray(extraPayments.jobId, jobIds));
    if (jobIds.length) await db.delete(jobs).where(inArray(jobs.id, jobIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) {
      await db.delete(orderItemComponentFeatures).where(inArray(orderItemComponentFeatures.orderItemComponentId, componentIds));
    }
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    await db.delete(extraPaymentCategories).where(eq(extraPaymentCategories.id, categoryId));
    await db.delete(tailorProcesses).where(and(eq(tailorProcesses.tailorId, tailorId), eq(tailorProcesses.processId, processId)));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailer.id));

    await Promise.all([noManage.cleanup(), noApprove.cleanup(), owner.cleanup()]);
  });

  it("403s a create request from a user lacking factory.extra_payments.manage", async () => {
    const jobId = await createAssignedJobId();
    const res = await postJson(baseUrl, `/api/jobs/${jobId}/extra-payments`, noManage.token, { categoryId });
    expect(res.status).toBe(403);
  });

  it("401s a create request with no token", async () => {
    const jobId = await createAssignedJobId();
    const res = await fetch(`${baseUrl}/api/jobs/${jobId}/extra-payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    expect(res.status).toBe(401);
  });

  it("creates an extra payment for a user holding factory.extra_payments.manage, defaulting to approved: false", async () => {
    const jobId = await createAssignedJobId();
    const res = await postJson(baseUrl, `/api/jobs/${jobId}/extra-payments`, owner.token, { categoryId });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; approved: boolean; cost: string } };
    expect(body.data.approved).toBe(false);
    expect(body.data.cost).toBe("30.00");

    // 403s the approve endpoint for a user lacking factory.extra_payments.approve.
    const forbiddenApprove = await patchJson(baseUrl, `/api/extra-payments/${body.data.id}/approve`, noApprove.token);
    expect(forbiddenApprove.status).toBe(403);

    // Succeeds for a user holding factory.extra_payments.approve.
    const approveRes = await patchJson(baseUrl, `/api/extra-payments/${body.data.id}/approve`, owner.token);
    expect(approveRes.status).toBe(200);
    const approveBody = (await approveRes.json()) as { data: { approved: boolean } };
    expect(approveBody.data.approved).toBe(true);
  });

  it("rejects a request body missing categoryId with VALIDATION_ERROR", async () => {
    const jobId = await createAssignedJobId();
    const res = await postJson(baseUrl, `/api/jobs/${jobId}/extra-payments`, owner.token, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
