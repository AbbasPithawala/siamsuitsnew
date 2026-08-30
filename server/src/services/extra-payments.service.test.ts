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
  features,
  styles,
  tailors,
  tailorProcesses,
  orders,
  orderItems,
  orderItemComponents,
  orderItemComponentFeatures,
  manufacturingSteps,
  jobs,
  extraPaymentCategories,
  extraPayments,
} from "../db/schema/index";
import { hashPassword } from "./auth.service";
import { createOrder } from "./orders.service";
import { assignNextStep, completeStep } from "./manufacturing.service";
import {
  createExtraPayment,
  approveExtraPayment,
  rejectExtraPayment,
  removeExtraPayment,
  listExtraPayments,
} from "./extra-payments.service";
import { HttpError } from "../utils/http-error";

const suffix = randomUUID();

describe("extra-payments.service", () => {
  let tenantId: string;
  let retailerId: string;
  let customerId: string;
  let productId: string;
  let otherProductId: string;
  let superProductId: string;
  let superProductComponentId: string;
  let processAId: string;
  let processBId: string;
  let featureId: string;
  let styleId: string;
  let otherStyleId: string;
  let tailorId: string;
  let otherTailorId: string;

  let categoryMatchingId: string;
  let categoryWrongProcessId: string;
  let categoryWrongProductId: string;
  let categoryWrongStyleId: string;
  let categoryNoFeatureId: string;

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const jobIds: string[] = [];
  const categoryIds: string[] = [];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name: `EP Test Retailer ${suffix}`, code: `EPT-${suffix.slice(0, 8)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const [customer] = await db.insert(customers).values({ tenantId, retailerId, firstName: "EP Test Customer" }).returning();
    if (!customer) throw new Error("Failed to create test customer");
    customerId = customer.id;

    const [processA] = await db.insert(processes).values({ tenantId, name: `EP-Stitching-${suffix}`, price: "100.00" }).returning();
    const [processB] = await db.insert(processes).values({ tenantId, name: `EP-Cutting-${suffix}`, price: "50.00" }).returning();
    if (!processA || !processB) throw new Error("Failed to create test processes");
    processAId = processA.id;
    processBId = processB.id;

    const [product] = await db.insert(products).values({ tenantId, name: `EPTestProduct-${suffix}` }).returning();
    const [otherProduct] = await db.insert(products).values({ tenantId, name: `EPOtherProduct-${suffix}` }).returning();
    if (!product || !otherProduct) throw new Error("Failed to create test products");
    productId = product.id;
    otherProductId = otherProduct.id;

    await db.insert(productProcesses).values([
      { productId, processId: processAId, sequenceOrder: 1 },
      { productId, processId: processBId, sequenceOrder: 2 },
    ]);

    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `EPTestSuper-${suffix}` }).returning();
    if (!superProduct) throw new Error("Failed to create test super product");
    superProductId = superProduct.id;

    const [component] = await db
      .insert(superProductComponents)
      .values({ superProductId, productId, slotLabel: "Main", sequence: 1 })
      .returning();
    if (!component) throw new Error("Failed to create test super product component");
    superProductComponentId = component.id;

    const [feature] = await db
      .insert(features)
      .values({ tenantId, name: `EPTestFeature-${suffix}`, type: "choice", processId: processAId })
      .returning();
    if (!feature) throw new Error("Failed to create test feature");
    featureId = feature.id;

    const [style] = await db.insert(styles).values({ featureId, name: `EPTestStyle-${suffix}`, workerPrice: "10.00" }).returning();
    const [otherStyle] = await db.insert(styles).values({ featureId, name: `EPOtherStyle-${suffix}`, workerPrice: "5.00" }).returning();
    if (!style || !otherStyle) throw new Error("Failed to create test styles");
    styleId = style.id;
    otherStyleId = otherStyle.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "EP Test Tailor", username: `ep-tailor-${suffix}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;

    const [otherTailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "EP Other Test Tailor", username: `ep-other-tailor-${suffix}`, passwordHash })
      .returning();
    if (!otherTailor) throw new Error("Failed to create other test tailor");
    otherTailorId = otherTailor.id;

    await db.insert(tailorProcesses).values([
      { tailorId, processId: processAId },
      { tailorId, processId: processBId },
    ]);

    // A category that genuinely matches product+process+feature+style.
    const [categoryMatching] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId, productId, processId: processAId, featureId, styleId, name: `Matching-${suffix}`, cost: "20.00" })
      .returning();
    // A category whose process doesn't match the job's step (points at process B, but featureId's process is A).
    const [categoryWrongProcess] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId, productId, processId: processBId, name: `WrongProcess-${suffix}`, cost: "15.00" })
      .returning();
    // A category defined against a completely different product.
    const [categoryWrongProduct] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId, productId: otherProductId, processId: processAId, name: `WrongProduct-${suffix}`, cost: "18.00" })
      .returning();
    // A category naming the *other* style under the same feature — never actually selected on the order.
    const [categoryWrongStyle] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId, productId, processId: processAId, featureId, styleId: otherStyleId, name: `WrongStyle-${suffix}`, cost: "12.00" })
      .returning();
    // A category with no featureId at all — only product+process must match.
    const [categoryNoFeature] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId, productId, processId: processAId, name: `NoFeature-${suffix}`, cost: "8.00" })
      .returning();
    if (!categoryMatching || !categoryWrongProcess || !categoryWrongProduct || !categoryWrongStyle || !categoryNoFeature) {
      throw new Error("Failed to create test extra payment categories");
    }
    categoryMatchingId = categoryMatching.id;
    categoryWrongProcessId = categoryWrongProcess.id;
    categoryWrongProductId = categoryWrongProduct.id;
    categoryWrongStyleId = categoryWrongStyle.id;
    categoryNoFeatureId = categoryNoFeature.id;
    categoryIds.push(categoryMatchingId, categoryWrongProcessId, categoryWrongProductId, categoryWrongStyleId, categoryNoFeatureId);
  });

  afterAll(async () => {
    const stepRows = componentIds.length
      ? await db.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.orderItemComponentId, componentIds) })
      : [];
    const stepIds = stepRows.map((s) => s.id);
    const allJobRows = stepIds.length ? await db.query.jobs.findMany({ where: inArray(jobs.manufacturingStepId, stepIds) }) : [];
    const allJobIds = [...new Set([...jobIds, ...allJobRows.map((j) => j.id)])];

    if (allJobIds.length) await db.delete(extraPayments).where(inArray(extraPayments.jobId, allJobIds));
    if (allJobIds.length) await db.delete(jobs).where(inArray(jobs.id, allJobIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) {
      await db.delete(orderItemComponentFeatures).where(inArray(orderItemComponentFeatures.orderItemComponentId, componentIds));
    }
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    if (categoryIds.length) await db.delete(extraPaymentCategories).where(inArray(extraPaymentCategories.id, categoryIds));
    await db.delete(tailorProcesses).where(eq(tailorProcesses.tailorId, tailorId));
    await db.delete(tailors).where(inArray(tailors.id, [tailorId, otherTailorId]));
    await db.delete(styles).where(inArray(styles.id, [styleId, otherStyleId]));
    await db.delete(features).where(eq(features.id, featureId));
    await db.delete(superProductComponents).where(eq(superProductComponents.id, superProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, superProductId));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(products).where(inArray(products.id, [productId, otherProductId]));
    await db.delete(processes).where(inArray(processes.id, [processAId, processBId]));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailerId));
  });

  /** Creates an order with the feature/style genuinely selected, assigns+returns the process-A job. */
  async function createAssignedJob() {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [{ superProductId, components: [{ superProductComponentId, features: [{ featureId, styleId }] }] }],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);

    const { job } = await assignNextStep(tenantId, componentId, tailorId);
    jobIds.push(job.id);
    return job;
  }

  it("creates an extra payment when product/process/feature/style all genuinely match, defaulting to approved: false", async () => {
    const job = await createAssignedJob();

    const extraPayment = await createExtraPayment(tenantId, job.id, categoryMatchingId);

    expect(extraPayment.jobId).toBe(job.id);
    expect(extraPayment.categoryId).toBe(categoryMatchingId);
    expect(extraPayment.tailorId).toBe(job.tailorId);
    expect(extraPayment.cost).toBe("20.00");
    expect(extraPayment.approved).toBe(false);
    expect(extraPayment.paid).toBe(false);
  });

  it("accepts a category with no featureId as long as product+process match", async () => {
    const job = await createAssignedJob();

    const extraPayment = await createExtraPayment(tenantId, job.id, categoryNoFeatureId);
    expect(extraPayment.approved).toBe(false);
  });

  it("rejects with CATEGORY_PROCESS_MISMATCH when the category's process doesn't match the job's step", async () => {
    const job = await createAssignedJob();

    await expect(createExtraPayment(tenantId, job.id, categoryWrongProcessId)).rejects.toMatchObject({
      status: 422,
      code: "CATEGORY_PROCESS_MISMATCH",
    });
  });

  it("rejects with CATEGORY_PRODUCT_MISMATCH when the category is defined against a different product", async () => {
    const job = await createAssignedJob();

    await expect(createExtraPayment(tenantId, job.id, categoryWrongProductId)).rejects.toMatchObject({
      status: 422,
      code: "CATEGORY_PRODUCT_MISMATCH",
    });
  });

  it("rejects with STYLE_NOT_SELECTED when the category names a style that was never actually chosen on this order — the actual point of this group", async () => {
    const job = await createAssignedJob();

    // categoryWrongStyleId matches product+process+feature, but names otherStyleId, while
    // the order's component genuinely selected `styleId`. The legacy system would have
    // allowed this (it only checked product+process); this must be rejected.
    await expect(createExtraPayment(tenantId, job.id, categoryWrongStyleId)).rejects.toMatchObject({
      status: 422,
      code: "STYLE_NOT_SELECTED",
    });
  });

  it("rejects with STYLE_NOT_SELECTED when the category's feature was never selected on this component at all", async () => {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [{ superProductId, components: [{ superProductComponentId, features: [] }] }],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);

    const { job } = await assignNextStep(tenantId, componentId, tailorId);
    jobIds.push(job.id);

    await expect(createExtraPayment(tenantId, job.id, categoryMatchingId)).rejects.toMatchObject({
      status: 422,
      code: "STYLE_NOT_SELECTED",
    });
  });

  it("rejects a duplicate extra payment for the same job+category", async () => {
    const job = await createAssignedJob();

    await createExtraPayment(tenantId, job.id, categoryMatchingId);
    await expect(createExtraPayment(tenantId, job.id, categoryMatchingId)).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_EXTRA_PAYMENT",
    });
  });

  it("404s cleanly for a bogus jobId", async () => {
    await expect(createExtraPayment(tenantId, randomUUID(), categoryMatchingId)).rejects.toMatchObject({
      status: 404,
      code: "JOB_NOT_FOUND",
    });
  });

  it("404s cleanly for a bogus categoryId", async () => {
    const job = await createAssignedJob();
    await expect(createExtraPayment(tenantId, job.id, randomUUID())).rejects.toMatchObject({
      status: 404,
      code: "EXTRA_PAYMENT_CATEGORY_NOT_FOUND",
    });
  });

  it("approveExtraPayment flips approved to true, and rejects approving an already-approved record", async () => {
    const job = await createAssignedJob();
    const created = await createExtraPayment(tenantId, job.id, categoryMatchingId);
    expect(created.approved).toBe(false);

    const approved = await approveExtraPayment(tenantId, created.id);
    expect(approved.approved).toBe(true);

    await expect(approveExtraPayment(tenantId, created.id)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_APPROVED",
    });
  });

  it("rejectExtraPayment flips rejected to true, and rejects rejecting an already-approved or already-rejected record", async () => {
    const job = await createAssignedJob();
    const created = await createExtraPayment(tenantId, job.id, categoryMatchingId);

    const rejected = await rejectExtraPayment(tenantId, created.id);
    expect(rejected.rejected).toBe(true);
    expect(rejected.rejectedAt).not.toBeNull();
    expect(rejected.approved).toBe(false);

    await expect(rejectExtraPayment(tenantId, created.id)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_REJECTED",
    });

    const job2 = await createAssignedJob();
    const approved = await createExtraPayment(tenantId, job2.id, categoryMatchingId);
    await approveExtraPayment(tenantId, approved.id);
    await expect(rejectExtraPayment(tenantId, approved.id)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_APPROVED",
    });
  });

  it("approveExtraPayment refuses an already-rejected record", async () => {
    const job = await createAssignedJob();
    const created = await createExtraPayment(tenantId, job.id, categoryMatchingId);
    await rejectExtraPayment(tenantId, created.id);

    await expect(approveExtraPayment(tenantId, created.id)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_REJECTED",
    });
  });

  it("removeExtraPayment hard-deletes an unapproved extra payment while its job is still assigned", async () => {
    const job = await createAssignedJob();
    await createExtraPayment(tenantId, job.id, categoryMatchingId);

    const removed = await removeExtraPayment(tenantId, job.id, categoryMatchingId);
    expect(removed.categoryId).toBe(categoryMatchingId);

    // Gone for good — re-attaching the same category to the same job succeeds again,
    // proving it was a real delete and not a soft state flip.
    const recreated = await createExtraPayment(tenantId, job.id, categoryMatchingId);
    expect(recreated.id).not.toBe(removed.id);
  });

  it("removeExtraPayment refuses an already-approved extra payment", async () => {
    const job = await createAssignedJob();
    const created = await createExtraPayment(tenantId, job.id, categoryMatchingId);
    await approveExtraPayment(tenantId, created.id);

    await expect(removeExtraPayment(tenantId, job.id, categoryMatchingId)).rejects.toMatchObject({
      status: 409,
      code: "EXTRA_PAYMENT_ALREADY_APPROVED",
    });
  });

  it("removeExtraPayment refuses once the job's step is complete", async () => {
    const job = await createAssignedJob();
    await createExtraPayment(tenantId, job.id, categoryMatchingId);
    await completeStep(tenantId, job.id);

    await expect(removeExtraPayment(tenantId, job.id, categoryMatchingId)).rejects.toMatchObject({
      status: 409,
      code: "STEP_ALREADY_COMPLETE",
    });
  });

  it("removeExtraPayment 404s cleanly when no extra payment exists for that job+category", async () => {
    const job = await createAssignedJob();
    await expect(removeExtraPayment(tenantId, job.id, categoryMatchingId)).rejects.toMatchObject({
      status: 404,
      code: "EXTRA_PAYMENT_NOT_FOUND",
    });
  });

  it("createExtraPayment's actorTailorId (tailor-portal self-service): 404s a job assigned to a different tailor, succeeds for the actual assignee, and is a no-op when omitted", async () => {
    const job = await createAssignedJob();

    await expect(createExtraPayment(tenantId, job.id, categoryMatchingId, otherTailorId)).rejects.toMatchObject({
      status: 404,
      code: "JOB_NOT_FOUND",
    });

    const extraPayment = await createExtraPayment(tenantId, job.id, categoryMatchingId, tailorId);
    expect(extraPayment.jobId).toBe(job.id);

    const job2 = await createAssignedJob();
    const viaOmitted = await createExtraPayment(tenantId, job2.id, categoryMatchingId);
    expect(viaOmitted.jobId).toBe(job2.id);
  });

  it("removeExtraPayment's actorTailorId (tailor-portal self-service): 404s a job assigned to a different tailor, succeeds for the actual assignee, and is a no-op when omitted", async () => {
    const job = await createAssignedJob();
    await createExtraPayment(tenantId, job.id, categoryMatchingId);

    await expect(removeExtraPayment(tenantId, job.id, categoryMatchingId, otherTailorId)).rejects.toMatchObject({
      status: 404,
      code: "JOB_NOT_FOUND",
    });

    const removed = await removeExtraPayment(tenantId, job.id, categoryMatchingId, tailorId);
    expect(removed.categoryId).toBe(categoryMatchingId);

    const job2 = await createAssignedJob();
    await createExtraPayment(tenantId, job2.id, categoryMatchingId);
    const removedViaOmitted = await removeExtraPayment(tenantId, job2.id, categoryMatchingId);
    expect(removedViaOmitted.categoryId).toBe(categoryMatchingId);
  });

  it("listExtraPayments defaults to the pending queue and enriches tailor/category/order", async () => {
    const job = await createAssignedJob();
    const pending = await createExtraPayment(tenantId, job.id, categoryMatchingId);

    const job2 = await createAssignedJob();
    const toApprove = await createExtraPayment(tenantId, job2.id, categoryNoFeatureId);
    await approveExtraPayment(tenantId, toApprove.id);

    const pendingList = await listExtraPayments(tenantId);
    const pendingIds = pendingList.map((ep) => ep.id);
    expect(pendingIds).toContain(pending.id);
    expect(pendingIds).not.toContain(toApprove.id);

    const found = pendingList.find((ep) => ep.id === pending.id)!;
    expect(found.tailor?.name).toBe("EP Test Tailor");
    expect(found.category?.id).toBe(categoryMatchingId);
    expect(found.order?.id).toBeTruthy();

    const approvedList = await listExtraPayments(tenantId, { status: "approved" });
    expect(approvedList.map((ep) => ep.id)).toContain(toApprove.id);
    expect(approvedList.map((ep) => ep.id)).not.toContain(pending.id);
  });

  it("listExtraPayments filters by tailorId", async () => {
    const job = await createAssignedJob();
    const created = await createExtraPayment(tenantId, job.id, categoryMatchingId);

    const matching = await listExtraPayments(tenantId, { status: "pending", tailorId });
    expect(matching.map((ep) => ep.id)).toContain(created.id);

    const nonMatching = await listExtraPayments(tenantId, { status: "pending", tailorId: randomUUID() });
    expect(nonMatching.map((ep) => ep.id)).not.toContain(created.id);
  });

  it("HttpError is the rejection type used throughout", async () => {
    try {
      await createExtraPayment(tenantId, randomUUID(), categoryMatchingId);
      throw new Error("expected createExtraPayment to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
  });
});
