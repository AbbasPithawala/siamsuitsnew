import { and, eq, inArray } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import {
  tailors,
  jobs,
  manufacturingSteps,
  orderItemComponents,
  orderItems,
  orders,
  processes,
  products,
  extraPayments,
  extraPaymentCategories,
  workerAdvancePayments,
  paymentSettlements,
  paymentSettlementJobs,
} from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireTailor } from "./manufacturing-helpers";
import { requireOwnedJob } from "./extra-payments.service";

type JobRow = typeof jobs.$inferSelect;
type ExtraPaymentRow = typeof extraPayments.$inferSelect;

/**
 * Shared by `listUnpaidCompletedJobs` and `getSettlement` (and — exported —
 * `jobSlipPdf.service.ts`'s single-job receipt slip) — all three need the
 * same job → step → component → product → order walk to render a meaningful
 * row, just for a different set of `jobRows`. `stepById` is passed in rather
 * than looked up here since every caller already needs their own copy of it
 * for other filtering first.
 */
export async function buildJobDisplayEntries(
  tx: Transaction,
  jobRows: JobRow[],
  stepById: Map<string, typeof manufacturingSteps.$inferSelect>
) {
  const componentIds = [...new Set(jobRows.map((j) => stepById.get(j.manufacturingStepId)!.orderItemComponentId))];
  const componentRows = componentIds.length
    ? await tx.query.orderItemComponents.findMany({ where: inArray(orderItemComponents.id, componentIds) })
    : [];
  const componentById = new Map(componentRows.map((c) => [c.id, c]));

  const processIds = [...new Set(jobRows.map((j) => stepById.get(j.manufacturingStepId)!.processId))];
  const processRows = processIds.length ? await tx.query.processes.findMany({ where: inArray(processes.id, processIds) }) : [];
  const processById = new Map(processRows.map((p) => [p.id, p]));

  const productIds = [...new Set(componentRows.map((c) => c.productId))];
  const productRows = productIds.length ? await tx.query.products.findMany({ where: inArray(products.id, productIds) }) : [];
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const orderItemIds = [...new Set(componentRows.map((c) => c.orderItemId))];
  const orderItemRows = orderItemIds.length ? await tx.query.orderItems.findMany({ where: inArray(orderItems.id, orderItemIds) }) : [];
  const orderItemById = new Map(orderItemRows.map((oi) => [oi.id, oi]));

  const orderIds = [...new Set(orderItemRows.map((oi) => oi.orderId))];
  const orderRows = orderIds.length ? await tx.query.orders.findMany({ where: inArray(orders.id, orderIds) }) : [];
  const orderById = new Map(orderRows.map((o) => [o.id, o]));

  return jobRows.map((job) => {
    const step = stepById.get(job.manufacturingStepId)!;
    const component = componentById.get(step.orderItemComponentId) ?? null;
    const process = processById.get(step.processId) ?? null;
    const product = component ? (productById.get(component.productId) ?? null) : null;
    const orderItem = component ? (orderItemById.get(component.orderItemId) ?? null) : null;
    const order = orderItem ? (orderById.get(orderItem.orderId) ?? null) : null;

    return {
      job,
      step,
      process: process ? { id: process.id, name: process.name, thaiName: process.thaiName } : null,
      component: component ? { id: component.id, slotLabel: component.slotLabel, orderItemId: component.orderItemId } : null,
      product: product ? { id: product.id, name: product.name } : null,
      order: order ? { id: order.id, orderNumber: order.orderNumber } : null,
    };
  });
}

/** Shared (exported) — attaches each extra payment's category (name/Thai name) so a UI can show *what* THB 20 was for, not just the bare amount. */
export async function enrichExtraPaymentsWithCategory(tx: Transaction, extraPaymentRows: ExtraPaymentRow[]) {
  const categoryIds = [...new Set(extraPaymentRows.map((ep) => ep.categoryId))];
  const categoryRows = categoryIds.length
    ? await tx.query.extraPaymentCategories.findMany({ where: inArray(extraPaymentCategories.id, categoryIds) })
    : [];
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  return extraPaymentRows.map((extraPayment) => {
    const category = categoryById.get(extraPayment.categoryId) ?? null;
    return { ...extraPayment, category: category ? { id: category.id, name: category.name, thaiName: category.thaiName } : null };
  });
}

