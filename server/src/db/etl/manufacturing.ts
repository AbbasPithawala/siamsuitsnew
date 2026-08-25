import { and, eq } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { jobs, manufacturingSteps } from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import { requireMigratedTailorId } from "./tailors";
import { findProcessByName } from "./catalog";
import { getOrderTreeByOrderNumber } from "./orders";
import { matchLegacyItem, resolveComponentForProcess } from "./legacy-item-resolution";
import type { EtlDomainResult } from "./result";

interface LegacyOrderItemLite {
  item_name: string;
  quantity?: number;
}
interface LegacyOrderLite {
  _id: unknown;
  orderId: string;
  order_items?: LegacyOrderItemLite[];
}
interface LegacyProcessLite {
  _id: unknown;
  name: string;
}
interface LegacyTailorLite {
  _id: unknown;
  username?: string;
}
interface LegacyJob {
  _id: unknown;
  order_id: unknown;
  tailor: unknown;
  item_code: string;
  process: unknown;
  cost: number;
  stylingprice?: Record<string, number>;
  status?: boolean;
  paid?: boolean;
  paidDate?: number;
  date?: number;
}

/**
 * The legacy `orders.manufacturing` blob is a denormalized, occasionally-corrupted cache
 * (production data has at least one `"[object Object]"` process key — a real bug artifact,
 * not parseable to any process). The legacy `jobs` collection is the authoritative source
 * for real manufacturing history instead: every real assignment/completion has a clean
 * `process` ObjectId (no string-parsing needed) plus tailor/cost/status/dates. So this
 * module drives `manufacturing_steps` status entirely from `jobs`, not from the blob — a
 * step with no matching legacy job simply stays "pending" (its default from `orders.ts`),
 * which is correct: a step that was never assigned never got a legacy Job document either.
 *
 * `item_code` is `"<orderNumber>/<manufacturingKey>"` (the same `orderId/itemKey` string
 * `REWRITE_ARCHITECTURE.md`'s QR-redesign note describes). `manufacturingKey`'s shape is
 * unreliable middle-segment-wise (e.g. a tuxedo's jacket-slot key is sometimes
 * `tuxedo_jacket_0`, sometimes `tuxedo_tuxedojacket_0` in real data), so this resolves the
 * *item* by prefix/suffix match on the legacy `item_name` (`manufacturingKey` starts with
 * `"<item_name>_"` and ends with `"_<occurrence index>"`), then resolves *which component*
 * of a bundled item (Suit/Tuxedo) by checking which component's `product_processes` the
 * job's own (clean, ObjectId-referenced) process actually belongs to — never by parsing the
 * key's middle segment.
 */
