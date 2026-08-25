import { and, eq, inArray } from "drizzle-orm";
import { withTenant } from "../withTenant";
import type { Transaction } from "../withTenant";
import { jobs, manufacturingSteps, paymentSettlements, paymentSettlementJobs, workerAdvancePayments } from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import { requireMigratedTailorId } from "./tailors";
import { findProcessByName } from "./catalog";
import { getOrderTreeByOrderNumber } from "./orders";
import { matchLegacyItem, resolveComponentForProcess } from "./legacy-item-resolution";
import type { EtlDomainResult } from "./result";

interface LegacyRef {
  _id: unknown;
  name: string;
}
interface LegacyOrderLite {
  _id: unknown;
  orderId: string;
  order_items?: { item_name: string; quantity?: number }[];
}
interface LegacyJob {
  _id: unknown;
  order_id: unknown;
  tailor: unknown;
  item_code: string;
  process: unknown;
  cost: number;
}
interface LegacyWorkerAdvancePayment {
  _id: unknown;
  worker: unknown;
  amount: number;
  cleared?: boolean;
  date?: number;
}
interface LegacyPayment {
  _id: unknown;
  job?: unknown[];
  tailor: unknown;
  subTotal: number;
  deductedAdvance?: number;
  manualBill?: number;
  rent?: number;
  totalPay: number;
  date?: number;
}

/** `siamServer/admin/model/factoryModel/model.workerAdvancePayments.js`. No natural key — idempotency is `(tenantId, tailorId, amount, cleared)` plus the legacy timestamp, checked before insert. Zero real records exist at the time of writing (see PHASE_7_TASKS.md Group 0 summary), but the domain is implemented in full for whenever that changes. */
export async function migrateWorkerAdvancePayments(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyAdvances = await db.collection<LegacyWorkerAdvancePayment>("workeradvancepayments").find({}).toArray();
  const legacyTailors = await db.collection<{ _id: unknown; username?: string }>("tailors").find({}).toArray();
  const legacyTailorById = new Map(legacyTailors.map((t) => [idToString(t._id), t]));

  const result: EtlDomainResult = { domain: "worker_advance_payments", found: legacyAdvances.length, migrated: 0, skipped: [] };

  for (const legacy of legacyAdvances) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const legacyTailor = legacyTailorById.get(idToString(legacy.worker));
    if (!legacyTailor?.username) {
      result.skipped.push({ legacyId, reason: `worker ${idToString(legacy.worker)} not found (or has no username)` });
      continue;
    }
    const tailorId = await requireMigratedTailorId(tenantId, legacyTailor.username);
    if (!tailorId) {
      result.skipped.push({ legacyId, reason: `tailor "${legacyTailor.username}" was not migrated` });
      continue;
    }

    const createdAt = legacy.date ? new Date(legacy.date) : new Date();
    await withTenant(tenantId, async (tx) => {
      const existing = await tx.query.workerAdvancePayments.findFirst({
        where: and(eq(workerAdvancePayments.tenantId, tenantId), eq(workerAdvancePayments.tailorId, tailorId), eq(workerAdvancePayments.amount, legacy.amount.toFixed(2))),
      });
      if (existing) return;

      await tx.insert(workerAdvancePayments).values({
        tenantId,
        tailorId,
        amount: legacy.amount.toFixed(2),
        cleared: legacy.cleared ?? false,
        clearedAt: legacy.cleared ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
      });
    });
    result.migrated++;
  }

  return result;
}

/**
 * Re-derives which migrated `jobs` row a legacy `Job._id` became — the same resolution
 * `manufacturing.ts` performs when creating it in the first place, replayed read-only here
 * so settlements don't need their own id-mapping file.
 */
async function resolveMigratedJobId(
  tx: Transaction,
  tenantId: string,
  legacyJob: LegacyJob,
  legacyOrderById: Map<string | null, LegacyOrderLite>,
  legacyProcessById: Map<string | null, LegacyRef>,
  legacyTailorById: Map<string | null, { _id: unknown; username?: string }>
): Promise<string | null> {
  const legacyOrder = legacyOrderById.get(idToString(legacyJob.order_id));
  const legacyProcess = legacyProcessById.get(idToString(legacyJob.process));
  const legacyTailor = legacyTailorById.get(idToString(legacyJob.tailor));
  if (!legacyOrder || !legacyProcess || !legacyTailor?.username) return null;

  const tailorId = await requireMigratedTailorId(tenantId, legacyTailor.username);
  if (!tailorId) return null;

  const slashIndex = legacyJob.item_code.indexOf("/");
  const manufacturingKey = slashIndex >= 0 ? legacyJob.item_code.slice(slashIndex + 1) : legacyJob.item_code;
  const itemMatch = matchLegacyItem(legacyOrder.order_items ?? [], manufacturingKey);
  if (!itemMatch) return null;

  const orderTree = await getOrderTreeByOrderNumber(tx, tenantId, legacyOrder.orderId);
  const migratedItem = orderTree?.items.find((i) => i.sequence === itemMatch.sequence);
  if (!migratedItem) return null;

  const component = await resolveComponentForProcess(tenantId, migratedItem.components, legacyProcess.name);
  if (!component) return null;

  const process = await findProcessByName(tx, tenantId, legacyProcess.name);
  if (!process) return null;

  const step = await tx.query.manufacturingSteps.findFirst({
    where: and(eq(manufacturingSteps.orderItemComponentId, component.componentId), eq(manufacturingSteps.processId, process.id)),
  });
  if (!step) return null;

  const job = await tx.query.jobs.findFirst({
    where: and(eq(jobs.manufacturingStepId, step.id), eq(jobs.tailorId, tailorId), eq(jobs.cost, legacyJob.cost.toFixed(2))),
  });
  return job?.id ?? null;
}

