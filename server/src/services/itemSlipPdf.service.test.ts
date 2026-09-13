import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/index";
import {
  tenants,
  retailers,
  customers,
  products,
  superProducts,
  superProductComponents,
  orders,
  orderItems,
  orderItemComponents,
} from "../db/schema/index";
import { createOrder } from "./orders.service";
import { generateItemSlipPdf, resolveItemSlipData } from "./itemSlipPdf.service";
import { closePdfBrowser, titleCase } from "./pdfRenderer";
import { localStorageRootDir, LOCAL_STATIC_URL_PREFIX } from "./storage.service";

const suffix = randomUUID();

function pdfUrlToLocalPath(url: string): string {
  const prefix = `${LOCAL_STATIC_URL_PREFIX}/`;
  const key = url.slice(url.indexOf(prefix) + prefix.length);
  return path.join(localStorageRootDir, key);
}

/** Same regex-on-raw-PDF-bytes technique `orderPdf.fidelity.test.ts`'s `firstMediaBoxIsLandscape` uses — converts the `/MediaBox` (in points) to mm. */
function firstMediaBoxSizeMm(buffer: Buffer): { widthMm: number; heightMm: number } {
  const text = buffer.toString("latin1");
  const match = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
  if (!match) throw new Error("No /MediaBox found in PDF");
  const [, x0, y0, x1, y1] = match.map(Number) as unknown as [number, number, number, number, number];
  const ptToMm = 25.4 / 72;
  return { widthMm: Math.abs(x1! - x0!) * ptToMm, heightMm: Math.abs(y1! - y0!) * ptToMm };
}

