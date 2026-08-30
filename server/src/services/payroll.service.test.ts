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
  workerAdvancePayments,
  paymentSettlements,
  paymentSettlementJobs,
} from "../db/schema/index";
import { hashPassword } from "./auth.service";
import { createOrder } from "./orders.service";
import { assignNextStep, completeStep } from "./manufacturing.service";
import { createExtraPayment, approveExtraPayment } from "./extra-payments.service";
import { createAdvancePayment, createSettlement, getSettlement, listSettlements, listUnpaidCompletedJobs } from "./payroll.service";
import { generateSettlementPdf } from "./settlementPdf.service";
import { generateJobSlipPdf } from "./jobSlipPdf.service";
import { closePdfBrowser } from "./pdfRenderer";
import { localStorageRootDir, LOCAL_STATIC_URL_PREFIX } from "./storage.service";
import { HttpError } from "../utils/http-error";

const suffix = randomUUID();

/** Local-disk-backend URLs are `${LOCAL_STATIC_URL_PREFIX}/<key>` (see `storage.service.ts`) — resolves straight back to the file on disk, no HTTP round-trip needed for a service-level test. */
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

describe("payroll.service", () => {
  let tenantId: string;
  let retailerId: string;
  let customerId: string;
  let productId: string;
  let superProductId: string;
  let superProductComponentId: string;
  let processAId: string;
  let featureId: string;
  let styleId: string;
  let tailorId: string;
  let categoryId: string;

  let otherTenantId: string;
  let otherTenantTailorId: string;

  const orderIds: string[] = [];
  const componentIds: string[] = [];
  const jobIds: string[] = [];
  const settlementIds: string[] = [];
  const advanceIds: string[] = [];

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const [retailer] = await db
      .insert(retailers)
      .values({ tenantId, name: `Payroll Test Retailer ${suffix}`, code: `PRT-${suffix.slice(0, 8)}` })
      .returning();
    if (!retailer) throw new Error("Failed to create test retailer");
    retailerId = retailer.id;

    const [customer] = await db.insert(customers).values({ tenantId, retailerId, firstName: "Payroll Test Customer" }).returning();
    if (!customer) throw new Error("Failed to create test customer");
    customerId = customer.id;

    const [processA] = await db.insert(processes).values({ tenantId, name: `Payroll-Stitching-${suffix}`, price: "100.00" }).returning();
    if (!processA) throw new Error("Failed to create test process");
    processAId = processA.id;

    const [product] = await db.insert(products).values({ tenantId, name: `PayrollTestProduct-${suffix}` }).returning();
    if (!product) throw new Error("Failed to create test product");
    productId = product.id;

    await db.insert(productProcesses).values([{ productId, processId: processAId, sequenceOrder: 1 }]);

    const [superProduct] = await db.insert(superProducts).values({ tenantId, name: `PayrollTestSuper-${suffix}` }).returning();
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
      .values({ tenantId, name: `PayrollTestFeature-${suffix}`, type: "choice", processId: processAId })
      .returning();
    if (!feature) throw new Error("Failed to create test feature");
    featureId = feature.id;

    const [style] = await db.insert(styles).values({ featureId, name: `PayrollTestStyle-${suffix}`, workerPrice: "15.00" }).returning();
    if (!style) throw new Error("Failed to create test style");
    styleId = style.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "Payroll Test Tailor", username: `payroll-tailor-${suffix}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;

    await db.insert(tailorProcesses).values([{ tailorId, processId: processAId }]);

    const [category] = await db
      .insert(extraPaymentCategories)
      .values({ tenantId, productId, processId: processAId, featureId, styleId, name: `PayrollCategory-${suffix}`, cost: "30.00" })
      .returning();
    if (!category) throw new Error("Failed to create test extra payment category");
    categoryId = category.id;

    const [otherTenant] = await db
      .insert(tenants)
      .values({ name: `Payroll Other Tenant ${suffix}`, slug: `payroll-other-${suffix}`, plan: "standard" })
      .returning();
    if (!otherTenant) throw new Error("Failed to create second test tenant");
    otherTenantId = otherTenant.id;

    const otherPasswordHash = await hashPassword("irrelevant-for-this-test");
    const [otherTailor] = await db
      .insert(tailors)
      .values({ tenantId: otherTenantId, name: "Payroll Other Tenant Tailor", username: `payroll-other-tailor-${suffix}`, passwordHash: otherPasswordHash })
      .returning();
    if (!otherTailor) throw new Error("Failed to create other-tenant test tailor");
    otherTenantTailorId = otherTailor.id;
  });

  afterAll(async () => {
    await closePdfBrowser();

    const stepRows = componentIds.length
      ? await db.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.orderItemComponentId, componentIds) })
      : [];
    const stepIds = stepRows.map((s) => s.id);
    const allJobRows = stepIds.length ? await db.query.jobs.findMany({ where: inArray(jobs.manufacturingStepId, stepIds) }) : [];
    const allJobIds = [...new Set([...jobIds, ...allJobRows.map((j) => j.id)])];

    // worker_advance_payments.payment_settlement_id FKs into payment_settlements, so the
    // advance rows (which the settlement tests link via `cleared`/`paymentSettlementId`)
    // must be deleted before the settlements they point at.
    await db.delete(workerAdvancePayments).where(eq(workerAdvancePayments.tailorId, tailorId));
    if (settlementIds.length) await db.delete(paymentSettlementJobs).where(inArray(paymentSettlementJobs.paymentSettlementId, settlementIds));
    if (settlementIds.length) await db.delete(paymentSettlements).where(inArray(paymentSettlements.id, settlementIds));

    if (allJobIds.length) await db.delete(extraPayments).where(inArray(extraPayments.jobId, allJobIds));
    if (allJobIds.length) await db.delete(jobs).where(inArray(jobs.id, allJobIds));
    if (componentIds.length) await db.delete(manufacturingSteps).where(inArray(manufacturingSteps.orderItemComponentId, componentIds));
    if (componentIds.length) {
      await db.delete(orderItemComponentFeatures).where(inArray(orderItemComponentFeatures.orderItemComponentId, componentIds));
    }
    if (componentIds.length) await db.delete(orderItemComponents).where(inArray(orderItemComponents.id, componentIds));
    if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));

    await db.delete(extraPaymentCategories).where(eq(extraPaymentCategories.id, categoryId));
    await db.delete(tailorProcesses).where(eq(tailorProcesses.tailorId, tailorId));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(styles).where(eq(styles.id, styleId));
    await db.delete(features).where(eq(features.id, featureId));
    await db.delete(superProductComponents).where(eq(superProductComponents.id, superProductComponentId));
    await db.delete(superProducts).where(eq(superProducts.id, superProductId));
    await db.delete(productProcesses).where(eq(productProcesses.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(processes).where(eq(processes.id, processAId));
    await db.delete(customers).where(eq(customers.id, customerId));
    await db.delete(retailers).where(eq(retailers.id, retailerId));

    await db.delete(tailors).where(eq(tailors.id, otherTenantTailorId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  /** Creates an order with the feature/style genuinely selected, assigns and (by default) completes its single job — `createSettlement` now requires a complete step, per PHASE_7_TASKS.md Group 1's finding. */
  async function createSettleableJob(withFeature = true, complete = true) {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [
        {
          superProductId,
          components: [{ superProductComponentId, features: withFeature ? [{ featureId, styleId }] : [] }],
        },
      ],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);

    const { job } = await assignNextStep(tenantId, componentId, tailorId);
    jobIds.push(job.id);
    if (complete) await completeStep(tenantId, job.id);
    return job;
  }

  it("createAdvancePayment inserts an advance and increments the tailor's advanceBalance", async () => {
    const before = await db.query.tailors.findFirst({ where: eq(tailors.id, tailorId) });
    if (!before) throw new Error("Expected tailor fixture");
    const startingBalance = Number(before.advanceBalance);

    const { advance, tailor } = await createAdvancePayment(tenantId, tailorId, 200);
    advanceIds.push(advance.id);

    expect(advance.tailorId).toBe(tailorId);
    expect(advance.amount).toBe("200.00");
    expect(advance.cleared).toBe(false);
    expect(Number(tailor.advanceBalance)).toBeCloseTo(startingBalance + 200, 2);

    const reloaded = await db.query.tailors.findFirst({ where: eq(tailors.id, tailorId) });
    expect(Number(reloaded!.advanceBalance)).toBeCloseTo(startingBalance + 200, 2);
  });

  it("computes subTotal/totalPay entirely server-side: job cost+stylingPrice plus only approved+unpaid extra payments", async () => {
    const job = await createSettleableJob();
    // job.cost = process price (100.00), job.stylingPrice = style workerPrice (15.00).
    expect(job.cost).toBe("100.00");
    expect(job.stylingPrice).toBe("15.00");

    const extraPayment = await createExtraPayment(tenantId, job.id, categoryId);
    await approveExtraPayment(tenantId, extraPayment.id);

    // Expected subTotal = 100 + 15 (job) + 30 (approved extra payment) = 145.
    // totalPay = subTotal + manualBill + rent - deductedAdvance = 145 + 10 + 5 - 0 = 160.
    const settlement = await createSettlement(tenantId, tailorId, {
      jobIds: [job.id],
      rent: 5,
      manualBill: 10,
    });
    settlementIds.push(settlement.id);

    expect(settlement.subTotal).toBe("145.00");
    expect(settlement.totalPay).toBe("160.00");
    expect(settlement.rent).toBe("5.00");
    expect(settlement.manualBill).toBe("10.00");
    expect(settlement.deductedAdvance).toBe("0.00");

    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.paid).toBe(true);
    expect(updatedJob?.paidDate).not.toBeNull();

    // The previously-dead `extra_payments.paid` flag is now actually flipped.
    const updatedExtraPayment = await db.query.extraPayments.findFirst({ where: eq(extraPayments.id, extraPayment.id) });
    expect(updatedExtraPayment?.paid).toBe(true);
    expect(updatedExtraPayment?.paidDate).not.toBeNull();

    const detail = await getSettlement(tenantId, tailorId, settlement.id);
    expect(detail.jobs).toHaveLength(1);
    expect(detail.jobs[0]!.job.id).toBe(job.id);

    // getSettlement enrichment (PHASE_6_TASKS.md Group 8): the settlement
    // confirmation screen's source for "which extra payments did this
    // settlement actually pay" — the previously-dead `paid` flag, visible.
    expect(detail.extraPayments).toHaveLength(1);
    expect(detail.extraPayments[0]).toMatchObject({ id: extraPayment.id, paid: true, category: { id: categoryId } });
    expect(detail.clearedAdvances).toHaveLength(0);
  });

  it("listSettlements returns this tailor's settlements newest first", async () => {
    const job = await createSettleableJob();
    const settlement = await createSettlement(tenantId, tailorId, { jobIds: [job.id] });
    settlementIds.push(settlement.id);

    const settlements = await listSettlements(tenantId, tailorId);
    expect(settlements.length).toBeGreaterThan(0);
    expect(settlements[0]!.id).toBe(settlement.id);
    expect(settlements.every((s) => s.tailorId === tailorId)).toBe(true);
  });

  it(
    "generateSettlementPdf renders a real PDF and returns an uploaded URL",
    async () => {
      const job = await createSettleableJob();
      const settlement = await createSettlement(tenantId, tailorId, { jobIds: [job.id] });
      settlementIds.push(settlement.id);

      const url = await generateSettlementPdf(tenantId, tailorId, settlement.id);
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    },
    30000
  );

  it(
    "generateJobSlipPdf renders a real PDF for a still-unsettled job, including its approved extra payment",
    async () => {
      const job = await createSettleableJob();
      const extraPayment = await createExtraPayment(tenantId, job.id, categoryId);
      await approveExtraPayment(tenantId, extraPayment.id);

      const url = await generateJobSlipPdf(tenantId, job.id);
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);

      // The whole point: this job is genuinely still unpaid/unsettled — the slip printed
      // before settlement, not after.
      const reloadedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
      expect(reloadedJob?.paid).toBe(false);

      // The actual reported requirement: this prints on a physical slip printer loaded
      // with fixed stock, so the page must be exactly 80x290mm — legacy's own
      // `new jsPDF({ unit: 'mm', format: [80, 290] })` — not merely "close enough".
      const buffer = await readFile(pdfUrlToLocalPath(url));
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
      const size = firstMediaBoxSizeMm(buffer);
      expect(size.widthMm).toBeCloseTo(80, 0);
      expect(size.heightMm).toBeCloseTo(290, 0);
    },
    30000
  );

  it("generateJobSlipPdf 404s cleanly for a bogus jobId", async () => {
    await expect(generateJobSlipPdf(tenantId, randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  /**
   * The literal money-critical-path trace (PHASE_7_TASKS.md Group 1): a real order, walked
   * through the real `assignNextStep` *and* `completeStep` transitions (not just assigned —
   * every other settlement test in this file settles a merely-`assigned` job, never an
   * actually-`complete` one), then settled, asserting the settlement's `subTotal`/`totalPay`
   * are the real numbers computed from that real job — no mocked/stubbed upstream data.
   */
  it("flows a real job through the full assign → complete → settle trail, folding its real cost into a real settlement's subTotal", async () => {
    const order = await createOrder(tenantId, {
      retailerId,
      customerId,
      items: [
        {
          superProductId,
          components: [{ superProductComponentId, features: [{ featureId, styleId }] }],
        },
      ],
    });
    orderIds.push(order.id);
    const componentId = order.items[0]!.components[0]!.id;
    componentIds.push(componentId);

    const { job, step } = await assignNextStep(tenantId, componentId, tailorId);
    jobIds.push(job.id);
    expect(step.status).toBe("assigned");

    const completedStep = await completeStep(tenantId, job.id);
    expect(completedStep.status).toBe("complete");
    expect(completedStep.completedAt).not.toBeNull();

    // job.cost = process price (100.00), job.stylingPrice = style workerPrice (15.00) — both
    // fixed at assignment time (unaffected by the later completion), so subTotal/totalPay =
    // 115.00 with no rent/manualBill/deductedAdvance supplied.
    const settlement = await createSettlement(tenantId, tailorId, { jobIds: [job.id] });
    settlementIds.push(settlement.id);

    expect(settlement.subTotal).toBe("115.00");
    expect(settlement.totalPay).toBe("115.00");

    const reloadedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(reloadedJob?.paid).toBe(true);

    const reloadedStep = await db.query.manufacturingSteps.findFirst({ where: eq(manufacturingSteps.id, step.id) });
    expect(reloadedStep?.status).toBe("complete");
  });

  it("excludes an unapproved extra payment from subTotal but still settles the job itself", async () => {
    const job = await createSettleableJob();
    const extraPayment = await createExtraPayment(tenantId, job.id, categoryId);
    expect(extraPayment.approved).toBe(false);

    // Expected subTotal = 100 + 15 only — the unapproved extra payment (30.00) is excluded.
    const settlement = await createSettlement(tenantId, tailorId, { jobIds: [job.id] });
    settlementIds.push(settlement.id);

    expect(settlement.subTotal).toBe("115.00");
    expect(settlement.totalPay).toBe("115.00");

    const stillUnpaidExtraPayment = await db.query.extraPayments.findFirst({ where: eq(extraPayments.id, extraPayment.id) });
    expect(stillUnpaidExtraPayment?.paid).toBe(false);

    const updatedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(updatedJob?.paid).toBe(true);
  });

  it("rejects settling a job that is already paid — the whole request, not a silent skip", async () => {
    const job = await createSettleableJob();
    const otherJob = await createSettleableJob(false);

    const settlement = await createSettlement(tenantId, tailorId, { jobIds: [job.id] });
    settlementIds.push(settlement.id);

    await expect(createSettlement(tenantId, tailorId, { jobIds: [job.id, otherJob.id] })).rejects.toMatchObject({
      status: 409,
      code: "JOB_ALREADY_PAID",
    });

    // Confirm the whole request was rejected: otherJob must NOT have been settled either.
    const reloadedOtherJob = await db.query.jobs.findFirst({ where: eq(jobs.id, otherJob.id) });
    expect(reloadedOtherJob?.paid).toBe(false);
  });

  /**
   * PHASE_7_TASKS.md Group 1 finding: `createSettlement` validated ownership, same-tailor,
   * and not-already-paid, but never checked the job's underlying manufacturing step was
   * actually `complete` — a merely-`assigned` job could be paid out for unfinished work.
   * Fixed directly (not just flagged) since it's a real money-safety gap.
   */
  it("rejects settling a job whose manufacturing step is only assigned, not complete", async () => {
    const job = await createSettleableJob(false, false);

    await expect(createSettlement(tenantId, tailorId, { jobIds: [job.id] })).rejects.toMatchObject({
      status: 409,
      code: "JOB_NOT_COMPLETE",
    });

    const reloadedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(reloadedJob?.paid).toBe(false);
  });

  it("rejects a deductedAdvance greater than the tailor's outstanding advanceBalance", async () => {
    const job = await createSettleableJob(false);
    const tailor = await db.query.tailors.findFirst({ where: eq(tailors.id, tailorId) });
    if (!tailor) throw new Error("Expected tailor fixture");

    const tooMuch = Number(tailor.advanceBalance) + 100000;
    await expect(createSettlement(tenantId, tailorId, { jobIds: [job.id], deductedAdvance: tooMuch })).rejects.toMatchObject({
      status: 422,
      code: "ADVANCE_EXCEEDS_BALANCE",
    });

    const reloadedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
    expect(reloadedJob?.paid).toBe(false);
  });

  it("deducting an advance clears every outstanding worker_advance_payments row for the tailor and links payment_settlement_id — proving both previously-dead flags now work", async () => {
    const { advance: advanceOne } = await createAdvancePayment(tenantId, tailorId, 50);
    const { advance: advanceTwo, tailor: afterAdvances } = await createAdvancePayment(tenantId, tailorId, 30);
    advanceIds.push(advanceOne.id, advanceTwo.id);

    const outstandingBalance = Number(afterAdvances.advanceBalance);
    const job = await createSettleableJob(false);

    const settlement = await createSettlement(tenantId, tailorId, { jobIds: [job.id], deductedAdvance: 40 });
    settlementIds.push(settlement.id);

    expect(settlement.deductedAdvance).toBe("40.00");
    expect(settlement.totalPay).toBe((Number(settlement.subTotal) - 40).toFixed(2));

    const reloadedTailor = await db.query.tailors.findFirst({ where: eq(tailors.id, tailorId) });
    expect(Number(reloadedTailor!.advanceBalance)).toBeCloseTo(outstandingBalance - 40, 2);

    const reloadedAdvanceOne = await db.query.workerAdvancePayments.findFirst({ where: eq(workerAdvancePayments.id, advanceOne.id) });
    const reloadedAdvanceTwo = await db.query.workerAdvancePayments.findFirst({ where: eq(workerAdvancePayments.id, advanceTwo.id) });

    expect(reloadedAdvanceOne?.cleared).toBe(true);
    expect(reloadedAdvanceOne?.paymentSettlementId).toBe(settlement.id);
    expect(reloadedAdvanceOne?.clearedAt).not.toBeNull();

    expect(reloadedAdvanceTwo?.cleared).toBe(true);
    expect(reloadedAdvanceTwo?.paymentSettlementId).toBe(settlement.id);
    expect(reloadedAdvanceTwo?.clearedAt).not.toBeNull();

    // getSettlement enrichment: both cleared advances show up on the
    // settlement that cleared them — the settlement confirmation screen's
    // source for "which advances got cleared".
    const detail = await getSettlement(tenantId, tailorId, settlement.id);
    const clearedIds = detail.clearedAdvances.map((a) => a.id);
    expect(clearedIds).toEqual(expect.arrayContaining([advanceOne.id, advanceTwo.id]));
    expect(detail.clearedAdvances.every((a) => a.cleared)).toBe(true);
  });

  it("listUnpaidCompletedJobs returns only complete+unpaid jobs, enriched with process/component/product and approved-unpaid extra payments", async () => {
    const completedWithExtraPayment = await createSettleableJob();
    const extraPayment = await createExtraPayment(tenantId, completedWithExtraPayment.id, categoryId);
    await approveExtraPayment(tenantId, extraPayment.id);

    const completedNoExtraPayment = await createSettleableJob(false);

    const stillAssigned = await createSettleableJob(false, false);
    // Deliberately not completed — must not appear in the list.

    const alreadyPaid = await createSettleableJob(false);
    const paidSettlement = await createSettlement(tenantId, tailorId, { jobIds: [alreadyPaid.id] });
    settlementIds.push(paidSettlement.id);

    const list = await listUnpaidCompletedJobs(tenantId, tailorId);
    const listedIds = list.map((entry) => entry.job.id);

    expect(listedIds).toContain(completedWithExtraPayment.id);
    expect(listedIds).toContain(completedNoExtraPayment.id);
    expect(listedIds).not.toContain(stillAssigned.id);
    expect(listedIds).not.toContain(alreadyPaid.id);

    const withExtraEntry = list.find((entry) => entry.job.id === completedWithExtraPayment.id);
    expect(withExtraEntry?.process).toMatchObject({ name: `Payroll-Stitching-${suffix}` });
    expect(withExtraEntry?.component).toMatchObject({ slotLabel: "Main" });
    expect(withExtraEntry?.product).toMatchObject({ name: `PayrollTestProduct-${suffix}` });
    expect(withExtraEntry?.approvedUnpaidExtraPayments).toHaveLength(1);
    expect(withExtraEntry?.approvedUnpaidExtraPayments[0]).toMatchObject({ id: extraPayment.id, cost: "30.00" });

    const noExtraEntry = list.find((entry) => entry.job.id === completedNoExtraPayment.id);
    expect(noExtraEntry?.approvedUnpaidExtraPayments).toHaveLength(0);
  });

  it("listUnpaidCompletedJobs 404s for a bogus tailorId", async () => {
    await expect(listUnpaidCompletedJobs(tenantId, randomUUID())).rejects.toMatchObject({
      status: 404,
      code: "TAILOR_NOT_FOUND",
    });
  });

  it("listUnpaidCompletedJobs 404s listing another tenant's tailor — tenant isolation", async () => {
    await expect(listUnpaidCompletedJobs(tenantId, otherTenantTailorId)).rejects.toMatchObject({
      status: 404,
      code: "TAILOR_NOT_FOUND",
    });
  });

  it("404s cleanly for a bogus jobId in the settlement request", async () => {
    await expect(createSettlement(tenantId, tailorId, { jobIds: [randomUUID()] })).rejects.toMatchObject({
      status: 404,
      code: "JOB_NOT_FOUND",
    });
  });

  it("404s cleanly for a bogus tailorId", async () => {
    await expect(createAdvancePayment(tenantId, randomUUID(), 10)).rejects.toMatchObject({
      status: 404,
      code: "TAILOR_NOT_FOUND",
    });
  });

  it("HttpError is the rejection type used throughout", async () => {
    try {
      await createAdvancePayment(tenantId, randomUUID(), 10);
      throw new Error("expected createAdvancePayment to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
  });
});