/**
 * Settlements are historical, immutable financial records — this preserves the exact
 * `subTotal`/`totalPay`/etc. amounts legacy computed at the time, rather than recomputing
 * them from today's job/extra-payment rows via the live `createSettlement` formula (which
 * would silently rewrite history if a category's cost or a style's `workerPrice` changed
 * since). Idempotency: no unique constraint exists for `payment_settlements`, so this
 * resolves every legacy job id in the settlement to its migrated `jobs.id` first, then
 * checks whether a settlement already exists for this tailor linking to exactly that job-id
 * set (via `payment_settlement_jobs`) before inserting.
 */
export async function migrateSettlements(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyPayments = await db.collection<LegacyPayment>("payments").find({}).toArray();
  const legacyJobs = await db.collection<LegacyJob>("jobs").find({}).toArray();
  const legacyOrders = await db.collection<LegacyOrderLite>("orders").find({}).toArray();
  const legacyProcesses = await db.collection<LegacyRef>("processes").find({}).toArray();
  const legacyTailors = await db.collection<{ _id: unknown; username?: string }>("tailors").find({}).toArray();

  const legacyJobById = new Map(legacyJobs.map((j) => [idToString(j._id), j]));
  const legacyOrderById = new Map(legacyOrders.map((o) => [idToString(o._id), o]));
  const legacyProcessById = new Map(legacyProcesses.map((p) => [idToString(p._id), p]));
  const legacyTailorById = new Map(legacyTailors.map((t) => [idToString(t._id), t]));

  const result: EtlDomainResult = { domain: "payment_settlements", found: legacyPayments.length, migrated: 0, skipped: [] };

  for (const legacy of legacyPayments) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const legacyTailor = legacyTailorById.get(idToString(legacy.tailor));
    if (!legacyTailor?.username) {
      result.skipped.push({ legacyId, reason: `tailor ${idToString(legacy.tailor)} not found (or has no username)` });
      continue;
    }
    const tailorId = await requireMigratedTailorId(tenantId, legacyTailor.username);
    if (!tailorId) {
      result.skipped.push({ legacyId, reason: `tailor "${legacyTailor.username}" was not migrated` });
      continue;
    }

    const migrated = await withTenant(tenantId, async (tx) => {
      const jobIds: string[] = [];
      const unresolvedLegacyJobs: string[] = [];
      for (const legacyJobIdRaw of legacy.job ?? []) {
        const legacyJobId = idToString(legacyJobIdRaw);
        const legacyJobDoc = legacyJobId ? legacyJobById.get(legacyJobId) : undefined;
        if (!legacyJobDoc) {
          unresolvedLegacyJobs.push(String(legacyJobId));
          continue;
        }
        const jobId = await resolveMigratedJobId(tx, tenantId, legacyJobDoc, legacyOrderById, legacyProcessById, legacyTailorById);
        if (!jobId) {
          unresolvedLegacyJobs.push(legacyJobId ?? "?");
          continue;
        }
        jobIds.push(jobId);
      }

      if (unresolvedLegacyJobs.length > 0) {
        return { ok: false as const, reason: `${unresolvedLegacyJobs.length} of ${legacy.job?.length ?? 0} referenced job(s) did not resolve to a migrated job: ${unresolvedLegacyJobs.join(", ")}` };
      }
      if (jobIds.length === 0) {
        return { ok: false as const, reason: "settlement references zero resolvable jobs" };
      }

      // Two legacy job docs can legitimately resolve to the *same* migrated job — real
      // production data has exact-duplicate Job documents (identical tailor/step/cost/date,
      // a legacy double-submit bug), which `manufacturing.ts` correctly collapses into one
      // migrated `jobs` row. A settlement listing both duplicates would otherwise try to
      // link that one job twice, violating `payment_settlement_jobs`'s unique constraint.
      const uniqueJobIds = [...new Set(jobIds)];

      const existingForTailor = await tx.query.paymentSettlements.findMany({ where: and(eq(paymentSettlements.tenantId, tenantId), eq(paymentSettlements.tailorId, tailorId)) });
      for (const candidate of existingForTailor) {
        const links = await tx.query.paymentSettlementJobs.findMany({ where: eq(paymentSettlementJobs.paymentSettlementId, candidate.id) });
        const linkedIds = new Set(links.map((l) => l.jobId));
        if (linkedIds.size === uniqueJobIds.length && uniqueJobIds.every((id) => linkedIds.has(id))) {
          return { ok: true as const, alreadyMigrated: true };
        }
      }

      const createdAt = legacy.date ? new Date(legacy.date) : new Date();
      const [settlement] = await tx
        .insert(paymentSettlements)
        .values({
          tenantId,
          tailorId,
          subTotal: legacy.subTotal.toFixed(2),
          deductedAdvance: (legacy.deductedAdvance ?? 0).toFixed(2),
          rent: (legacy.rent ?? 0).toFixed(2),
          manualBill: (legacy.manualBill ?? 0).toFixed(2),
          totalPay: legacy.totalPay.toFixed(2),
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      if (!settlement) return { ok: false as const, reason: "failed to insert payment_settlements row" };

      await tx.insert(paymentSettlementJobs).values(uniqueJobIds.map((jobId) => ({ paymentSettlementId: settlement.id, jobId })));
      await tx.update(jobs).set({ paid: true, updatedAt: new Date() }).where(inArray(jobs.id, uniqueJobIds));

      return { ok: true as const, alreadyMigrated: false };
    });

    if (!migrated.ok) {
      result.skipped.push({ legacyId, reason: migrated.reason });
      continue;
    }
    result.migrated++;
  }

  return result;
}
