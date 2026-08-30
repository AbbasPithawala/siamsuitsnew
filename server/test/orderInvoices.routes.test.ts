import type { Server } from "node:http";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { retailers, retailerInvoices, retailerInvoiceOrders, orderInvoices, roles, rolePermissions, userRoles, users } from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { closePdfBrowser } from "../src/services/orderPdf.service";
import { LOCAL_STATIC_URL_PREFIX, localStorageRootDir } from "../src/services/storage.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

/**
 * PHASE_10_TASKS.md invoicing follow-up — end-to-end coverage of the legacy `CreateInvoice.jsx`/
 * `InvoiceHistory.jsx` workflow this rewrite added on top of the pre-existing generic,
 * manual-line-item `retailer_invoices` feature (`invoices.routes.test.ts` covers that original
 * path; this file is additive, not a replacement): an order's own auto-generated, priceable
 * invoice draft (`order_invoices`/`order_invoice_lines`), bundling priced orders into a grouped
 * retailer invoice (`retailer_invoice_orders`), and the server-rendered PDFs for both.
 */

interface Ctx {
  token: string;
}

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Order Invoice Test Retailer ${suffix}`, code: `OI${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

async function createUserInTenant(tenantId: string, permissionKeys: string[]) {
  const suffix = randomUUID();
  const [role] = await db.insert(roles).values({ tenantId, name: `OrderInvoices-${suffix}` }).returning();
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
    .values({ tenantId, name: "Order Invoices Test User", username: `order-invoices-${suffix}`, passwordHash })
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

async function deleteOrderTreeForRetailer(retailerId: string) {
  const orderRows = await db.query.orders.findMany({ where: (o, { eq: eqOp }) => eqOp(o.retailerId, retailerId) });
  for (const order of orderRows) {
    await db.execute(sql`delete from order_invoice_lines where order_invoice_id in (select id from order_invoices where order_id = ${order.id})`);
    await db.execute(sql`delete from order_invoices where order_id = ${order.id}`);
    await db.execute(sql`delete from retailer_invoice_orders where order_id = ${order.id}`);

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
}

async function postJson(baseUrl: string, path: string, token: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function putJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
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

async function createCustomer(baseUrl: string, ctx: Ctx, retailerId: string): Promise<{ id: string; name: string }> {
  const firstName = `Customer ${randomUUID()}`;
  const res = await postJson(baseUrl, "/api/customers", ctx.token, { retailerId, firstName, lastName: "Tester" });
  const body = (await res.json()) as { data: { id: string } };
  return { id: body.data.id, name: `${firstName} Tester` };
}

/** Unlike `orders.routes.test.ts`'s `createChoiceFeatureWithStyle`, this one flags `isAdditional: true` — the flag `orderInvoices.service.ts#buildDraftLines` uses to decide whether a selected style gets its own priced sub-line on the invoice draft. */
async function createAdditionalChoiceFeatureWithStyle(baseUrl: string, ctx: Ctx, productId: string) {
  const featureRes = await postJson(baseUrl, "/api/features", ctx.token, {
    name: `Monogram ${randomUUID()}`,
    type: "choice",
    productIds: [productId],
    isAdditional: true,
  });
  const feature = (await featureRes.json()) as { data: { id: string; name: string } };

  const createStyleRes = await fetch(`${baseUrl}/api/features/${feature.data.id}/styles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({ name: "Classic Script" }),
  });
  const style = (await createStyleRes.json()) as { data: { id: string; name: string } };

  return { featureId: feature.data.id, featureName: feature.data.name, styleId: style.data.id, styleName: style.data.name };
}

async function fetchPdfBuffer(baseUrl: string, pdfUrl: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  const absoluteUrl = /^https?:\/\//i.test(pdfUrl) ? pdfUrl : `${baseUrl}${pdfUrl}`;
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error(`Failed to fetch generated PDF at ${absoluteUrl}: ${res.status}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") };
}

function pdfUrlToLocalKey(pdfUrl: string): string {
  return pdfUrl.startsWith(`${LOCAL_STATIC_URL_PREFIX}/`) ? pdfUrl.slice(LOCAL_STATIC_URL_PREFIX.length + 1) : pdfUrl;
}

describe("Order invoicing (order_invoices + retailer_invoices orderIds)", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let noInvoiceAccess: Awaited<ReturnType<typeof createUserInTenant>>;

  let retailer: Awaited<ReturnType<typeof createRetailer>>;
  let customer: { id: string; name: string };

  let jacketId: string;
  let onePiece: { id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> };
  let additional: { featureId: string; featureName: string; styleId: string; styleName: string };

  let orderId: string;
  let orderNumber: string;
  let retailerInvoiceId: string;

  const generatedPdfKeys: string[] = [];

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
      "invoices.manage",
      "invoices.view",
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.features.manage",
      "customers.manage",
    ]);
    noInvoiceAccess = await createUserInTenant(owner.tenantId, ["orders.create", "orders.view"]);

    retailer = await createRetailer(owner.tenantId);
    customer = await createCustomer(baseUrl, owner, retailer.id);

    jacketId = await createProduct(baseUrl, owner, "Jacket");
    onePiece = await createSuperProduct(baseUrl, owner, "Invoice Jacket Only", [{ productId: jacketId, slotLabel: "Jacket" }]);
    additional = await createAdditionalChoiceFeatureWithStyle(baseUrl, owner, jacketId);

    const orderRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId: customer.id,
      items: [
        {
          superProductId: onePiece.id,
          components: [
            {
              superProductComponentId: onePiece.components[0]!.id,
              features: [{ featureId: additional.featureId, styleId: additional.styleId }],
            },
          ],
        },
      ],
    });
    expect(orderRes.status).toBe(201);
    const orderBody = (await orderRes.json()) as { data: { id: string; orderNumber: string } };
    orderId = orderBody.data.id;
    orderNumber = orderBody.data.orderNumber;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePdfBrowser();

    for (const key of generatedPdfKeys) {
      await fsp.rm(path.join(localStorageRootDir, key), { force: true });
    }

    if (retailerInvoiceId) {
      await db.delete(retailerInvoiceOrders).where(eq(retailerInvoiceOrders.retailerInvoiceId, retailerInvoiceId));
      await db.delete(retailerInvoices).where(eq(retailerInvoices.id, retailerInvoiceId));
    }
    await deleteOrderTreeForRetailer(retailer.id);
    await db.execute(
      sql`delete from customer_measurement_profile_values where profile_id in (select id from customer_measurement_profiles where customer_id in (select id from customers where retailer_id = ${retailer.id}))`
    );
    await db.execute(sql`delete from customer_measurement_profiles where customer_id in (select id from customers where retailer_id = ${retailer.id})`);
    await db.execute(sql`delete from customers where retailer_id = ${retailer.id}`);
    await db.execute(sql`delete from retailers where id = ${retailer.id}`);

    await noInvoiceAccess.cleanup();
    await owner.cleanup();
  }, 30000);

  it("computes an unsaved draft with exactly one unit line per component, priced at 0 — never auto-generating a line for the order's selected additional feature", async () => {
    const res = await getJson(baseUrl, `/api/orders/${orderId}/invoice`, owner.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: string | null; isDraft: boolean; total: string; lines: Array<{ kind: string; groupLabel: string; label: string; price: string }> };
    };

    expect(body.data.id).toBeNull();
    expect(body.data.isDraft).toBe(true);
    // Just the one "unit" line for the order's single Jacket component — real feedback was
    // that auto-generating a priced sub-line per selected additional feature (button, chest
    // pocket, hand stitching, ...) was noise, not useful default pricing. The order still has
    // `additional`'s feature/style selected (set up in `beforeAll`) specifically to prove that
    // selection alone doesn't leak into the invoice draft.
    expect(body.data.lines).toHaveLength(1);
    expect(body.data.lines.every((l) => l.kind === "unit")).toBe(true);
    expect(body.data.lines.some((l) => l.label.includes(additional.featureName))).toBe(false);

    const unitLine = body.data.lines[0];
    expect(unitLine?.groupLabel).toContain("Jacket");
    expect(unitLine?.price).toBe("0.00");
  });

  it("saves priced lines (base unit price + a manually-added charge) with a server-computed total, and re-fetching returns the saved (not re-derived) invoice", async () => {
    const draftRes = await getJson(baseUrl, `/api/orders/${orderId}/invoice`, owner.token);
    const draft = (await draftRes.json()) as { data: { lines: Array<{ groupLabel: string; kind: string; label: string }> } };

    const saveRes = await putJson(baseUrl, `/api/orders/${orderId}/invoice`, owner.token, {
      lines: [
        ...draft.data.lines.map((line) => ({ ...line, price: 100 })),
        { groupLabel: "Additional Charge", kind: "charge", label: "Rush fee", price: 15 },
      ],
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { data: { id: string; isDraft: boolean; total: string; lines: unknown[] } };
    expect(saved.data.isDraft).toBe(false);
    expect(saved.data.id).toBeTruthy();
    // 100 (unit) + 15 (manually-added charge) = 115.00
    expect(saved.data.total).toBe("115.00");
    expect(saved.data.lines).toHaveLength(2);

    const reGetRes = await getJson(baseUrl, `/api/orders/${orderId}/invoice`, owner.token);
    const reGet = (await reGetRes.json()) as { data: { isDraft: boolean; total: string; id: string } };
    expect(reGet.data.isDraft).toBe(false);
    expect(reGet.data.total).toBe("115.00");
    expect(reGet.data.id).toBe(saved.data.id);
  });

  it("lists the priced order under GET /retailers/:id/invoiceable-orders", async () => {
    const res = await getJson(baseUrl, `/api/retailers/${retailer.id}/invoiceable-orders`, owner.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; orderNumber: string; total: string | null; customerName: string }> };
    const row = body.data.find((o) => o.id === orderId);
    expect(row).toBeDefined();
    expect(row?.total).toBe("115.00");
    expect(row?.orderNumber).toBe(orderNumber);
  });

  it("creates a grouped invoice from orderIds — one auto-built line item sourced from the order's own saved total — and drops the order out of the invoiceable list", async () => {
    const res = await postJson(baseUrl, "/api/invoices", owner.token, { retailerId: retailer.id, orderIds: [orderId] });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { id: string; total: string; lineItems: Array<{ description: string; unitPrice: number; amount: string }> };
    };
    retailerInvoiceId = body.data.id;

    expect(body.data.lineItems).toHaveLength(1);
    expect(body.data.lineItems[0]?.unitPrice).toBe(115);
    expect(body.data.lineItems[0]?.amount).toBe("115.00");
    expect(body.data.total).toBe("115.00");
    expect(body.data.lineItems[0]?.description).toContain(orderNumber);

    const invoiceableRes = await getJson(baseUrl, `/api/retailers/${retailer.id}/invoiceable-orders`, owner.token);
    const invoiceable = (await invoiceableRes.json()) as { data: Array<{ id: string }> };
    expect(invoiceable.data.map((o) => o.id)).not.toContain(orderId);
  });

  it("rejects bundling an order that's already included in another invoice", async () => {
    const res = await postJson(baseUrl, "/api/invoices", owner.token, { retailerId: retailer.id, orderIds: [orderId] });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ORDER_ALREADY_INVOICED");
  });

  it("rejects bundling an order with no saved invoice yet", async () => {
    const secondOrderRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId: customer.id,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    const secondOrder = (await secondOrderRes.json()) as { data: { id: string } };

    const res = await postJson(baseUrl, "/api/invoices", owner.token, { retailerId: retailer.id, orderIds: [secondOrder.data.id] });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ORDER_INVOICE_MISSING");
  });

  it("rejects providing both lineItems and orderIds, or neither", async () => {
    const bothRes = await postJson(baseUrl, "/api/invoices", owner.token, {
      retailerId: retailer.id,
      orderIds: [orderId],
      lineItems: [{ description: "X", quantity: 1, unitPrice: 1 }],
    });
    expect(bothRes.status).toBe(400);

    const neitherRes = await postJson(baseUrl, "/api/invoices", owner.token, { retailerId: retailer.id });
    expect(neitherRes.status).toBe(400);
  });

  it("shows the bundled order under GET /invoices/:id/orders", async () => {
    const res = await getJson(baseUrl, `/api/invoices/${retailerInvoiceId}/orders`, owner.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; orderNumber: string; customerName: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.orderNumber).toBe(orderNumber);
    expect(body.data[0]?.customerName.toLowerCase()).toContain("tester");
  });

  it("generates a real, fetchable PDF for the order's own invoice", async () => {
    const res = await postJson(baseUrl, `/api/orders/${orderId}/invoice/pdf`, owner.token);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { path: string } };
    expect(body.data.path).toBeTruthy();
    generatedPdfKeys.push(pdfUrlToLocalKey(body.data.path));

    const { buffer, contentType } = await fetchPdfBuffer(baseUrl, body.data.path);
    expect(contentType).toContain("pdf");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");

    const stored = await db.query.orderInvoices.findFirst({ where: eq(orderInvoices.orderId, orderId) });
    expect(stored?.pdfPath).toBe(body.data.path);
  }, 20000);

  it("generates a real, fetchable PDF for the grouped retailer invoice", async () => {
    const res = await postJson(baseUrl, `/api/invoices/${retailerInvoiceId}/pdf`, owner.token);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { path: string } };
    expect(body.data.path).toBeTruthy();
    generatedPdfKeys.push(pdfUrlToLocalKey(body.data.path));

    const { buffer, contentType } = await fetchPdfBuffer(baseUrl, body.data.path);
    expect(contentType).toContain("pdf");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");

    const stored = await db.query.retailerInvoices.findFirst({ where: eq(retailerInvoices.id, retailerInvoiceId) });
    expect(stored?.pdfPath).toBe(body.data.path);
  }, 20000);

  it("gates the per-order invoice draft/save/pdf endpoints behind invoices.manage — orders.create/view alone isn't enough", async () => {
    const getRes = await getJson(baseUrl, `/api/orders/${orderId}/invoice`, noInvoiceAccess.token);
    expect(getRes.status).toBe(403);

    const putRes = await putJson(baseUrl, `/api/orders/${orderId}/invoice`, noInvoiceAccess.token, {
      lines: [{ groupLabel: "X", kind: "charge", label: "X", price: 1 }],
    });
    expect(putRes.status).toBe(403);

    const pdfRes = await postJson(baseUrl, `/api/orders/${orderId}/invoice/pdf`, noInvoiceAccess.token);
    expect(pdfRes.status).toBe(403);
  });
});