/**
 * The read Group 8 (PHASE_6_TASKS.md) found missing while scoping the
 * settlement screen: nothing anywhere (`payroll.service.ts` only had
 * `createAdvancePayment`/`createSettlement`/`getSettlement`,
 * `manufacturing.service.ts` has no tailor-scoped job list either) let a
 * caller see which of a tailor's jobs are actually eligible to settle. A job
 * is settleable once its underlying `manufacturing_steps` row is `complete`
 * (unlike `paid`, "complete" isn't a column on `jobs` itself — it lives on
 * the step the job points at) and `jobs.paid` is still `false`. Enriches each
 * job with just enough of its component/process/product/order to render a
 * meaningful settlement-selection row, plus the same approved-and-unpaid
 * `extraPayments` `createSettlement` will fold into `subTotal` — shown here
 * only as a preview; the actual settlement total is still always
 * server-computed at settlement time, never trusted from this read.
 */
export async function listUnpaidCompletedJobs(tenantId: string, tailorId: string) {
  return withTenant(tenantId, async (tx) => {
    const tailor = await requireTailor(tx, tailorId);

    const jobRows = await tx.query.jobs.findMany({
      where: and(eq(jobs.tailorId, tailor.id), eq(jobs.paid, false)),
      orderBy: (j, { asc }) => asc(j.createdAt),
    });
    if (jobRows.length === 0) return [];

    const stepIds = jobRows.map((j) => j.manufacturingStepId);
    const stepRows = await tx.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.id, stepIds) });
    const stepById = new Map(stepRows.map((s) => [s.id, s]));

    const completeJobs = jobRows.filter((j) => stepById.get(j.manufacturingStepId)?.status === "complete");
    if (completeJobs.length === 0) return [];

    const entries = await buildJobDisplayEntries(tx, completeJobs, stepById);

    const jobIds = completeJobs.map((j) => j.id);
    const settleableExtraPayments = await tx.query.extraPayments.findMany({
      where: and(inArray(extraPayments.jobId, jobIds), eq(extraPayments.approved, true), eq(extraPayments.paid, false)),
    });
    const enrichedExtraPayments = await enrichExtraPaymentsWithCategory(tx, settleableExtraPayments);
    const extraPaymentsByJobId = new Map<string, typeof enrichedExtraPayments>();
    for (const extraPayment of enrichedExtraPayments) {
      const existing = extraPaymentsByJobId.get(extraPayment.jobId) ?? [];
      existing.push(extraPayment);
      extraPaymentsByJobId.set(extraPayment.jobId, existing);
    }

    return entries.map((entry) => ({ ...entry, approvedUnpaidExtraPayments: extraPaymentsByJobId.get(entry.job.id) ?? [] }));
  });
}

/**
 * Records a cash advance and increments the tailor's running `advanceBalance` in the
 * same transaction, so the ledger row and the balance can never drift apart.
 */
export async function createAdvancePayment(tenantId: string, tailorId: string, amount: number) {
  return withTenant(tenantId, async (tx) => {
    const tailor = await requireTailor(tx, tailorId);

    const [advance] = await tx
      .insert(workerAdvancePayments)
      .values({ tenantId, tailorId: tailor.id, amount: amount.toFixed(2) })
      .returning();
    if (!advance) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create advance payment");

    const [updatedTailor] = await tx
      .update(tailors)
      .set({ advanceBalance: (Number(tailor.advanceBalance) + amount).toFixed(2), updatedAt: new Date() })
      .where(eq(tailors.id, tailor.id))
      .returning();
    if (!updatedTailor) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update tailor advance balance");

    return { advance, tailor: updatedTailor };
  });
}

export interface CreateSettlementInput {
  jobIds: string[];
  rent?: number;
  manualBill?: number;
  deductedAdvance?: number;
}

