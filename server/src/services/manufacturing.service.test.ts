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
  orderGroups,
  orders,
  orderItems,
  orderItemComponents,
  orderItemComponentFeatures,
  manufacturingSteps,
  jobs,
} from "../db/schema/index";
import { hashPassword } from "./auth.service";
import { createOrder } from "./orders.service";
import { createOrderGroup } from "./order-groups.service";
import { assignNextStep, completeStep, getComponentDetail } from "./manufacturing.service";
import { HttpError } from "../utils/http-error";

const suffix = randomUUID();

describe("manufacturing.service", () => {
  let tenantId: string;
  let retailerId: string;
  let customerId: string;
  let customer2Id: string;
  let productId: string;
  let superProductId: string;
  let superProductComponentId: string;
  let processAId: string;
  let processBId: string;
  let featureId: string;
  let styleId: string;
  let tailorCertifiedId: string;
  let tailorForBId: string;
  let tailorUncertifiedId: string;

  const orderIds: string[] = [];
  const orderGroupIds: string[] = [];
  const componentIds: string[] = [];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name: `Mfg Test Retailer ${suffix}`, code: `MFGT-${suffix.slice(0, 8)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const [customer] = await db.insert(customers).values({ tenantId, retailerId, firstName: "Mfg Test Customer" }).returning();
    if (!customer) throw new Error("Failed to create test customer");
    customerId = customer.id;

    const [customer2] = await db.insert(customers).values({ tenantId, retailerId, firstName: "Mfg Test Customer 2" }).returning();
    if (!customer2) throw new Error("Failed to create second test customer");
    customer2Id = customer2.id;

    const [processA] = await db
      .insert(processes)
      .values({ tenantId, name: `Stitching-${suffix}`, price: "100.00" })
      .returning();
    const [processB] = await db
      .insert(processes)
      .values({ tenantId, name: `Cutting-${suffix}`, price: "50.00" })
      .returning();
    if (!processA || !processB) throw new Error("Failed to create test processes");
    processAId = processA.id;
    processBId = processB.id;

    const [product] = await db.insert(products).values({ tenantId, name: `MfgTestProduct-${suffix}` }).returning();
    if (!product) throw new Error("Failed to create test product");
    productId = product.id;

    await db.insert(productProcesses).values([
      { productId, processId: processAId, sequenceOrder: 1 },
      { productId, processId: processBId, sequenceOrder: 2 },
    ]);

    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `MfgTestSuper-${suffix}` }).returning();
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
      .values({ tenantId, name: `MfgTestFeature-${suffix}`, type: "choice", processId: processAId })
      .returning();
    if (!feature) throw new Error("Failed to create test feature");
    featureId = feature.id;

    const [style] = await db.insert(styles).values({ featureId, name: `MfgTestStyle-${suffix}`, workerPrice: "25.00" }).returning();
    if (!style) throw new Error("Failed to create test style");
    styleId = style.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailorCertified] = await db
      .insert(tailors)
      .values({ tenantId, name: "Certified Tailor", username: `mfg-tailor-a-${suffix}`, passwordHash })
      .returning();
    const [tailorForB] = await db
      .insert(tailors)
      .values({ tenantId, name: "Tailor For Process B", username: `mfg-tailor-b-${suffix}`, passwordHash })
      .returning();
    const [tailorUncertified] = await db
      .insert(tailors)
      .values({ tenantId, name: "Uncertified Tailor", username: `mfg-tailor-u-${suffix}`, passwordHash })
      .returning();
    if (!tailorCertified || !tailorForB || !tailorUncertified) throw new Error("Failed to create test tailors");
    tailorCertifiedId = tailorCertified.id;
    tailorForBId = tailorForB.id;
    tailorUncertifiedId = tailorUncertified.id;

    await db.insert(tailorProcesses).values([
      { tailorId: tailorCertifiedId, processId: processAId },
      { tailorId: tailorForBId, processId: processBId },
    ]);
  });

  afterAll(async () => {
    const stepRows = componentIds.length
      ? await db.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.orderItemComponentId, componentIds) })
      : [];
    const stepIds = stepRows.map((s) => s.id);

    if (stepIds.length) await db.delete(jobs).where(inArray(jobs.manufacturingStepId, stepIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) {
      await db.delete(orderItemComponentFeatures).where(inArray(orderItemComponentFeatures.orderItemComponentId, componentIds));
    }
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
    if (orderGroupIds.length) await db.delete(orderGroups).where(inArray(orderGroups.id, orderGroupIds));

    await db.delete(tailorProcesses).where(inArray(tailorProcesses.tailorId, [tailorCertifiedId, tailorForBId, tailorUncertifiedId]));
    await db.delete(tailors).where(inArray(tailors.id, [tailorCertifiedId, tailorForBId, tailorUncertifiedId]));
    await db.delete(styles).where(eq(styles.id, styleId));
    await db.delete(features).where(eq(features.id, featureId));
    await db.delete(superProductComponents).where(eq(superProductComponents.id, superProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, superProductId));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(processes).where(inArray(processes.id, [processAId, processBId]));
    await db.delete(customers).where(inArray(customers.id, [customerId, customer2Id]));
    await db.delete(retailers).where(eq(retailers.id, retailerId));
  });

  async function createTestOrder(forCustomerId: string) {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId: forCustomerId,
      items: [{ superProductId, components: [{ superProductComponentId, features: [{ featureId, styleId }] }] }],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);
    return componentId;
  }

  it("rejects an uncertified tailor with NOT_CERTIFIED", async () => {
    const componentId = await createTestOrder(customerId);

    await expect(assignNextStep(tenantId, componentId, tailorUncertifiedId)).rejects.toMatchObject({
      status: 403,
      code: "NOT_CERTIFIED",
    });
  });

  it("enforces sequential dependency, computes cost via the new formula, and excludes unrelated-process workerPrice", async () => {
    const componentId = await createTestOrder(customerId);

    const first = await assignNextStep(tenantId, componentId, tailorCertifiedId);
    expect(first.step.status).toBe("assigned");
    expect(first.step.tailorId).toBe(tailorCertifiedId);
    // process A price (100.00) + the selected style's workerPrice (25.00) on a feature
    // paid during process A.
    expect(first.job.cost).toBe("100.00");
    expect(first.job.stylingPrice).toBe("25.00");

    // Step 2 can't be assigned before step 1 completes — step 1 is merely "assigned",
    // not "complete", so step 2 stays locked.
    await expect(assignNextStep(tenantId, componentId, tailorForBId)).rejects.toMatchObject({
      status: 409,
      code: "STEP_LOCKED",
    });

    const completed = await completeStep(tenantId, first.job.id);
    expect(completed.status).toBe("complete");
    expect(completed.completedAt).not.toBeNull();

    const second = await assignNextStep(tenantId, componentId, tailorForBId);
    expect(second.step.status).toBe("assigned");
    // process B price (50.00) with no matching feature — the process-A-only feature's
    // workerPrice must NOT leak into process B's job.
    expect(second.job.cost).toBe("50.00");
    expect(second.job.stylingPrice).toBe("0.00");

    // Step 2 is only "assigned", not yet "complete" — a third assign attempt must be
    // distinguished from "nothing left" (STEP_IN_PROGRESS, not NO_STEP_AVAILABLE).
    await expect(assignNextStep(tenantId, componentId, tailorForBId)).rejects.toMatchObject({
      status: 409,
      code: "STEP_IN_PROGRESS",
    });

    await completeStep(tenantId, second.job.id);

    await expect(assignNextStep(tenantId, componentId, tailorForBId)).rejects.toMatchObject({
      status: 409,
      code: "NO_STEP_AVAILABLE",
    });
  });

  it("rejects completing a step that is already complete", async () => {
    const componentId = await createTestOrder(customerId);
    const { job } = await assignNextStep(tenantId, componentId, tailorCertifiedId);

    await completeStep(tenantId, job.id);
    await expect(completeStep(tenantId, job.id)).rejects.toMatchObject({ status: 409, code: "STEP_ALREADY_COMPLETE" });
  });

  it("rejects completing a step that was never assigned (still pending)", async () => {
    const componentId = await createTestOrder(customerId);
    const pendingStep = await db.query.manufacturingSteps.findFirst({
      where: (s, { and, eq: eqOp }) => and(eqOp(s.orderItemComponentId, componentId), eqOp(s.sequenceOrder, 1)),
    });
    if (!pendingStep) throw new Error("Expected a pending manufacturing step");
    expect(pendingStep.status).toBe("pending");

    // Simulates a data anomaly (or a future direct-job-creation path) rather than
    // something reachable through assignNextStep — assignNextStep never creates a job
    // against a pending step, so this exercises completeStep's own defensive check.
    const [orphanJob] = await db
      .insert(jobs)
      .values({ tenantId, manufacturingStepId: pendingStep.id, tailorId: tailorCertifiedId, cost: "0", stylingPrice: "0" })
      .returning();
    if (!orphanJob) throw new Error("Failed to create orphan job fixture");

    await expect(completeStep(tenantId, orphanJob.id)).rejects.toMatchObject({ status: 409, code: "STEP_NOT_STARTED" });
  });

  it("404s cleanly for a bogus orderItemComponentId instead of falling through", async () => {
    await expect(assignNextStep(tenantId, randomUUID(), tailorCertifiedId)).rejects.toMatchObject({
      status: 404,
      code: "COMPONENT_NOT_FOUND",
    });
  });

  it("runs a group order's component through the exact same assign/complete flow as a normal order — proving no order-type branching", async () => {
    const group = await createOrderGroup(tenantId, {
      retailerId,
      orders: [
        { customerId, items: [{ superProductId, components: [{ superProductComponentId, features: [{ featureId, styleId }] }] }] },
        { customerId: customer2Id, items: [{ superProductId, components: [{ superProductComponentId, features: [] }] }] },
      ],
    });

    orderGroupIds.push(group.id);
    for (const childOrder of group.orders) {
      orderIds.push(childOrder.id);
      const componentId = childOrder.items[0]!.components[0]!.id;
      componentIds.push(componentId);
    }

    const groupComponentId = group.orders[0]!.items[0]!.components[0]!.id;

    const assigned = await assignNextStep(tenantId, groupComponentId, tailorCertifiedId);
    expect(assigned.step.status).toBe("assigned");
    const completed = await completeStep(tenantId, assigned.job.id);
    expect(completed.status).toBe("complete");
  });

  it("getComponentDetail previews the next assignable step and tracks it through assign/complete", async () => {
    const componentId = await createTestOrder(customerId);

    const pending = await getComponentDetail(tenantId, componentId);
    expect(pending.id).toBe(componentId);
    expect(pending.productId).toBe(productId);
    expect(pending.manufacturingSteps).toHaveLength(2);
    expect(pending.nextStep?.processId).toBe(processAId);
    expect(pending.blockedReason).toBeNull();

    const { job } = await assignNextStep(tenantId, componentId, tailorCertifiedId);

    const inProgress = await getComponentDetail(tenantId, componentId);
    expect(inProgress.nextStep).toBeNull();
    // Step 2 (process B) is still "pending", but its predecessor (step 1, process A) is
    // merely "assigned" not "complete" — same STEP_LOCKED reasoning as the assign test
    // above, not STEP_IN_PROGRESS (which only fires when no pending step remains at all).
    expect(inProgress.blockedReason).toBe("STEP_LOCKED");
    expect(inProgress.manufacturingSteps.find((s) => s.processId === processAId)?.status).toBe("assigned");

    await completeStep(tenantId, job.id);

    const secondPending = await getComponentDetail(tenantId, componentId);
    expect(secondPending.nextStep?.processId).toBe(processBId);
    expect(secondPending.blockedReason).toBeNull();

    const { job: secondJob } = await assignNextStep(tenantId, componentId, tailorForBId);

    // Now step 2 (the last step) is "assigned" and no step is "pending" — this is the
    // genuine STEP_IN_PROGRESS case, distinct from the STEP_LOCKED case exercised above.
    const lastStepInProgress = await getComponentDetail(tenantId, componentId);
    expect(lastStepInProgress.nextStep).toBeNull();
    expect(lastStepInProgress.blockedReason).toBe("STEP_IN_PROGRESS");

    await completeStep(tenantId, secondJob.id);

    const done = await getComponentDetail(tenantId, componentId);
    expect(done.nextStep).toBeNull();
    expect(done.blockedReason).toBe("NO_STEP_AVAILABLE");
  });

  it("getComponentDetail 404s cleanly for a bogus componentId", async () => {
    await expect(getComponentDetail(tenantId, randomUUID())).rejects.toMatchObject({
      status: 404,
      code: "COMPONENT_NOT_FOUND",
    });
  });

  it("HttpError is the rejection type used throughout (sanity check for the .toMatchObject assertions above)", async () => {
    try {
      await assignNextStep(tenantId, randomUUID(), tailorCertifiedId);
      throw new Error("expected assignNextStep to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
  });
});
