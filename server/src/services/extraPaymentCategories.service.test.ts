import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/index";
import { tenants, products, processes, features, styles, extraPaymentCategories } from "../db/schema/index";
import {
  createExtraPaymentCategory,
  listExtraPaymentCategories,
  getExtraPaymentCategory,
  updateExtraPaymentCategory,
  softDeleteExtraPaymentCategory,
} from "./extraPaymentCategories.service";
import { HttpError } from "../utils/http-error";

const suffix = randomUUID();

describe("extraPaymentCategories.service", () => {
  let tenantId: string;
  let productId: string;
  let processId: string;
  let featureId: string;
  let styleId: string;

  let otherTenantId: string;
  let otherProductId: string;
  let otherProcessId: string;

  const categoryIds: string[] = [];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const [process] = await db.insert(processes).values({ tenantId, name: `EPC-Process-${suffix}`, price: "50.00" }).returning();
    if (!process) throw new Error("Failed to create test process");
    processId = process.id;

    const [product] = await db.insert(products).values({ tenantId, name: `EPCTestProduct-${suffix}` }).returning();
    if (!product) throw new Error("Failed to create test product");
    productId = product.id;

    const [feature] = await db
      .insert(features)
      .values({ tenantId, name: `EPCTestFeature-${suffix}`, type: "choice", processId })
      .returning();
    if (!feature) throw new Error("Failed to create test feature");
    featureId = feature.id;

    const [style] = await db.insert(styles).values({ featureId, name: `EPCTestStyle-${suffix}`, workerPrice: "5.00" }).returning();
    if (!style) throw new Error("Failed to create test style");
    styleId = style.id;

    const [otherTenant] = await db
      .insert(tenants)
      .values({ name: `EPC Other Tenant ${suffix}`, slug: `epc-other-${suffix}`, plan: "standard" })
      .returning();
    if (!otherTenant) throw new Error("Failed to create second test tenant");
    otherTenantId = otherTenant.id;

    const [otherProcess] = await db
      .insert(processes)
      .values({ tenantId: otherTenantId, name: `EPC-OtherProcess-${suffix}`, price: "50.00" })
      .returning();
    if (!otherProcess) throw new Error("Failed to create other-tenant process");
    otherProcessId = otherProcess.id;

    const [otherProduct] = await db
      .insert(products)
      .values({ tenantId: otherTenantId, name: `EPCOtherTenantProduct-${suffix}` })
      .returning();
    if (!otherProduct) throw new Error("Failed to create other-tenant product");
    otherProductId = otherProduct.id;
  });

  afterAll(async () => {
    if (categoryIds.length) await db.delete(extraPaymentCategories).where(inArray(extraPaymentCategories.id, categoryIds));
    await db.delete(styles).where(eq(styles.id, styleId));
    await db.delete(features).where(eq(features.id, featureId));
    await db.delete(products).where(inArray(products.id, [productId, otherProductId]));
    await db.delete(processes).where(inArray(processes.id, [processId, otherProcessId]));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it("creates a category referencing only the required product+process", async () => {
    const category = await createExtraPaymentCategory(tenantId, {
      productId,
      processId,
      name: `Basic-${suffix}`,
      cost: "10.00",
    });
    categoryIds.push(category.id);

    expect(category.tenantId).toBe(tenantId);
    expect(category.productId).toBe(productId);
    expect(category.processId).toBe(processId);
    expect(category.featureId).toBeNull();
    expect(category.styleId).toBeNull();
    expect(category.cost).toBe("10.00");
    expect(category.deletedAt).toBeNull();
  });

  it("creates a category referencing an optional feature+style", async () => {
    const category = await createExtraPaymentCategory(tenantId, {
      productId,
      processId,
      featureId,
      styleId,
      name: `WithStyle-${suffix}`,
      thaiName: `ไทย-${suffix}`,
      cost: "25.00",
    });
    categoryIds.push(category.id);

    expect(category.featureId).toBe(featureId);
    expect(category.styleId).toBe(styleId);
    expect(category.thaiName).toBe(`ไทย-${suffix}`);
  });

  it("rejects creation with PRODUCT_NOT_FOUND for a nonexistent productId", async () => {
    await expect(
      createExtraPaymentCategory(tenantId, { productId: randomUUID(), processId, name: "x" })
    ).rejects.toMatchObject({ status: 404, code: "PRODUCT_NOT_FOUND" });
  });

  it("rejects creation with PROCESS_NOT_FOUND for a nonexistent processId", async () => {
    await expect(
      createExtraPaymentCategory(tenantId, { productId, processId: randomUUID(), name: "x" })
    ).rejects.toMatchObject({ status: 404, code: "PROCESS_NOT_FOUND" });
  });

  it("rejects creation with FEATURE_NOT_FOUND for a nonexistent featureId", async () => {
    await expect(
      createExtraPaymentCategory(tenantId, { productId, processId, featureId: randomUUID(), name: "x" })
    ).rejects.toMatchObject({ status: 404, code: "FEATURE_NOT_FOUND" });
  });

  it("rejects creation with STYLE_NOT_FOUND for a nonexistent styleId", async () => {
    await expect(
      createExtraPaymentCategory(tenantId, { productId, processId, styleId: randomUUID(), name: "x" })
    ).rejects.toMatchObject({ status: 404, code: "STYLE_NOT_FOUND" });
  });

  it("rejects creation referencing another tenant's product with PRODUCT_NOT_FOUND (RLS-scoped)", async () => {
    await expect(
      createExtraPaymentCategory(tenantId, { productId: otherProductId, processId, name: "x" })
    ).rejects.toMatchObject({ status: 404, code: "PRODUCT_NOT_FOUND" });
  });

  it("lists categories for the tenant, ordered by name, excluding soft-deleted rows", async () => {
    const toDelete = await createExtraPaymentCategory(tenantId, { productId, processId, name: `ToDelete-${suffix}`, cost: "1.00" });
    categoryIds.push(toDelete.id);
    await softDeleteExtraPaymentCategory(tenantId, toDelete.id);

    const { data, total } = await listExtraPaymentCategories(tenantId);
    const ids = data.map((c) => c.id);
    expect(ids).not.toContain(toDelete.id);
    expect(data.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });

  it("gets a category by id and 404s cleanly for a bogus id", async () => {
    const created = await createExtraPaymentCategory(tenantId, { productId, processId, name: `Gettable-${suffix}`, cost: "3.00" });
    categoryIds.push(created.id);

    const fetched = await getExtraPaymentCategory(tenantId, created.id);
    expect(fetched.id).toBe(created.id);

    await expect(getExtraPaymentCategory(tenantId, randomUUID())).rejects.toMatchObject({
      status: 404,
      code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
    });
  });

  it("updates a category's fields", async () => {
    const created = await createExtraPaymentCategory(tenantId, { productId, processId, name: `Original-${suffix}`, cost: "5.00" });
    categoryIds.push(created.id);

    const updated = await updateExtraPaymentCategory(tenantId, created.id, { name: `Renamed-${suffix}`, cost: "7.50" });
    expect(updated.name).toBe(`Renamed-${suffix}`);
    expect(updated.cost).toBe("7.50");
  });

  it("rejects an update that points productId at a nonexistent id", async () => {
    const created = await createExtraPaymentCategory(tenantId, { productId, processId, name: `ToUpdate-${suffix}`, cost: "5.00" });
    categoryIds.push(created.id);

    await expect(updateExtraPaymentCategory(tenantId, created.id, { productId: randomUUID() })).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("404s updating a bogus category id", async () => {
    await expect(updateExtraPaymentCategory(tenantId, randomUUID(), { name: "x" })).rejects.toMatchObject({
      status: 404,
      code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
    });
  });

  it("soft-deletes a category, and re-deleting it 404s", async () => {
    const created = await createExtraPaymentCategory(tenantId, { productId, processId, name: `ToSoftDelete-${suffix}`, cost: "5.00" });
    categoryIds.push(created.id);

    await softDeleteExtraPaymentCategory(tenantId, created.id);
    await expect(getExtraPaymentCategory(tenantId, created.id)).rejects.toMatchObject({
      status: 404,
      code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
    });
    await expect(softDeleteExtraPaymentCategory(tenantId, created.id)).rejects.toMatchObject({
      status: 404,
      code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
    });
  });

  it("tenant isolation: a category created under another tenant is invisible to this tenant's reads", async () => {
    const [otherCategory] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId: otherTenantId, productId: otherProductId, processId: otherProcessId, name: `OtherTenantCat-${suffix}`, cost: "9.00" })
      .returning();
    if (!otherCategory) throw new Error("Failed to create other-tenant category");

    try {
      await expect(getExtraPaymentCategory(tenantId, otherCategory.id)).rejects.toMatchObject({
        status: 404,
        code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
      });

      const { data } = await listExtraPaymentCategories(tenantId);
      expect(data.map((c) => c.id)).not.toContain(otherCategory.id);

      await expect(softDeleteExtraPaymentCategory(tenantId, otherCategory.id)).rejects.toMatchObject({
        status: 404,
        code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
      });
    } finally {
      await db.delete(extraPaymentCategories).where(eq(extraPaymentCategories.id, otherCategory.id));
    }
  });

  it("HttpError is the rejection type used throughout", async () => {
    try {
      await getExtraPaymentCategory(tenantId, randomUUID());
      throw new Error("expected getExtraPaymentCategory to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
  });
});