/**
 * Server-computed, immutable payroll settlement (PHASE_3_TASKS.md Group 6) — the legacy
 * system trusted a client-submitted `subTotal`/`totalPay`; here the client only supplies a
 * tailor, the unpaid job ids to settle, and the `rent`/`manualBill`/`deductedAdvance`
 * inputs, and every amount is recomputed from the real `jobs`/`extraPayments` rows.
 *
 * `subTotal = sum(job.cost + job.stylingPrice) + sum(cost of each job's approved, unpaid
 * extraPayments)`. An unapproved extra payment is simply excluded from the sum — it isn't
 * an error, since it can still be included in a later settlement once approved.
 *
 * Every job id is validated (ownership walk identical to `manufacturing.service.ts`'s,
 * via `requireOwnedJob`, plus a same-tailor and not-already-paid check) *before* any
 * write happens; a single bad id fails the whole request rather than being silently
 * skipped, since all reads happen up front and the write phase only starts once every
 * job has passed.
 */
export async function createSettlement(tenantId: string, tailorId: string, input: CreateSettlementInput) {
  return withTenant(tenantId, async (tx) => {
    const tailor = await requireTailor(tx, tailorId);

    const jobIds = [...new Set(input.jobIds)];
    if (jobIds.length === 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "At least one job id is required");
    }

    const rent = input.rent ?? 0;
    const manualBill = input.manualBill ?? 0;
    const deductedAdvance = input.deductedAdvance ?? 0;

    if (deductedAdvance > Number(tailor.advanceBalance)) {
      throw new HttpError(
        422,
        "ADVANCE_EXCEEDS_BALANCE",
        `Deducted advance ${deductedAdvance} exceeds tailor ${tailorId}'s outstanding balance ${tailor.advanceBalance}`
      );
    }

    const jobRows = [];
    for (const jobId of jobIds) {
      const { job, step } = await requireOwnedJob(tx, tenantId, jobId);
      if (job.tailorId !== tailor.id) {
        throw new HttpError(422, "JOB_TAILOR_MISMATCH", `Job ${jobId} does not belong to tailor ${tailorId}`);
      }
      if (job.paid) {
        throw new HttpError(409, "JOB_ALREADY_PAID", `Job ${jobId} is already paid`);
      }
      if (step.status !== "complete") {
        throw new HttpError(409, "JOB_NOT_COMPLETE", `Job ${jobId}'s manufacturing step is not complete (status: ${step.status})`);
      }
      jobRows.push(job);
    }

    const settleableExtraPayments = await tx.query.extraPayments.findMany({
      where: and(inArray(extraPayments.jobId, jobIds), eq(extraPayments.approved, true), eq(extraPayments.paid, false)),
    });

    const jobTotal = jobRows.reduce((sum, job) => sum + Number(job.cost) + Number(job.stylingPrice), 0);
    const extraPaymentTotal = settleableExtraPayments.reduce((sum, ep) => sum + Number(ep.cost), 0);
    const subTotal = jobTotal + extraPaymentTotal;
    const totalPay = subTotal + manualBill + rent - deductedAdvance;

    const [settlement] = await tx
      .insert(paymentSettlements)
      .values({
        tenantId,
        tailorId: tailor.id,
        subTotal: subTotal.toFixed(2),
        deductedAdvance: deductedAdvance.toFixed(2),
        rent: rent.toFixed(2),
        manualBill: manualBill.toFixed(2),
        totalPay: totalPay.toFixed(2),
      })
      .returning();
    if (!settlement) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create settlement");

    await tx.insert(paymentSettlementJobs).values(jobIds.map((jobId) => ({ paymentSettlementId: settlement.id, jobId })));

    await tx
      .update(jobs)
      .set({ paid: true, paidDate: new Date(), updatedAt: new Date() })
      .where(inArray(jobs.id, jobIds));

    if (settleableExtraPayments.length > 0) {
      await tx
        .update(extraPayments)
        .set({ paid: true, paidDate: new Date(), updatedAt: new Date() })
        .where(inArray(extraPayments.id, settleableExtraPayments.map((ep) => ep.id)));
    }

    if (deductedAdvance > 0) {
      await tx
        .update(tailors)
        .set({ advanceBalance: (Number(tailor.advanceBalance) - deductedAdvance).toFixed(2), updatedAt: new Date() })
        .where(eq(tailors.id, tailor.id));

      // Deliberate simplification, not per-record partial-amount tracking (PHASE_3_TASKS.md
      // Group 6): the legacy system only ever tracked one running advance balance with no
      // per-record precision either — there was never a concept of "this settlement cleared
      // exactly $X of advance record #7". So there's nothing more precise to reconstruct
      // here: every currently-outstanding (`cleared: false`) advance row for this tailor is
      // marked cleared and linked to this settlement, even though `deductedAdvance` need not
      // equal the sum of the individual amounts being marked cleared. This settlement event
      // is what "accounts for" the advance ledger at this point in time.
      await tx
        .update(workerAdvancePayments)
        .set({ cleared: true, clearedAt: new Date(), paymentSettlementId: settlement.id, updatedAt: new Date() })
        .where(and(eq(workerAdvancePayments.tailorId, tailor.id), eq(workerAdvancePayments.cleared, false)));
    }

    return settlement;
  });
}

