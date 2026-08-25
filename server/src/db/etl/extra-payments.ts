import { and, eq, isNull } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { extraPaymentCategories, extraPayments, jobs, manufacturingSteps } from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import { requireMigratedTailorId } from "./tailors";
import { requireProductByName, findProcessByName, findCandidateFeaturesForProduct, findStyleForFeature } from "./catalog";
import { getOrderTreeByOrderNumber } from "./orders";
import { matchLegacyItem, resolveComponentForProcess } from "./legacy-item-resolution";
import type { EtlDomainResult } from "./result";

interface LegacyRef {
  _id: unknown;
  name: string;
}
interface LegacyExtraPaymentCategory {
  _id: unknown;
  name: string;
  thai_name?: string;
  product?: unknown;
  feature?: unknown;
  style?: unknown;
  process?: unknown;
  cost?: string | number;
}
interface LegacyExtraPayment {
  _id: unknown;
  order_id: unknown;
  tailor: unknown;
  item_code: string;
  extraPaymentCategory: unknown;
  cost: number;
  approved?: boolean;
  paid?: boolean;
  paidDate?: number;
  date?: number;
}
interface LegacyOrderLite {
  _id: unknown;
  orderId: string;
  order_items?: { item_name: string; quantity?: number }[];
}

/**
 * Migrates `extrapaymentcategories` (admin-defined bonus templates) first, then
 * `extrapayments` (bonuses actually awarded on a job) — the categories a payment references
 * have to exist first. No unique constraint exists for `extra_payment_categories` in the new
 * schema (real legacy data has genuine near-duplicates, e.g. two "Pant Back Pocket"
 * categories at different costs for different styles), so idempotency here is a natural
 * composite-key lookup on `(productId, processId, featureId, styleId, name)`.
 */
export async function migrateExtraPaymentCategories(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyCategories = await db.collection<LegacyExtraPaymentCategory>("extrapaymentcategories").find({}).toArray();
  const legacyProducts = await db.collection<LegacyRef>("products").find({}).toArray();
  const legacyFeatures = await db.collection<LegacyRef>("features").find({}).toArray();
  const legacyStyles = await db.collection<LegacyRef>("styles").find({}).toArray();
  const legacyProcesses = await db.collection<LegacyRef>("processes").find({}).toArray();

  const productById = new Map(legacyProducts.map((p) => [idToString(p._id), p]));
  const featureById = new Map(legacyFeatures.map((f) => [idToString(f._id), f]));
  const styleById = new Map(legacyStyles.map((s) => [idToString(s._id), s]));
  const processById = new Map(legacyProcesses.map((p) => [idToString(p._id), p]));

  const result: EtlDomainResult = { domain: "extra_payment_categories", found: legacyCategories.length, migrated: 0, skipped: [] };

  for (const legacy of legacyCategories) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";

    const legacyProduct = productById.get(idToString(legacy.product));
    const legacyProcess = processById.get(idToString(legacy.process));
    if (!legacyProduct || !legacyProcess) {
      result.skipped.push({ legacyId, reason: `missing/unresolvable product (${idToString(legacy.product)}) or process (${idToString(legacy.process)})` });
      continue;
    }

    const migrated = await withTenant(tenantId, async (tx) => {
      let product;
      try {
        product = await requireProductByName(tx, tenantId, legacyProduct.name);
      } catch {
        return { ok: false as const, reason: `no catalog product named "${legacyProduct.name}"` };
      }
      const process = await findProcessByName(tx, tenantId, legacyProcess.name);
      if (!process) return { ok: false as const, reason: `no catalog process named "${legacyProcess.name}"` };

      let featureId: string | null = null;
      let styleId: string | null = null;
      const legacyFeature = legacy.feature ? featureById.get(idToString(legacy.feature)) : undefined;
      if (legacyFeature) {
        const candidates = await findCandidateFeaturesForProduct(tx, tenantId, product.id, legacyFeature.name);
        const legacyStyle = legacy.style ? styleById.get(idToString(legacy.style)) : undefined;
        for (const candidate of candidates) {
          if (!candidate) continue;
          if (!legacyStyle) {
            featureId = candidate.id;
            break;
          }
          const match = await findStyleForFeature(tx, candidate.id, legacyStyle.name);
          if (match) {
            featureId = candidate.id;
            styleId = match.style.id;
            break;
          }
        }
        if (!featureId) {
          return { ok: false as const, reason: `feature "${legacyFeature.name}"${legacyStyle ? ` / style "${legacyStyle.name}"` : ""} not found on product "${legacyProduct.name}"` };
        }
      }

      const existing = await tx.query.extraPaymentCategories.findFirst({
        where: and(
          eq(extraPaymentCategories.tenantId, tenantId),
          eq(extraPaymentCategories.productId, product.id),
          eq(extraPaymentCategories.processId, process.id),
          eq(extraPaymentCategories.name, legacy.name),
          featureId ? eq(extraPaymentCategories.featureId, featureId) : isNull(extraPaymentCategories.featureId),
          styleId ? eq(extraPaymentCategories.styleId, styleId) : isNull(extraPaymentCategories.styleId),
          isNull(extraPaymentCategories.deletedAt)
        ),
      });
      if (existing) return { ok: true as const };

      await tx.insert(extraPaymentCategories).values({
        tenantId,
        productId: product.id,
        processId: process.id,
        featureId,
        styleId,
        name: legacy.name,
        thaiName: legacy.thai_name ?? null,
        cost: String(legacy.cost ?? 0),
      });
      return { ok: true as const };
    });

    if (!migrated.ok) {
      result.skipped.push({ legacyId, reason: migrated.reason });
      continue;
    }
    result.migrated++;
  }

  return result;
}