describe("itemSlipPdf.service", () => {
  let tenantId: string;
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

    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name: `Slip Test Retailer ${suffix}`, code: `SLIP-${suffix.slice(0, 6)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const [customer] = await db.insert(customers).values({ tenantId, retailerId, firstName: "Slip Test Customer" }).returning();
    if (!customer) throw new Error("Failed to create test customer");
    customerId = customer.id;

    const [product] = await db.insert(products).values({ tenantId, name: `SlipTestProduct-${suffix}` }).returning();
    if (!product) throw new Error("Failed to create test product");
    productId = product.id;

    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `SlipTestSuper-${suffix}` }).returning();
    if (!superProduct) throw new Error("Failed to create test super product");
    superProductId = superProduct.id;

    const [component] = await db
      .insert(superProductComponents)
      .values({ superProductId, productId, slotLabel: "Main", sequence: 1 })
      .returning();
    if (!component) throw new Error("Failed to create test super product component");
    superProductComponentId = component.id;
  });

  afterAll(async () => {
    await closePdfBrowser();

    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    await db.delete(superProductComponents).where(eq(superProductComponents.id, superProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, superProductId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailerId));
  });

  it("computes itemNumber/itemQuantity across multiple order items of the same product, in order-item sequence", async () => {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [
        { superProductId, components: [{ superProductComponentId }] },
        { superProductId, components: [{ superProductComponentId }] },
        { superProductId, components: [{ superProductComponentId }] },
      ],
    });
    orderIds.push(order.id);
    const orderedComponentIds = order.items.map((item) => item.components[0]!.id);
    componentIds.push(...orderedComponentIds);

    const expectedItemName = titleCase(`SlipTestSuper-${suffix}`);

    const first = await resolveItemSlipData(tenantId, orderedComponentIds[0]!);
    expect(first.itemText).toBe(`1 / 3 ${expectedItemName}`);
    expect(first.orderNumber).toBe(order.orderNumber);
    expect(first.customerName).toBe("Slip Test Customer");
    expect(first.orderId).toBe(order.id);

    const second = await resolveItemSlipData(tenantId, orderedComponentIds[1]!);
    expect(second.itemText).toBe(`2 / 3 ${expectedItemName}`);

    const third = await resolveItemSlipData(tenantId, orderedComponentIds[2]!);
    expect(third.itemText).toBe(`3 / 3 ${expectedItemName}`);
  });

  it("uses the super product's own name, not each component's individual product name, for a multi-component bundle", async () => {
    const [jacketProduct] = await db.insert(products).values({ tenantId, name: `SlipTestJacket-${suffix}` }).returning();
    const [pantProduct] = await db.insert(products).values({ tenantId, name: `SlipTestPant-${suffix}` }).returning();
    if (!jacketProduct || !pantProduct) throw new Error("Failed to create test jacket/pant products");

    const [bundleSuperProduct] = await db.insert(superProducts).values({ tenantId, name: `SlipTestThreePiece-${suffix}` }).returning();
    if (!bundleSuperProduct) throw new Error("Failed to create test bundle super product");

    const [jacketComponent] = await db
      .insert(superProductComponents)
      .values({ superProductId: bundleSuperProduct.id, productId: jacketProduct.id, slotLabel: "Jacket", sequence: 1 })
      .returning();
    const [pantComponent] = await db
      .insert(superProductComponents)
      .values({ superProductId: bundleSuperProduct.id, productId: pantProduct.id, slotLabel: "Pant", sequence: 2 })
      .returning();
    if (!jacketComponent || !pantComponent) throw new Error("Failed to create test jacket/pant super product components");

    let order: Awaited<ReturnType<typeof createOrder>> | null = null;
    try {
      order = await createOrder(tenantId, {
        retailerId,
        customerId,
        items: [
          {
            superProductId: bundleSuperProduct.id,
            components: [{ superProductComponentId: jacketComponent.id }, { superProductComponentId: pantComponent.id }],
          },
        ],
      });
      const orderedComponentIds = order.items[0]!.components.map((c) => c.id);

      const expectedItemName = titleCase(`SlipTestThreePiece-${suffix}`);

      const jacketSlip = await resolveItemSlipData(tenantId, orderedComponentIds[0]!);
      expect(jacketSlip.itemText).toBe(`1 / 1 ${expectedItemName}`);

      const pantSlip = await resolveItemSlipData(tenantId, orderedComponentIds[1]!);
      expect(pantSlip.itemText).toBe(`1 / 1 ${expectedItemName}`);
    } finally {
      // Local, fully self-contained cleanup (not the shared `orderIds`/`componentIds`
      // arrays the outer `afterAll` drains) — this order references its own throwaway
      // jacket/pant products, which must be deleted here too, so the delete order has to
      // go order-rows-first, products-last, same FK-dependency order as the outer `afterAll`.
      if (order) {
        await db.delete(orderItemComponents).where(eq(orderItemComponents.orderItemId, order.items[0]!.id));
        await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
        await db.delete(orders).where(eq(orders.id, order.id));
      }
      await db.delete(superProductComponents).where(inArray(superProductComponents.id, [jacketComponent.id, pantComponent.id]));
      await db.delete(superProducts).where(eq(superProducts.id, bundleSuperProduct.id));
      await db.delete(products).where(inArray(products.id, [jacketProduct.id, pantProduct.id]));
    }
  });

  it("404s cleanly for a bogus componentId", async () => {
    await expect(resolveItemSlipData(tenantId, randomUUID())).rejects.toMatchObject({ status: 404, code: "COMPONENT_NOT_FOUND" });
  });

  it(
    "generateItemSlipPdf renders a real 107x35mm PDF and returns the resolved orderId",
    async () => {
      const order = await createOrder(tenantId, {
        retailerId,
        customerId,
        items: [{ superProductId, components: [{ superProductComponentId }] }],
      });
      orderIds.push(order.id);
      const componentId = order.items[0]!.components[0]!.id;
      componentIds.push(componentId);

      const { url, orderId } = await generateItemSlipPdf(tenantId, componentId);
      expect(orderId).toBe(order.id);
      expect(typeof url).toBe("string");

      const buffer = await readFile(pdfUrlToLocalPath(url));
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
      const size = firstMediaBoxSizeMm(buffer);
      expect(size.widthMm).toBeCloseTo(107, 0);
      expect(size.heightMm).toBeCloseTo(35, 0);
    },
    30000
  );
});
