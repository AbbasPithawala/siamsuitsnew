import type { Server } from "node:http";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { features, retailers } from "../src/db/schema/index";
import { buildOrderPdfHtml, closePdfBrowser } from "../src/services/orderPdf.service";
import { LOCAL_STATIC_URL_PREFIX, localStorageRootDir } from "../src/services/storage.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

/** See `orderPdf.routes.test.ts`'s identical helpers' doc comment: `generateOrderPdf` returns a real URL now, not a filesystem path. */
async function fetchPdfBuffer(baseUrl: string, pdfUrl: string): Promise<Buffer> {
  const absoluteUrl = /^https?:\/\//i.test(pdfUrl) ? pdfUrl : `${baseUrl}${pdfUrl}`;
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error(`Failed to fetch generated PDF at ${absoluteUrl}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function pdfUrlToLocalKey(pdfUrl: string): string {
  return pdfUrl.startsWith(`${LOCAL_STATIC_URL_PREFIX}/`) ? pdfUrl.slice(LOCAL_STATIC_URL_PREFIX.length + 1) : pdfUrl;
}

interface Ctx {
  token: string;
}

async function createRetailer(tenantId: string) {
  const suffix = randomUUID();
  const [retailer] = await db
    .insert(retailers)
    .values({ tenantId, name: `Fidelity Test Retailer ${suffix}`, code: `FD${suffix.slice(0, 6).toUpperCase()}` })
    .returning();
  if (!retailer) throw new Error("Failed to create test retailer");
  return retailer;
}

async function postJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function patchJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function putJson(baseUrl: string, path: string, token: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
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

async function createCustomer(baseUrl: string, ctx: Ctx, retailerId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await postJson(baseUrl, "/api/customers", ctx.token, {
    retailerId,
    firstName: `Customer ${randomUUID()}`,
    lastName: "Tester",
    gender: "Male",
    ...extra,
  });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createMeasurementDefinition(baseUrl: string, ctx: Ctx, name: string): Promise<string> {
  const suffix = randomUUID();
  const res = await postJson(baseUrl, "/api/measurement-definitions", ctx.token, { name: `${name} ${suffix}`, slug: `${name.toLowerCase()}-${suffix}` });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createTextFeature(baseUrl: string, ctx: Ctx, name: string, productId: string): Promise<string> {
  const res = await postJson(baseUrl, "/api/features", ctx.token, { name: `${name} ${randomUUID()}`, type: "text", productIds: [productId] });
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createChoiceFeatureWithStyle(baseUrl: string, ctx: Ctx, productId: string, featureName: string, styleName: string) {
  const featureRes = await postJson(baseUrl, "/api/features", ctx.token, { name: `${featureName} ${randomUUID()}`, type: "choice", productIds: [productId] });
  const feature = (await featureRes.json()) as { data: { id: string } };

  const createStyleRes = await postJson(baseUrl, `/api/features/${feature.data.id}/styles`, ctx.token, { name: styleName });
  const style = (await createStyleRes.json()) as { data: { id: string } };

  return { featureId: feature.data.id, styleId: style.data.id };
}

/**
 * `render_slot` isn't settable through the public `/api/features` create schema (only the
 * one-time catalog seed writes it, `db/seed/catalog-render-slots.ts`) — this test needs a
 * real render-slot feature to exist, so it inserts directly, mirroring that seed script's
 * own shape, then links it to the product and adds a style through the real API exactly
 * like an admin would for a normal feature.
 */
async function createRenderSlotFeature(
  baseUrl: string,
  ctx: Ctx,
  tenantId: string,
  name: string,
  renderSlot: "shoulder_type" | "monogram_position",
  productId: string,
  styleNames: { name: string; image?: string }[]
) {
  const [feature] = await db
    .insert(features)
    .values({ tenantId, name: `${name} ${randomUUID()}`, type: "choice", renderSlot, isRequired: false })
    .returning();
  if (!feature) throw new Error("Failed to create render-slot feature");

  await putJson(baseUrl, `/api/features/${feature.id}/products`, ctx.token, { productIds: [productId] });

  const styleIds: Record<string, string> = {};
  for (const style of styleNames) {
    const res = await postJson(baseUrl, `/api/features/${feature.id}/styles`, ctx.token, { name: style.name, ...(style.image ? { image: style.image } : {}) });
    const body = (await res.json()) as { data: { id: string } };
    styleIds[style.name] = body.data.id;
  }

  return { featureId: feature.id, styleIds };
}

async function createStructuredFeature(baseUrl: string, ctx: Ctx, tenantId: string, name: string, productId: string): Promise<string> {
  const [feature] = await db
    .insert(features)
    .values({ tenantId, name: `${name} ${randomUUID()}`, type: "structured", isRequired: false })
    .returning();
  if (!feature) throw new Error("Failed to create structured feature");
  await putJson(baseUrl, `/api/features/${feature.id}/products`, ctx.token, { productIds: [productId] });
  return feature.id;
}

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
}

function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g) ?? [];
  return matches.length;
}

function firstMediaBoxIsLandscape(buffer: Buffer): boolean {
  const text = buffer.toString("latin1");
  const match = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
  if (!match) return false;
  const [, x0, y0, x1, y1] = match.map(Number) as unknown as [number, number, number, number, number];
  const width = Math.abs(x1! - x0!);
  const height = Math.abs(y1! - y0!);
  return width > height;
}

describe("Order PDF fidelity — old order / group order / changed-from-profile + two-tier layout (PHASE_10_TASKS.md Workstream B Groups 1-2)", () => {
  let server: Server;
  let baseUrl: string;

  let owner: Awaited<ReturnType<typeof createTenantWithUser>>;
  let retailer: Awaited<ReturnType<typeof createRetailer>>;

  let jacketId: string;
  let onePiece: { id: string; components: Array<{ id: string; productId: string; slotLabel: string; sequence: number }> };
  let chestDefId: string;

  let fabricFeatureId: string;
  let liningFeatureId: string;
  let lapel: { featureId: string; styleId: string };
  let shoulder: { featureId: string; styleIds: Record<string, string> };
  let monogramPosition: { featureId: string; styleIds: Record<string, string> };
  let monogramFeatureId: string;

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
      "orders.edit",
      "orders.rush",
      "orders.repeat",
      "orders.group.create",
      "catalog.products.manage",
      "catalog.super_products.manage",
      "catalog.measurements.manage",
      "catalog.features.manage",
      "customers.manage",
      "retailers.manage",
    ]);

    retailer = await createRetailer(owner.tenantId);
    await patchJson(baseUrl, `/api/retailers/${retailer.id}`, owner.token, { logo: "https://example.com/retailer-logo.png" });

    jacketId = await createProduct(baseUrl, owner, "Jacket");
    onePiece = await createSuperProduct(baseUrl, owner, "Fidelity Jacket Only", [{ productId: jacketId, slotLabel: "Jacket" }]);
    chestDefId = await createMeasurementDefinition(baseUrl, owner, "Chest");

    fabricFeatureId = await createTextFeature(baseUrl, owner, "Fabric", jacketId);
    liningFeatureId = await createTextFeature(baseUrl, owner, "Lining", jacketId);
    lapel = await createChoiceFeatureWithStyle(baseUrl, owner, jacketId, "Lapel", "Notch");
    shoulder = await createRenderSlotFeature(baseUrl, owner, owner.tenantId, "Shoulder Type", "shoulder_type", jacketId, [
      { name: "Sloping", image: "/ImagesFabric/jacket/sloping.png" },
    ]);
    monogramPosition = await createRenderSlotFeature(baseUrl, owner, owner.tenantId, "Monogram Position", "monogram_position", jacketId, [
      { name: "Left Side" },
      { name: "Right Side" },
    ]);
    monogramFeatureId = await createStructuredFeature(baseUrl, owner, owner.tenantId, "Monogram", jacketId);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePdfBrowser();

    for (const key of generatedPdfKeys) {
      await fsp.rm(path.join(localStorageRootDir, key), { force: true });
    }

    await deleteOrderTreeForRetailer(retailer.id);
    await db.execute(
      sql`delete from customer_measurement_profile_values where profile_id in (select id from customer_measurement_profiles where customer_id in (select id from customers where retailer_id = ${retailer.id}))`
    );
    await db.execute(sql`delete from customer_measurement_profiles where customer_id in (select id from customers where retailer_id = ${retailer.id})`);
    await db.execute(sql`delete from customers where retailer_id = ${retailer.id}`);
    await db.execute(sql`delete from retailers where id = ${retailer.id}`);

    await owner.cleanup();
  }, 30000);

  it("resolves oldOrderNumber to the customer's real prior order, not just 'some other order'", async () => {
    const customerId = await createCustomer(baseUrl, owner, retailer.id);

    const firstRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(firstRes.status).toBe(201);
    const first = (await firstRes.json()) as { data: { id: string; orderNumber: string } };

    // A single order for this customer: no "old" order exists yet.
    const soloPdf = await buildOrderPdfHtml(owner.tenantId, first.data.id);
    expect(soloPdf.oldOrderNumber).toBeNull();

    const secondRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(secondRes.status).toBe(201);
    const second = (await secondRes.json()) as { data: { id: string; orderNumber: string } };

    const secondPdf = await buildOrderPdfHtml(owner.tenantId, second.data.id);
    expect(secondPdf.oldOrderNumber).toBe(first.data.orderNumber);
    // Shown once, as a plain "Old Order:" header row — matches legacy exactly, which never
    // repeats it a second time as a separate colored banner.
    expect(secondPdf.html).toContain('<span class="label">Old Order:</span>');
    expect(secondPdf.html).toContain(first.data.orderNumber);

    // The first order's own PDF still has no "old order" — it's the earliest for this customer.
    const firstPdfAgain = await buildOrderPdfHtml(owner.tenantId, first.data.id);
    expect(firstPdfAgain.oldOrderNumber).toBeNull();
  });

  it("resolves groupOrderNumber for a real group order's child order, and null for a normal order", async () => {
    const customerId = await createCustomer(baseUrl, owner, retailer.id);

    const groupRes = await postJson(baseUrl, "/api/order-groups", owner.token, {
      retailerId: retailer.id,
      orders: [
        {
          customerId,
          items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
        },
      ],
    });
    expect(groupRes.status).toBe(201);
    const group = (await groupRes.json()) as { data: { orderNumber: string; orders: Array<{ id: string; type: string }> } };
    const childOrderId = group.data.orders[0]!.id;
    expect(group.data.orders[0]!.type).toBe("group");

    const childPdf = await buildOrderPdfHtml(owner.tenantId, childOrderId);
    expect(childPdf.groupOrderNumber).toBe(group.data.orderNumber);
    // Shown once, inside the order-info-box (alongside order number/type) — matches legacy
    // exactly, which never repeats it a second time as a separate colored banner.
    expect(childPdf.html).toContain('class="order-info-box"');
    expect(childPdf.html).toContain(group.data.orderNumber);

    const normalRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    const normal = (await normalRes.json()) as { data: { id: string } };
    const normalPdf = await buildOrderPdfHtml(owner.tenantId, normal.data.id);
    expect(normalPdf.groupOrderNumber).toBeNull();
    expect(normalPdf.html).not.toContain(group.data.orderNumber);
  });

  it("renders a 'Modified on: <date>' banner once orders.last_modified_at is stamped, and never before", async () => {
    const customerId = await createCustomer(baseUrl, owner, retailer.id);

    const createRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };

    // A freshly-created order has never been edited — no banner yet.
    const freshPdf = await buildOrderPdfHtml(owner.tenantId, created.data.id);
    expect(freshPdf.html).not.toContain('class="banner banner-modified"');

    const statusRes = await patchJson(baseUrl, `/api/orders/${created.data.id}/status`, owner.token, { status: "Modified" });
    expect(statusRes.status).toBe(200);

    const modifiedPdf = await buildOrderPdfHtml(owner.tenantId, created.data.id);
    expect(modifiedPdf.html).toContain('class="banner banner-modified"');
    expect(modifiedPdf.html).toContain("Modified on :");
  });

  it("renders the Manual Size image once orders.edit sets order_item_components.manual_size_image, and never before", async () => {
    const customerId = await createCustomer(baseUrl, owner, retailer.id);

    const createRes = await postJson(baseUrl, "/api/orders", owner.token, {
      retailerId: retailer.id,
      customerId,
      items: [{ superProductId: onePiece.id, components: [{ superProductComponentId: onePiece.components[0]!.id }] }],
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { id: string; items: Array<{ id: string; components: Array<{ id: string }> }> };
    };

    // Never edited yet — no Manual Size image set. Negative assertion targets the actual
    // rendered `<div>`, not the bare substring — the stylesheet's own `.manual-size-image
    // img { ... }` rule contains that substring on every page regardless of whether the
    // element itself is ever rendered.
    const freshPdf = await buildOrderPdfHtml(owner.tenantId, created.data.id);
    expect(freshPdf.html).not.toContain('class="manual-size-image"');

    const editRes = await patchJson(baseUrl, `/api/orders/${created.data.id}`, owner.token, {
      items: [
        {
          id: created.data.items[0]!.id,
          superProductId: onePiece.id,
          components: [
            {
              id: created.data.items[0]!.components[0]!.id,
              superProductComponentId: onePiece.components[0]!.id,
              manualSizeImage: "https://example.com/manual-size.png",
            },
          ],
        },
      ],
    });
    expect(editRes.status).toBe(200);

    const editedPdf = await buildOrderPdfHtml(owner.tenantId, created.data.id);
    expect(editedPdf.html).toContain('class="manual-size-image"');
    expect(editedPdf.html).toContain("https://example.com/manual-size.png");
  });

  it(
    "a real order with rush + repeat + reference image + monogram + a render-slot feature + a measurement that " +
      "differs from the customer's profile renders every Group 2 element in the generated HTML, and a real " +
      "Puppeteer PDF opens, is landscape, and has multiple pages",
    async () => {
      const customerId = await createCustomer(baseUrl, owner, retailer.id, { image: "https://example.com/customer-image.png" });

      const baselineRes = await postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: retailer.id,
        customerId,
        items: [
          {
            superProductId: onePiece.id,
            components: [
              {
                superProductComponentId: onePiece.components[0]!.id,
                measurements: [{ measurementDefinitionId: chestDefId, value: "40.00" }],
              },
            ],
          },
        ],
      });
      expect(baselineRes.status).toBe(201);
      const baseline = (await baselineRes.json()) as { data: { id: string; orderNumber: string } };

      const orderRes = await postJson(baseUrl, "/api/orders", owner.token, {
        retailerId: retailer.id,
        customerId,
        isRush: true,
        repeatOfOrderId: baseline.data.id,
        items: [
          {
            superProductId: onePiece.id,
            components: [
              {
                superProductComponentId: onePiece.components[0]!.id,
                measurements: [{ measurementDefinitionId: chestDefId, value: "45.00" }],
                features: [
                  { featureId: fabricFeatureId, textValue: "FAB-100" },
                  { featureId: liningFeatureId, textValue: "LIN-200" },
                  { featureId: lapel.featureId, styleId: lapel.styleId },
                  { featureId: shoulder.featureId, styleId: shoulder.styleIds["Sloping"] },
                  { featureId: monogramPosition.featureId, styleId: monogramPosition.styleIds["Left Side"] },
                  { featureId: monogramFeatureId, structuredValue: { text: "ABC", text2: "XYZ", font: "Style-01", color: "1902" } },
                ],
                measurementNote: "Please re-confirm chest at fitting",
                stylingNote: "Extra topstitching on lapel",
                referenceImage: "https://example.com/reference-image.png",
              },
            ],
          },
        ],
      });
      expect(orderRes.status).toBe(201);
      const order = (await orderRes.json()) as {
        data: { id: string; isRush: boolean; isRepeat: boolean; items: Array<{ components: Array<{ id: string; measurements: Array<{ measurementDefinitionId: string; changedFromProfile: boolean | null }> }> }> };
      };
      expect(order.data.isRush).toBe(true);
      expect(order.data.isRepeat).toBe(true);
      const chestMeasurement = order.data.items[0]!.components[0]!.measurements.find((m) => m.measurementDefinitionId === chestDefId);
      expect(chestMeasurement?.changedFromProfile).toBe(true);

      const { html, oldOrderNumber } = await buildOrderPdfHtml(owner.tenantId, order.data.id);
      expect(oldOrderNumber).toBe(baseline.data.orderNumber);

      // Rush/Repeat/Old Order banners.
      expect(html).toContain('class="badge badge-rush"');
      expect(html).toContain('class="badge badge-repeat"');
      expect(html).toContain('<span class="label">Old Order:</span>');
      expect(html).toContain(baseline.data.orderNumber);
      expect(html).not.toContain("badge-modified");

      // Two-tier structure: one summary page, two detail pages per real component
      // (measurements page + monogram/fabric-recap page) — this order has exactly one
      // component, so exactly one of each.
      expect(html).toContain('class="summary-page"');
      expect(html).toContain('class="summary-table"');
      expect((html.match(/class="detail-page measurements-page"/g) ?? []).length).toBe(1);
      expect((html.match(/class="detail-page monogram-page"/g) ?? []).length).toBe(1);
      expect(html).toContain("page-break-before: always");

      // The repeated per-page header (audit item 1's structural fix): the retailer logo and
      // customer name now appear once on the summary page AND once on each of this unit's
      // two detail pages — 3 occurrences total, not 1.
      expect((html.match(/class="retailer-logo"/g) ?? []).length).toBe(3);

      // "X OF Y" unit indicator — one real component out of one total unit in this order.
      expect(html).toContain("1 OF 1");

      // Measurements table with the changed-from-profile checkmark.
      expect(html).toContain('class="changed-check"');

      // Shoulder Type render-slot value, inside the Measurement Note table — value only, no
      // image column (a real reported request: the image added visual noise for no benefit).
      expect(html).toContain('class="measurement-note-table"');
      expect(html).toContain("Sloping");
      expect(html).not.toContain("/ImagesFabric/jacket/sloping.png");

      // Fabric/Lining detail cards (generic, not hardcoded field names — asserted via the
      // real feature names/values submitted above, not a literal "Fabric"/"Lining" string),
      // rendered on both the measurements page and the monogram/fabric-recap page.
      expect((html.match(/class="detail-cards"/g) ?? []).length).toBe(2);
      expect(html).toContain("FAB-100");
      expect(html).toContain("LIN-200");

      // Monogram block: legible field-by-field breakdown, not JSON.stringify.
      expect(html).toContain('class="monogram-block"');
      expect(html).toContain("Left Side");
      expect(html).toContain("Style-01");
      expect(html).toContain("1902");
      expect(html).toContain("ABC");
      expect(html).toContain("XYZ");
      expect(html).not.toContain(JSON.stringify({ text: "ABC", text2: "XYZ", font: "Style-01", color: "1902" }));

      // The ordinary choice feature (Lapel, is_additional=false by default) now renders in
      // the real visual styling icon grid, not a plain text table.
      expect(html).toContain('class="styling-icon-grid"');
      expect(html).toContain('class="icon-card"');
      expect(html).toContain("Notch");

      // measurementNote/stylingNote.
      expect(html).toContain("Please re-confirm chest at fitting");
      expect(html).toContain("Extra topstitching on lapel");
      expect(html).toContain('class="styling-note-box"');

      // Reference image.
      expect(html).toContain('class="detail-page reference-image-page"');
      expect(html).toContain("https://example.com/reference-image.png");

      // Retailer logo, customer gender, final customer-image page.
      expect(html).toContain("https://example.com/retailer-logo.png");
      expect(html).toContain("Male");
      expect(html).toContain('class="customer-image-page"');
      expect(html).toContain("https://example.com/customer-image.png");

      // Manual Size image rendering is covered by its own dedicated test below (Workstream
      // E Group 6) — this order's one component never had one set, nothing to assert here.

      // Real Puppeteer render: opens, landscape, multiple pages (summary + 2 detail pages +
      // reference image + customer image = 5 for this one-component order).
      const pdfRes = await postJson(baseUrl, `/api/orders/${order.data.id}/pdf`, owner.token, {});
      expect(pdfRes.status).toBe(201);
      const pdfBody = (await pdfRes.json()) as { data: { path: string } };
      generatedPdfKeys.push(pdfUrlToLocalKey(pdfBody.data.path));

      const buffer = await fetchPdfBuffer(baseUrl, pdfBody.data.path);
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
      expect(firstMediaBoxIsLandscape(buffer)).toBe(true);
      expect(countPdfPages(buffer)).toBeGreaterThanOrEqual(5);
    },
    30000
  );
});