/**
 * Resolves a migrated category back from its legacy id, by re-running the exact same
 * resolution `migrateExtraPaymentCategories` used — avoids a second mapping file for what's
 * otherwise a fully natural-key-derivable lookup.
 */
async function resolveMigratedCategoryId(tenantId: string, legacy: LegacyExtraPaymentCategory, legacyLookups: LegacyCategoryLookups): Promise<string | null> {
  const legacyProduct = legacyLookups.productById.get(idToString(legacy.product));
  const legacyProcess = legacyLookups.processById.get(idToString(legacy.process));
  if (!legacyProduct || !legacyProcess) return null;

  return withTenant(tenantId, async (tx) => {
    let product;
    try {
      product = await requireProductByName(tx, tenantId, legacyProduct.name);
    } catch {
      return null;
    }
    const process = await findProcessByName(tx, tenantId, legacyProcess.name);
    if (!process) return null;

    let featureId: string | null = null;
    let styleId: string | null = null;
    const legacyFeature = legacy.feature ? legacyLookups.featureById.get(idToString(legacy.feature)) : undefined;
    if (legacyFeature) {
      const candidates = await findCandidateFeaturesForProduct(tx, tenantId, product.id, legacyFeature.name);
      const legacyStyle = legacy.style ? legacyLookups.styleById.get(idToString(legacy.style)) : undefined;
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (!legacyStyle) {
          featureId = candidate.id;
          break;
        }
        const match = await findStyleForFeature(tx, candidate.id, legacyStyle.name);
        if (match) {
          featureId = candidate.id;
          styleId = match.style.id;
          break;
        }
      }
      if (!featureId) return null;
    }

    const existing = await tx.query.extraPaymentCategories.findFirst({
      where: and(
        eq(extraPaymentCategories.tenantId, tenantId),
        eq(extraPaymentCategories.productId, product.id),
        eq(extraPaymentCategories.processId, process.id),
        eq(extraPaymentCategories.name, legacy.name),
        featureId ? eq(extraPaymentCategories.featureId, featureId) : isNull(extraPaymentCategories.featureId),
        styleId ? eq(extraPaymentCategories.styleId, styleId) : isNull(extraPaymentCategories.styleId)
      ),
    });
    return existing?.id ?? null;
  });
}

interface LegacyCategoryLookups {
  productById: Map<string | null, LegacyRef>;
  featureById: Map<string | null, LegacyRef>;
  styleById: Map<string | null, LegacyRef>;
  processById: Map<string | null, LegacyRef>;
}

/**
 * Extra payments reference a job only indirectly (`order_id` + `item_code` + the category's
 * own `process`) — resolved the same way `manufacturing.ts` resolves a job's component, then
 * matched to the specific migrated `jobs` row for that step/tailor. `(jobId, categoryId)` is
 * a real unique index on `extra_payments` — the natural idempotency key.
 */
