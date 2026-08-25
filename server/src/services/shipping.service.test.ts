import { randomUUID } from "node:crypto";
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
  processes,
  productProcesses,
  tailors,
  tailorProcesses,
  orders,
  orderItems,
  orderItemComponents,
  manufacturingSteps,
  jobs,
  shippingBoxes,
  shippingBoxItems,
} from "../db/schema/index";
import { hashPassword } from "./auth.service";
import { createOrder } from "./orders.service";
import { assignNextStep, completeStep } from "./manufacturing.service";
import {
  createShippingBox,
  listShippingBoxes,
  getShippingBox,
  addItemToBox,
  removeItemFromBox,
  closeShippingBox,
} from "./shipping.service";
import { HttpError } from "../utils/http-error";

const suffix = randomUUID();

describe("shipping.service", () => {
  let tenantId: string;
  let otherTenantId: string;
  let retailerId: string;
  let otherTenantRetailerId: string;
  let customerId: string;
  let productId: string;
  let superProductId: string;
  let superProductComponentId: string;
  let processAId: string;
  let processBId: string;
  let tailorlessProductId: string;
  let tailorlessSuperProductId: string;
  let tailorlessSuperProductComponentId: string;

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const boxIds: string[] = [];
  const tailorIds: string[] = [];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const [otherTenant] = await db
      .insert(tenants)
      .values({ name: `Shipping Test Other Tenant ${suffix}`, slug: `shipping-other-${suffix.slice(0, 8)}` })
      .returning();
    if (!otherTenant) throw new Error("Failed to create second test tenant");
    otherTenantId = otherTenant.id;

    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name: `Ship Test Retailer ${suffix}`, code: `SHIPT-${suffix.slice(0, 8)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    // Deliberately reuses the same retailer `code` as the primary tenant's retailer —
    // `retailers.code` is only unique per-tenant, so two tenants picking the same code is
    // a real scenario `generateTrackingCode`'s collision handling must survive.
    const [otherRetailer] = await db
      .insert(retailers)
      .values({ tenantId: otherTenantId, name: `Ship Other Tenant Retailer ${suffix}`, code: `SHIPT-${suffix.slice(0, 8)}` })
      .returning();
    if (!otherRetailer) throw new Error("Failed to create other-tenant test retailer");
    otherTenantRetailerId = otherRetailer.id;

    const [customer] = await db.insert(customers).values({ tenantId, retailerId, firstName: "Ship Test Customer" }).returning();
    if (!customer) throw new Error("Failed to create test customer");
    customerId = customer.id;

    const [processA] = await db.insert(processes).values({ tenantId, name: `Ship-Stitching-${suffix}`, price: "100.00" }).returning();
    const [processB] = await db.insert(processes).values({ tenantId, name: `Ship-Cutting-${suffix}`, price: "50.00" }).returning();
    if (!processA || !processB) throw new Error("Failed to create test processes");
    processAId = processA.id;
    processBId = processB.id;

    const [product] = await db.insert(products).values({ tenantId, name: `ShipTestProduct-${suffix}` }).returning();
    if (!product) throw new Error("Failed to create test product");
    productId = product.id;

    await db.insert(productProcesses).values([
      { productId, processId: processAId, sequenceOrder: 1 },
      { productId, processId: processBId, sequenceOrder: 2 },
    ]);

    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `ShipTestSuper-${suffix}` }).returning();
    if (!superProduct) throw new Error("Failed to create test super product");
    superProductId = superProduct.id;

    const [component] = await db
      .insert(superProductComponents)
      .values({ superProductId, productId, slotLabel: "Main", sequence: 1 })
      .returning();
    if (!component) throw new Error("Failed to create test super product component");
    superProductComponentId = component.id;

    // A product with no product_processes at all, so its components get zero
    // manufacturing_steps — exercises the "nothing to complete" allowed-through path.
    const [tailorlessProduct] = await db.insert(products).values({ tenantId, name: `ShipNoStepsProduct-${suffix}` }).returning();
    if (!tailorlessProduct) throw new Error("Failed to create no-steps test product");
    tailorlessProductId = tailorlessProduct.id;

    const [tailorlessSuperProduct] = await db.insert(superProducts).values({ tenantId, name: `ShipNoStepsSuper-${suffix}` }).returning();
    if (!tailorlessSuperProduct) throw new Error("Failed to create no-steps test super product");
    tailorlessSuperProductId = tailorlessSuperProduct.id;

    const [tailorlessComponent] = await db
      .insert(superProductComponents)
      .values({ superProductId: tailorlessSuperProductId, productId: tailorlessProductId, slotLabel: "Main", sequence: 1 })
      .returning();
    if (!tailorlessComponent) throw new Error("Failed to create no-steps test super product component");
    tailorlessSuperProductComponentId = tailorlessComponent.id;
  });

  afterAll(async () => {
    const boxRows = boxIds.length ? await db.query.shippingBoxes.findMany({ where: inArray(shippingBoxes.id, boxIds) }) : [];
    if (boxRows.length) await db.delete(shippingBoxItems).where(inArray(shippingBoxItems.shippingBoxId, boxRows.map((b) => b.id)));
    if (boxIds.length) await db.delete(shippingBoxes).where(inArray(shippingBoxes.id, boxIds));

    const stepRows = componentIds.length
      ? await db.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.orderItemComponentId, componentIds) })
      : [];
    const stepIds = stepRows.map((s) => s.id);
    if (stepIds.length) await db.delete(jobs).where(inArray(jobs.manufacturingStepId, stepIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    if (tailorIds.length) await db.delete(tailorProcesses).where(inArray(tailorProcesses.tailorId, tailorIds));
    if (tailorIds.length) await db.delete(tailors).where(inArray(tailors.id, tailorIds));

    await db.delete(superProductComponents).where(eq(superProductComponents.id, superProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, superProductId));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(processes).where(inArray(processes.id, [processAId, processBId]));

    await db.delete(superProductComponents).where(eq(superProductComponents.id, tailorlessSuperProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, tailorlessSuperProductId));
    await db.delete(products).where(eq(products.id, tailorlessProductId));

    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(inArray(retailers.id, [retailerId, otherTenantRetailerId]));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  async function createTestOrderComponent(superProductIdToUse: string, superProductComponentIdToUse: string) {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [{ superProductId: superProductIdToUse, components: [{ superProductComponentId: superProductComponentIdToUse }] }],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);
    return componentId;
  }

  it("creates a shipping box with a generated tracking code", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);

    expect(box.retailerId).toBe(retailerId);
    expect(box.isClosed).toBe(false);
    expect(box.trackingCode).toContain("SHIP-");
  });

  it("404s creating a box for a bogus retailerId", async () => {
    await expect(createShippingBox(tenantId, { retailerId: randomUUID() })).rejects.toMatchObject({
      status: 404,
      code: "RETAILER_NOT_FOUND",
    });
  });

  it("lists and gets only this tenant's boxes, filterable by retailer", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);

    const { data } = await listShippingBoxes(tenantId, { retailerId });
    expect(data.some((b) => b.id === box.id)).toBe(true);

    const fetched = await getShippingBox(tenantId, box.id);
    expect(fetched.id).toBe(box.id);
    expect(fetched.items).toEqual([]);
  });

  it("404s getting a box that belongs to a different tenant — proving tenant isolation", async () => {
    const otherBox = await createShippingBox(otherTenantId, { retailerId: otherTenantRetailerId });

    try {
      await expect(getShippingBox(tenantId, otherBox.id)).rejects.toMatchObject({
        status: 404,
        code: "SHIPPING_BOX_NOT_FOUND",
      });

      const { data } = await listShippingBoxes(tenantId);
      expect(data.some((b) => b.id === otherBox.id)).toBe(false);
    } finally {
      await db.delete(shippingBoxes).where(eq(shippingBoxes.id, otherBox.id));
    }
  });

  it(
    "rejects packing a component whose manufacturing isn't finished, with MANUFACTURING_INCOMPLETE naming the pending process " +
      "— the acceptance-critical proof the legacy ship-with-incomplete-manufacturing bug is actually fixed",
    async () => {
      const box = await createShippingBox(tenantId, { retailerId });
      boxIds.push(box.id);
      const componentId = await createTestOrderComponent(superProductId, superProductComponentId);

      await expect(addItemToBox(tenantId, box.id, componentId)).rejects.toMatchObject({
        status: 409,
        code: "MANUFACTURING_INCOMPLETE",
      });

      try {
        await addItemToBox(tenantId, box.id, componentId);
        throw new Error("expected addItemToBox to reject");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).message).toContain(`Ship-Stitching-${suffix}`);
      }

      const items = await db.query.shippingBoxItems.findMany({ where: eq(shippingBoxItems.shippingBoxId, box.id) });
      expect(items).toHaveLength(0);
    }
  );

  it("allows packing a component once every manufacturing step is genuinely complete", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);
    const componentId = await createTestOrderComponent(superProductId, superProductComponentId);

    const tailor = await createCertifiedTailor([processAId, processBId]);
    const first = await assignNextStep(tenantId, componentId, tailor.id);
    await completeStep(tenantId, first.job.id);
    const second = await assignNextStep(tenantId, componentId, tailor.id);
    await completeStep(tenantId, second.job.id);

    const item = await addItemToBox(tenantId, box.id, componentId);
    expect(item.orderItemComponentId).toBe(componentId);
    expect(item.shippingBoxId).toBe(box.id);

    const detail = await getShippingBox(tenantId, box.id);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]!.component?.id).toBe(componentId);
  });

  it("allows packing a component whose product has zero manufacturing steps at all", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);
    const componentId = await createTestOrderComponent(tailorlessSuperProductId, tailorlessSuperProductComponentId);

    const item = await addItemToBox(tenantId, box.id, componentId);
    expect(item.orderItemComponentId).toBe(componentId);
  });

  it("rejects a duplicate pack of the same component into the same box", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);
    const componentId = await createTestOrderComponent(tailorlessSuperProductId, tailorlessSuperProductComponentId);

    await addItemToBox(tenantId, box.id, componentId);
    await expect(addItemToBox(tenantId, box.id, componentId)).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_SHIPPING_BOX_ITEM",
    });
  });

  it("404s packing a bogus orderItemComponentId", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);

    await expect(addItemToBox(tenantId, box.id, randomUUID())).rejects.toMatchObject({
      status: 404,
      code: "COMPONENT_NOT_FOUND",
    });
  });

  it("404s packing into a bogus boxId", async () => {
    const componentId = await createTestOrderComponent(tailorlessSuperProductId, tailorlessSuperProductComponentId);

    await expect(addItemToBox(tenantId, randomUUID(), componentId)).rejects.toMatchObject({
      status: 404,
      code: "SHIPPING_BOX_NOT_FOUND",
    });
  });

  it("removes a packed item, then 404s removing it again", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);
    const componentId = await createTestOrderComponent(tailorlessSuperProductId, tailorlessSuperProductComponentId);

    await addItemToBox(tenantId, box.id, componentId);
    await removeItemFromBox(tenantId, box.id, componentId);

    const items = await db.query.shippingBoxItems.findMany({ where: eq(shippingBoxItems.shippingBoxId, box.id) });
    expect(items).toHaveLength(0);

    await expect(removeItemFromBox(tenantId, box.id, componentId)).rejects.toMatchObject({
      status: 404,
      code: "SHIPPING_BOX_ITEM_NOT_FOUND",
    });
  });

  it("closes a box, rejects a second close, and rejects adding/removing items to/from a closed box", async () => {
    const box = await createShippingBox(tenantId, { retailerId });
    boxIds.push(box.id);
    const componentId = await createTestOrderComponent(tailorlessSuperProductId, tailorlessSuperProductComponentId);
    await addItemToBox(tenantId, box.id, componentId);

    const closed = await closeShippingBox(tenantId, box.id);
    expect(closed.isClosed).toBe(true);

    await expect(closeShippingBox(tenantId, box.id)).rejects.toMatchObject({
      status: 409,
      code: "BOX_ALREADY_CLOSED",
    });

    const anotherComponentId = await createTestOrderComponent(tailorlessSuperProductId, tailorlessSuperProductComponentId);
    await expect(addItemToBox(tenantId, box.id, anotherComponentId)).rejects.toMatchObject({
      status: 409,
      code: "BOX_CLOSED",
    });

    await expect(removeItemFromBox(tenantId, box.id, componentId)).rejects.toMatchObject({
      status: 409,
      code: "BOX_CLOSED",
    });
  });

  it("HttpError is the rejection type used throughout", async () => {
    try {
      await getShippingBox(tenantId, randomUUID());
      throw new Error("expected getShippingBox to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
  });

  async function createCertifiedTailor(processIds: string[]) {
    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "Ship Test Tailor", username: `ship-tailor-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorIds.push(tailor.id);
    await db.insert(tailorProcesses).values(processIds.map((processId) => ({ tailorId: tailor.id, processId })));
    return tailor;
  }
});