export async function migrateManufacturingJobs(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyJobs = await db.collection<LegacyJob>("jobs").find({}).toArray();
  const legacyOrders = await db.collection<LegacyOrderLite>("orders").find({}).toArray();
  const legacyProcesses = await db.collection<LegacyProcessLite>("processes").find({}).toArray();
  const legacyTailors = await db.collection<LegacyTailorLite>("tailors").find({}).toArray();

  const legacyOrderById = new Map(legacyOrders.map((o) => [idToString(o._id), o]));
  const legacyProcessById = new Map(legacyProcesses.map((p) => [idToString(p._id), p]));
  const legacyTailorById = new Map(legacyTailors.map((t) => [idToString(t._id), t]));

  const result: EtlDomainResult = { domain: "manufacturing_jobs", found: legacyJobs.length, migrated: 0, skipped: [] };
  const orderTreeCache = new Map<string, Awaited<ReturnType<typeof getOrderTreeByOrderNumber>>>();

  for (const legacyJob of legacyJobs) {
    const legacyId = idToString(legacyJob._id) ?? "(no _id)";

    const legacyOrder = legacyOrderById.get(idToString(legacyJob.order_id));
    if (!legacyOrder) {
      result.skipped.push({ legacyId, reason: `order_id ${idToString(legacyJob.order_id)} not found in legacy orders` });
      continue;
    }
    const orderNumber = legacyOrder.orderId;

    const legacyProcess = legacyProcessById.get(idToString(legacyJob.process));
    if (!legacyProcess) {
      result.skipped.push({ legacyId, reason: `process ${idToString(legacyJob.process)} not found in legacy processes` });
      continue;
    }

    const legacyTailor = legacyTailorById.get(idToString(legacyJob.tailor));
    if (!legacyTailor?.username) {
      result.skipped.push({ legacyId, reason: `tailor ${idToString(legacyJob.tailor)} not found in legacy tailors (or has no username)` });
      continue;
    }
    const tailorId = await requireMigratedTailorId(tenantId, legacyTailor.username);
    if (!tailorId) {
      result.skipped.push({ legacyId, reason: `tailor "${legacyTailor.username}" was not migrated` });
      continue;
    }

    const slashIndex = legacyJob.item_code.indexOf("/");
    const manufacturingKey = slashIndex >= 0 ? legacyJob.item_code.slice(slashIndex + 1) : legacyJob.item_code;

    const itemMatch = matchLegacyItem(legacyOrder.order_items ?? [], manufacturingKey);
    if (!itemMatch) {
      result.skipped.push({ legacyId, reason: `item_code "${legacyJob.item_code}" did not resolve to any order item on order ${orderNumber}` });
      continue;
    }

    let orderTree = orderTreeCache.get(orderNumber);
    if (orderTree === undefined) {
      orderTree = await withTenant(tenantId, (tx) => getOrderTreeByOrderNumber(tx, tenantId, orderNumber));
      orderTreeCache.set(orderNumber, orderTree);
    }
    if (!orderTree) {
      result.skipped.push({ legacyId, reason: `order ${orderNumber} was not migrated (or is missing) — cannot resolve its components` });
      continue;
    }

    const migratedItem = orderTree.items.find((i) => i.sequence === itemMatch.sequence);
    if (!migratedItem) {
      result.skipped.push({ legacyId, reason: `order ${orderNumber} has no migrated item at sequence ${itemMatch.sequence}` });
      continue;
    }

    const component = await resolveComponentForProcess(tenantId, migratedItem.components, legacyProcess.name);
    if (!component) {
      result.skipped.push({
        legacyId,
        reason: `process "${legacyProcess.name}" doesn't belong to any component of order ${orderNumber}'s item at sequence ${itemMatch.sequence}`,
      });
      continue;
    }

    const migrated = await withTenant(tenantId, async (tx) => {
      const process = await findProcessByName(tx, tenantId, legacyProcess.name);
      if (!process) return { ok: false as const, reason: `no catalog process named "${legacyProcess.name}"` };

      const step = await tx.query.manufacturingSteps.findFirst({
        where: and(eq(manufacturingSteps.orderItemComponentId, component.componentId), eq(manufacturingSteps.processId, process.id)),
      });
      if (!step) return { ok: false as const, reason: `no manufacturing_steps row for component/process "${legacyProcess.name}"` };

      const legacyCreatedAt = legacyJob.date ? new Date(legacyJob.date) : new Date();
      const existingJob = await tx.query.jobs.findFirst({
        where: and(eq(jobs.manufacturingStepId, step.id), eq(jobs.tailorId, tailorId), eq(jobs.cost, legacyJob.cost.toFixed(2))),
      });
      if (existingJob) return { ok: true as const, alreadyMigrated: true };

      const stylingPrice = Object.values(legacyJob.stylingprice ?? {}).reduce((sum, v) => sum + Number(v), 0);
      const isComplete = legacyJob.status === true;

      const [job] = await tx
        .insert(jobs)
        .values({
          tenantId,
          manufacturingStepId: step.id,
          tailorId,
          cost: legacyJob.cost.toFixed(2),
          stylingPrice: stylingPrice.toFixed(2),
          paid: legacyJob.paid ?? false,
          paidDate: legacyJob.paidDate ? new Date(legacyJob.paidDate) : null,
          createdAt: legacyCreatedAt,
          updatedAt: legacyCreatedAt,
        })
        .returning();
      if (!job) return { ok: false as const, reason: "failed to insert jobs row" };

      await tx
        .update(manufacturingSteps)
        .set({
          status: isComplete ? "complete" : "assigned",
          tailorId,
          startedAt: legacyCreatedAt,
          completedAt: isComplete ? (legacyJob.paidDate ? new Date(legacyJob.paidDate) : legacyCreatedAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(manufacturingSteps.id, step.id));

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