export async function migrateExtraPayments(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyExtraPayments = await db.collection<LegacyExtraPayment>("extrapayments").find({}).toArray();
  const legacyOrders = await db.collection<LegacyOrderLite>("orders").find({}).toArray();
  const legacyCategories = await db.collection<LegacyExtraPaymentCategory>("extrapaymentcategories").find({}).toArray();
  const legacyProcesses = await db.collection<LegacyRef>("processes").find({}).toArray();
  const legacyTailors = await db.collection<{ _id: unknown; username?: string }>("tailors").find({}).toArray();

  const lookups: LegacyCategoryLookups = {
    productById: new Map((await db.collection<LegacyRef>("products").find({}).toArray()).map((p) => [idToString(p._id), p])),
    featureById: new Map((await db.collection<LegacyRef>("features").find({}).toArray()).map((f) => [idToString(f._id), f])),
    styleById: new Map((await db.collection<LegacyRef>("styles").find({}).toArray()).map((s) => [idToString(s._id), s])),
    processById: new Map(legacyProcesses.map((p) => [idToString(p._id), p])),
  };

  const legacyOrderById = new Map(legacyOrders.map((o) => [idToString(o._id), o]));
  const legacyCategoryById = new Map(legacyCategories.map((c) => [idToString(c._id), c]));
  const legacyTailorById = new Map(legacyTailors.map((t) => [idToString(t._id), t]));

  const result: EtlDomainResult = { domain: "extra_payments", found: legacyExtraPayments.length, migrated: 0, skipped: [] };
  const orderTreeCache = new Map<string, Awaited<ReturnType<typeof getOrderTreeByOrderNumber>>>();

  for (const legacy of legacyExtraPayments) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";

    const legacyOrder = legacyOrderById.get(idToString(legacy.order_id));
    if (!legacyOrder) {
      result.skipped.push({ legacyId, reason: `order_id ${idToString(legacy.order_id)} not found in legacy orders` });
      continue;
    }
    const legacyCategory = legacyCategoryById.get(idToString(legacy.extraPaymentCategory));
    if (!legacyCategory) {
      result.skipped.push({ legacyId, reason: `extraPaymentCategory ${idToString(legacy.extraPaymentCategory)} not found in legacy categories` });
      continue;
    }
    const legacyProcess = lookups.processById.get(idToString(legacyCategory.process));
    if (!legacyProcess) {
      result.skipped.push({ legacyId, reason: `category's process ${idToString(legacyCategory.process)} not found` });
      continue;
    }
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

    const categoryId = await resolveMigratedCategoryId(tenantId, legacyCategory, lookups);
    if (!categoryId) {
      result.skipped.push({ legacyId, reason: `category "${legacyCategory.name}" (${idToString(legacyCategory._id)}) was not migrated` });
      continue;
    }

    const slashIndex = legacy.item_code.indexOf("/");
    const manufacturingKey = slashIndex >= 0 ? legacy.item_code.slice(slashIndex + 1) : legacy.item_code;
    const itemMatch = matchLegacyItem(legacyOrder.order_items ?? [], manufacturingKey);
    if (!itemMatch) {
      result.skipped.push({ legacyId, reason: `item_code "${legacy.item_code}" did not resolve to any order item on order ${legacyOrder.orderId}` });
      continue;
    }

    let orderTree = orderTreeCache.get(legacyOrder.orderId);
    if (orderTree === undefined) {
      orderTree = await withTenant(tenantId, (tx) => getOrderTreeByOrderNumber(tx, tenantId, legacyOrder.orderId));
      orderTreeCache.set(legacyOrder.orderId, orderTree);
    }
    if (!orderTree) {
      result.skipped.push({ legacyId, reason: `order ${legacyOrder.orderId} was not migrated` });
      continue;
    }
    const migratedItem = orderTree.items.find((i) => i.sequence === itemMatch.sequence);
    if (!migratedItem) {
      result.skipped.push({ legacyId, reason: `order ${legacyOrder.orderId} has no migrated item at sequence ${itemMatch.sequence}` });
      continue;
    }

    const component = await resolveComponentForProcess(tenantId, migratedItem.components, legacyProcess.name);
    if (!component) {
      result.skipped.push({ legacyId, reason: `process "${legacyProcess.name}" doesn't belong to any component of order ${legacyOrder.orderId}'s item at sequence ${itemMatch.sequence}` });
      continue;
    }

    const migrated = await withTenant(tenantId, async (tx) => {
      const process = await findProcessByName(tx, tenantId, legacyProcess.name);
      if (!process) return { ok: false as const, reason: `no catalog process named "${legacyProcess.name}"` };

      const step = await tx.query.manufacturingSteps.findFirst({
        where: and(eq(manufacturingSteps.orderItemComponentId, component.componentId), eq(manufacturingSteps.processId, process.id)),
      });
      if (!step) return { ok: false as const, reason: "no manufacturing_steps row for that component/process" };

      const job = await tx.query.jobs.findFirst({ where: and(eq(jobs.manufacturingStepId, step.id), eq(jobs.tailorId, tailorId)) });
      if (!job) return { ok: false as const, reason: "no migrated job found for that manufacturing step/tailor" };

      const existing = await tx.query.extraPayments.findFirst({ where: and(eq(extraPayments.jobId, job.id), eq(extraPayments.categoryId, categoryId)) });
      if (existing) return { ok: true as const };

      await tx.insert(extraPayments).values({
        jobId: job.id,
        categoryId,
        tailorId,
        cost: legacy.cost.toFixed(2),
        approved: legacy.approved ?? false,
        paid: legacy.paid ?? false,
        paidDate: legacy.paidDate ? new Date(legacy.paidDate) : null,
        createdAt: legacy.date ? new Date(legacy.date) : new Date(),
        updatedAt: legacy.date ? new Date(legacy.date) : new Date(),
      });
      return { ok: true as const };
    });

    if (!migrated.ok) {
      result.skipped.push({ legacyId, reason: migrated.reason });
      continue;
    }
    result.migrated++;
  }

  return result;
}