/**
 * Fetches a settlement's full detail (its jobs, the amounts computed for it,
 * and — PHASE_6_TASKS.md Group 8's UI requirement that the settlement
 * confirmation screen visibly reflect the `worker_advance_payments.cleared`/
 * `extra_payments.paid` flags `createSettlement` flips — the specific
 * advance and extra-payment rows that settlement actually cleared/paid.
 * Both are trivial reads off FKs `createSettlement` already sets
 * (`workerAdvancePayments.paymentSettlementId`, and `extraPayments.paid` for
 * this settlement's own job ids — safe to key off `paid` alone here rather
 * than a settlement-id FK of its own, since a job can only ever be settled
 * once, `createSettlement`'s `JOB_ALREADY_PAID` check enforces that), not a
 * new endpoint — this enriches the existing `GET .../settlements/:id`
 * response rather than adding another route.
 */
export async function getSettlement(tenantId: string, tailorId: string, settlementId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireTailor(tx, tailorId);

    const settlement = await tx.query.paymentSettlements.findFirst({
      where: and(eq(paymentSettlements.id, settlementId), eq(paymentSettlements.tailorId, tailorId)),
    });
    if (!settlement) throw new HttpError(404, "SETTLEMENT_NOT_FOUND", `Settlement ${settlementId} not found`);

    const settlementJobs = await tx.query.paymentSettlementJobs.findMany({
      where: eq(paymentSettlementJobs.paymentSettlementId, settlement.id),
    });
    const jobIds = settlementJobs.map((sj) => sj.jobId);
    const jobRows = jobIds.length ? await tx.query.jobs.findMany({ where: inArray(jobs.id, jobIds) }) : [];

    const stepIds = [...new Set(jobRows.map((j) => j.manufacturingStepId))];
    const stepRows = stepIds.length ? await tx.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.id, stepIds) }) : [];
    const stepById = new Map(stepRows.map((s) => [s.id, s]));
    const jobEntries = jobRows.length ? await buildJobDisplayEntries(tx, jobRows, stepById) : [];

    const paidExtraPayments = jobIds.length
      ? await tx.query.extraPayments.findMany({ where: and(inArray(extraPayments.jobId, jobIds), eq(extraPayments.paid, true)) })
      : [];
    const enrichedExtraPayments = await enrichExtraPaymentsWithCategory(tx, paidExtraPayments);

    const clearedAdvances = await tx.query.workerAdvancePayments.findMany({
      where: eq(workerAdvancePayments.paymentSettlementId, settlement.id),
    });

    return { settlement, jobs: jobEntries, extraPayments: enrichedExtraPayments, clearedAdvances };
  });
}

/**
 * Lists a tailor's past settlements, newest first — the read
 * `WorkerPaymentHistoryPage.tsx` needs (legacy `WorkPaymentHistory.jsx`'s
 * equivalent) and the API never had; `getSettlement` above only ever fetched
 * one settlement at a time, by an id the caller already had to already know.
 */
export async function listSettlements(tenantId: string, tailorId: string) {
  return withTenant(tenantId, async (tx) => {
    const tailor = await requireTailor(tx, tailorId);
    return tx.query.paymentSettlements.findMany({
      where: eq(paymentSettlements.tailorId, tailor.id),
      orderBy: (s, { desc }) => desc(s.createdAt),
    });
  });
}
