import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import {
  retailers,
  customers,
  tailors,
  tailorProcesses,
  extraPaymentCategories,
  extraPayments,
  jobs,
  manufacturingSteps,
  orderItemComponents,
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

/**
 * Group 0's CRUD for `extra_payment_categories`. The acceptance-critical test at the
 * bottom proves this connects to Phase 3's untouched `POST /jobs/:jobId/extra-payments` —
 * the category half of the feature has been unreachable since Phase 3 until this endpoint
 * existed.
 */
describe("/api/extra-payment-categories", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let managerB: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noManage: Awaited<ReturnType<typeof createTenantWithUser>>;

  let retailer: { id: string };
  let customerId: string;
  let productId: string;
  let processId: string;
  let tailorId: string;
  let superProduct: { id: string; components: Array<{ id: string; productId: string }> };

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const jobIds: string[] = [];
  const categoryIds: string[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    [owner, managerB, noManage] = await Promise.all([
      createTenantWithUser([
        "catalog.products.manage",
        "catalog.processes.manage",
        "catalog.super_products.manage",
        "customers.manage",
        "orders.create",
        "factory.jobs.assign",
        "factory.extra_payments.manage",
      ]),
      createTenantWithUser(["factory.extra_payments.manage"]),
      createTenantWithUser(["orders.view"]),
    ]);

    const [retailerRow] = await db
      .insert(retailers)
      .values({ tenantId: owner.tenantId, name: `EPC Route Retailer ${randomUUID()}`, code: `EPCR-${randomUUID().slice(0, 6)}` })
      .returning();
    if (!retailerRow) throw new Error("Failed to create test retailer");
    retailer = retailerRow;
    customerId = await createCustomer(baseUrl, owner, retailer.id);

    productId = await createProduct(baseUrl, owner, "EPC Jacket");
    processId = await createProcess(baseUrl, owner, "EPC Stitching");
    await setProductProcesses(baseUrl, owner, productId, [processId]);
    superProduct = await createSuperProduct(baseUrl, owner, "EPC Suit", [{ productId, slotLabel: "Jacket" }]);

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId: owner.tenantId, name: "EPC Route Tailor", username: `epc-route-tailor-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;
    await db.insert(tailorProcesses).values({ tailorId, processId });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    if (jobIds.length) await db.delete(extraPayments).where(inArray(extraPayments.jobId, jobIds));
    if (jobIds.length) await db.delete(jobs).where(inArray(jobs.id, jobIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    if (categoryIds.length) await db.delete(extraPaymentCategories).where(inArray(extraPaymentCategories.id, categoryIds));
    await db.delete(tailorProcesses).where(eq(tailorProcesses.tailorId, tailorId));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailer.id));

    await Promise.all([owner.cleanup(), managerB.cleanup(), noManage.cleanup()]);
  });

  it("401s a create request with no token", async () => {
    const res = await fetch(`${baseUrl}/api/extra-payment-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, processId, name: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("403s a create request from a user lacking factory.extra_payments.manage", async () => {
    const res = await postJson(baseUrl, "/api/extra-payment-categories", noManage.token, { productId, processId, name: "x" });
    expect(res.status).toBe(403);
  });

  it("allows a user with no write permission to read the list (reads only require authentication)", async () => {
    const res = await fetch(`${baseUrl}/api/extra-payment-categories`, { headers: { Authorization: `Bearer ${noManage.token}` } });
    expect(res.status).toBe(200);
  });

  it("404s creation against a nonexistent productId/processId/featureId/styleId", async () => {
    const bogus = randomUUID();
    const productRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, { productId: bogus, processId, name: "x" });
    expect(productRes.status).toBe(404);
    expect(((await productRes.json()) as { error: { code: string } }).error.code).toBe("PRODUCT_NOT_FOUND");

    const processRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, { productId, processId: bogus, name: "x" });
    expect(processRes.status).toBe(404);
    expect(((await processRes.json()) as { error: { code: string } }).error.code).toBe("PROCESS_NOT_FOUND");

    const featureRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, {
      productId,
      processId,
      featureId: bogus,
      name: "x",
    });
    expect(featureRes.status).toBe(404);
    expect(((await featureRes.json()) as { error: { code: string } }).error.code).toBe("FEATURE_NOT_FOUND");

    const styleRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, {
      productId,
      processId,
      styleId: bogus,
      name: "x",
    });
    expect(styleRes.status).toBe(404);
    expect(((await styleRes.json()) as { error: { code: string } }).error.code).toBe("STYLE_NOT_FOUND");
  });

  it("creates a category and is tenant-scoped: tenant B cannot see tenant A's category", async () => {
    const createRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, {
      productId,
      processId,
      name: `Tenant Scoping ${randomUUID()}`,
      cost: "15.00",
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    categoryIds.push(created.data.id);

    const getAsOwner = await fetch(`${baseUrl}/api/extra-payment-categories/${created.data.id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(getAsOwner.status).toBe(200);

    const getAsB = await fetch(`${baseUrl}/api/extra-payment-categories/${created.data.id}`, {
      headers: { Authorization: `Bearer ${managerB.token}` },
    });
    expect(getAsB.status).toBe(404);

    const listAsB = await fetch(`${baseUrl}/api/extra-payment-categories`, { headers: { Authorization: `Bearer ${managerB.token}` } });
    const listBody = (await listAsB.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.map((c) => c.id)).not.toContain(created.data.id);
  });

  it("updates and soft-deletes a category", async () => {
    const createRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, {
      productId,
      processId,
      name: `Original ${randomUUID()}`,
      cost: "5.00",
    });
    const created = (await createRes.json()) as { data: { id: string } };
    categoryIds.push(created.data.id);

    const patchRes = await fetch(`${baseUrl}/api/extra-payment-categories/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ cost: "9.99" }),
    });
    expect(patchRes.status).toBe(200);
    expect(((await patchRes.json()) as { data: { cost: string } }).data.cost).toBe("9.99");

    const deleteRes = await fetch(`${baseUrl}/api/extra-payment-categories/${created.data.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/extra-payment-categories/${created.data.id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(getAfterDelete.status).toBe(404);
  });

  it(
    "creates a category through this new endpoint, then uses it to create a real ExtraPayment through Phase 3's " +
      "existing, untouched POST /jobs/:jobId/extra-payments — the acceptance proof the two halves of this feature connect",
    async () => {
      const createRes = await postJson(baseUrl, "/api/extra-payment-categories", owner.token, {
        productId,
        processId,
        name: `Real Integration ${randomUUID()}`,
        cost: "42.00",
      });
      expect(createRes.status).toBe(201);
      const category = (await createRes.json()) as { data: { id: string; cost: string } };
      categoryIds.push(category.data.id);
      expect(category.data.cost).toBe("42.00");

      const orderRes = await postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: retailer.id,
        customerId,
        items: [{ superProductId: superProduct.id, components: [{ superProductComponentId: superProduct.components[0]!.id, features: [] }] }],
      });
      expect(orderRes.status).toBe(201);
      const order = (await orderRes.json()) as { data: { id: string; items: Array<{ components: Array<{ id: string }> }> } };
      orderIds.push(order.data.id);
      const componentId = order.data.items[0]!.components[0]!.id;
      componentIds.push(componentId);

      const assignRes = await postJson(baseUrl, `/api/manufacturing/components/${componentId}/assign`, owner.token, { tailorId });
      expect(assignRes.status).toBe(201);
      const assigned = (await assignRes.json()) as { data: { job: { id: string } } };
      const jobId = assigned.data.job.id;
      jobIds.push(jobId);

      const extraPaymentRes = await postJson(baseUrl, `/api/jobs/${jobId}/extra-payments`, owner.token, { categoryId: category.data.id });
      expect(extraPaymentRes.status).toBe(201);
      const extraPayment = (await extraPaymentRes.json()) as {
        data: { jobId: string; categoryId: string; cost: string; approved: boolean };
      };
      expect(extraPayment.data.jobId).toBe(jobId);
      expect(extraPayment.data.categoryId).toBe(category.data.id);
      expect(extraPayment.data.cost).toBe("42.00");
      expect(extraPayment.data.approved).toBe(false);
    }
  );
});
