import { and, eq, inArray } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import {
  jobs,
  manufacturingSteps,
  extraPaymentCategories,
  extraPayments,
  orderItemComponentFeatures,
  orderItemComponents,
  orderItems,
  orders,
  tailors,
} from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOwnedComponent } from "./manufacturing.service";
import { isUniqueConstraintConflict } from "./orders.service";

const EXTRA_PAYMENT_JOB_CATEGORY_CONSTRAINT = "extra_payments_job_category_unique";

/**
 * `jobs` carries its own `tenant_id`/RLS policy, so a cross-tenant `jobId` already can't
 * be found by this `findFirst` — the walk down to the component (which re-derives tenant
 * ownership independently through `orders`, per `requireOwnedComponent`'s own comment) is
 * defense in depth, same rationale as `manufacturing.service.ts`. It also happens to be
 * exactly the data (`step.processId`, `component.productId`, `component.id` for feature
 * lookups) `createExtraPayment`'s validation needs, so this isn't purely a guard.
 */
export async function requireOwnedJob(tx: Transaction, tenantId: string, jobId: string) {
  const job = await tx.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND", `Job ${jobId} not found`);

  const step = await tx.query.manufacturingSteps.findFirst({ where: eq(manufacturingSteps.id, job.manufacturingStepId) });
  if (!step) throw new HttpError(404, "JOB_NOT_FOUND", `Job ${jobId} not found`);

  const component = await requireOwnedComponent(tx, tenantId, step.orderItemComponentId);

  return { job, step, component };
}

/** `extra_payment_categories` carries its own `tenant_id`/RLS policy — see `0001_enable_row_level_security.sql`. */
async function requireCategory(tx: Transaction, categoryId: string) {
  const category = await tx.query.extraPaymentCategories.findFirst({ where: eq(extraPaymentCategories.id, categoryId) });
  if (!category) throw new HttpError(404, "EXTRA_PAYMENT_CATEGORY_NOT_FOUND", `Extra payment category ${categoryId} not found`);
  return category;
}

/**
 * Creates an extra payment against a job. Properly enforced this time (PHASE_3_TASKS.md
 * Group 0/5) — the legacy behavior only filtered categories by product+process match and
 * let the admin's judgement decide the rest, with no server-side re-check that the
 * category's specific feature/style was actually chosen on the order. Here:
 *   - `category.processId` must equal the job's own step's `processId`.
 *   - `category.productId` must equal the component's `productId`.
 *   - if the category names a `featureId` (optionally a `styleId`), the component's
 *     `order_item_component_features` must contain a row for that exact feature (and
 *     matching style, if the category specifies one) — i.e. that choice was genuinely
 *     made on this order, not just theoretically applicable to this product/process pair.
 * `approved` always starts `false` — this is the system's only creation path, so there's
 * exactly one default posture, not the legacy's path-dependent one.
 *
 * `actorTailorId` (tailor-portal self-service) — when present, attaching an extra payment
 * to a job assigned to a *different* tailor 404s (indistinguishable from a bogus job id,
 * same convention `manufacturing.service.ts`'s `completeStep` uses). `undefined` (every
 * existing staff caller) is a no-op.
 */
export async function createExtraPayment(tenantId: string, jobId: string, categoryId: string, actorTailorId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const { job, step, component } = await requireOwnedJob(tx, tenantId, jobId);
    if (actorTailorId != null && job.tailorId !== actorTailorId) {
      throw new HttpError(404, "JOB_NOT_FOUND", `Job ${jobId} not found`);
    }
    const category = await requireCategory(tx, categoryId);

    if (category.processId !== step.processId) {
      throw new HttpError(
        422,
        "CATEGORY_PROCESS_MISMATCH",
        `Extra payment category ${categoryId} is paid during a different process than job ${jobId}'s step`
      );
    }
    if (category.productId !== component.productId) {
      throw new HttpError(
        422,
        "CATEGORY_PRODUCT_MISMATCH",
        `Extra payment category ${categoryId} does not apply to product ${component.productId}`
      );
    }

    if (category.featureId) {
      const selectedFeature = await tx.query.orderItemComponentFeatures.findFirst({
        where: and(
          eq(orderItemComponentFeatures.orderItemComponentId, component.id),
          eq(orderItemComponentFeatures.featureId, category.featureId)
        ),
      });
      const styleMatches = !category.styleId || selectedFeature?.styleId === category.styleId;
      if (!selectedFeature || !styleMatches) {
        throw new HttpError(
          422,
          "STYLE_NOT_SELECTED",
          `Extra payment category ${categoryId}'s feature/style was not actually selected on component ${component.id}`
        );
      }
    }

    const existing = await tx.query.extraPayments.findFirst({
      where: and(eq(extraPayments.jobId, jobId), eq(extraPayments.categoryId, categoryId)),
    });
    if (existing) {
      throw new HttpError(409, "DUPLICATE_EXTRA_PAYMENT", `Job ${jobId} already has an extra payment for category ${categoryId}`);
    }

    try {
      const [extraPayment] = await tx
        .insert(extraPayments)
        .values({
          jobId,
          categoryId,
          tailorId: job.tailorId,
          cost: category.cost,
          approved: false,
        })
        .returning();
      if (!extraPayment) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create extra payment");
      return extraPayment;
    } catch (err) {
      if (isUniqueConstraintConflict(err, EXTRA_PAYMENT_JOB_CATEGORY_CONSTRAINT)) {
        throw new HttpError(409, "DUPLICATE_EXTRA_PAYMENT", `Job ${jobId} already has an extra payment for category ${categoryId}`);
      }
      throw err;
    }
  });
}

/**
 * Approves a pending extra payment. Rejects one that's already approved instead of a
 * silent no-op, same style as `manufacturing.service.ts`'s `completeStep`. Also rejects one
 * that's already `rejected` — `approved`/`rejected` are mutually exclusive final states, an
 * admin who wants to reverse a rejection has no undo path here (not asked for). `extra_payments`
 * has no `tenant_id`/RLS of its own (pure join-adjacent table — see
 * `0001_enable_row_level_security.sql`'s comment), so ownership is proven by walking
 * through its job the same way `createExtraPayment` does.
 */
export async function approveExtraPayment(tenantId: string, extraPaymentId: string) {
  return withTenant(tenantId, async (tx) => {
    const extraPayment = await tx.query.extraPayments.findFirst({ where: eq(extraPayments.id, extraPaymentId) });
    if (!extraPayment) throw new HttpError(404, "EXTRA_PAYMENT_NOT_FOUND", `Extra payment ${extraPaymentId} not found`);

    await requireOwnedJob(tx, tenantId, extraPayment.jobId);

    if (extraPayment.approved) {
      throw new HttpError(409, "ALREADY_APPROVED", `Extra payment ${extraPaymentId} is already approved`);
    }
    if (extraPayment.rejected) {
      throw new HttpError(409, "ALREADY_REJECTED", `Extra payment ${extraPaymentId} was already rejected`);
    }

    const [updated] = await tx
      .update(extraPayments)
      .set({ approved: true, updatedAt: new Date() })
      .where(eq(extraPayments.id, extraPaymentId))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to approve extra payment");

    return updated;
  });
}

/**
 * Admin-queue counterpart to `approveExtraPayment` — rejects a pending extra payment
 * outright (PHASE_6_TASKS.md Group 7 follow-up, mirrors legacy `ManageExtraPayments.jsx`'s
 * Decline action). Recorded in place (`rejected`/`rejectedAt`), not deleted — unlike
 * `removeExtraPayment` below, which *is* a hard delete but only reachable pre-completion by
 * the operator who attached it, before any admin decision exists to preserve.
 */
export async function rejectExtraPayment(tenantId: string, extraPaymentId: string) {
  return withTenant(tenantId, async (tx) => {
    const extraPayment = await tx.query.extraPayments.findFirst({ where: eq(extraPayments.id, extraPaymentId) });
    if (!extraPayment) throw new HttpError(404, "EXTRA_PAYMENT_NOT_FOUND", `Extra payment ${extraPaymentId} not found`);

    await requireOwnedJob(tx, tenantId, extraPayment.jobId);

    if (extraPayment.approved) {
      throw new HttpError(409, "ALREADY_APPROVED", `Extra payment ${extraPaymentId} is already approved`);
    }
    if (extraPayment.rejected) {
      throw new HttpError(409, "ALREADY_REJECTED", `Extra payment ${extraPaymentId} was already rejected`);
    }

    const [updated] = await tx
      .update(extraPayments)
      .set({ rejected: true, rejectedAt: new Date(), updatedAt: new Date() })
      .where(eq(extraPayments.id, extraPaymentId))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to reject extra payment");

    return updated;
  });
}

/**
 * Undoes an accidental attach on the assign/complete screen (`JobAssignmentPage.tsx`) —
 * keyed by `(jobId, categoryId)`, the same pair `createExtraPayment` takes, rather than the
 * extra payment's own id, since the floor screen never learns that id (it only ever sees
 * category ids). A genuine hard delete, unlike `rejectExtraPayment`: this is the operator
 * undoing their own not-yet-submitted-for-review action, not an admin decision worth an
 * audit trail. Guarded on both `approved` and the step's completion — once either is true,
 * an admin decision is in flight or the job is done, and only `rejectExtraPayment` (admin,
 * any time) should be able to touch it from here on.
 *
 * `actorTailorId` (tailor-portal self-service) — same not-your-job-404 convention as
 * `createExtraPayment`/`completeStep`. `undefined` (every existing staff caller) is a no-op.
 */
export async function removeExtraPayment(tenantId: string, jobId: string, categoryId: string, actorTailorId?: string | null) {
  return withTenant(tenantId, async (tx) => {
    const { job, step } = await requireOwnedJob(tx, tenantId, jobId);
    if (actorTailorId != null && job.tailorId !== actorTailorId) {
      throw new HttpError(404, "JOB_NOT_FOUND", `Job ${jobId} not found`);
    }

    const extraPayment = await tx.query.extraPayments.findFirst({
      where: and(eq(extraPayments.jobId, jobId), eq(extraPayments.categoryId, categoryId)),
    });
    if (!extraPayment) {
      throw new HttpError(404, "EXTRA_PAYMENT_NOT_FOUND", `Job ${jobId} has no extra payment for category ${categoryId}`);
    }
    if (extraPayment.approved) {
      throw new HttpError(409, "EXTRA_PAYMENT_ALREADY_APPROVED", `Extra payment for category ${categoryId} on job ${jobId} is already approved`);
    }
    if (step.status === "complete") {
      throw new HttpError(409, "STEP_ALREADY_COMPLETE", `Job ${jobId}'s step is already complete`);
    }

    await tx.delete(extraPayments).where(eq(extraPayments.id, extraPayment.id));
    return extraPayment;
  });
}

export interface ExtraPaymentListFilter {
  status?: "pending" | "approved" | "rejected";
  tailorId?: string;
}

/**
 * Enriched list for the admin approval queue (`ExtraPaymentsApprovalPage.tsx`) — the read
 * `ManageExtraPayments.jsx` needed but the API never had. Defaults to `status: "pending"`
 * (unapproved, unrejected) since that's the queue an admin actually works from; `"approved"`/
 * `"rejected"` exist for a history view. Walks the same job → step → component → orderItem →
 * order chain `manufacturing.service.ts` does, batched with `inArray` rather than N+1 queries.
 */
export async function listExtraPayments(tenantId: string, filter: ExtraPaymentListFilter = {}) {
  return withTenant(tenantId, async (tx) => {
    const status = filter.status ?? "pending";
    const conditions = [];
    if (status === "pending") conditions.push(eq(extraPayments.approved, false), eq(extraPayments.rejected, false));
    if (status === "approved") conditions.push(eq(extraPayments.approved, true));
    if (status === "rejected") conditions.push(eq(extraPayments.rejected, true));
    if (filter.tailorId) conditions.push(eq(extraPayments.tailorId, filter.tailorId));

    const rows = await tx.query.extraPayments.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: (ep, { desc }) => desc(ep.createdAt),
    });
    if (rows.length === 0) return [];

    const tailorIds = [...new Set(rows.map((r) => r.tailorId))];
    const tailorRows = await tx.query.tailors.findMany({ where: inArray(tailors.id, tailorIds) });
    const tailorById = new Map(tailorRows.map((t) => [t.id, t]));

    const categoryIds = [...new Set(rows.map((r) => r.categoryId))];
    const categoryRows = await tx.query.extraPaymentCategories.findMany({ where: inArray(extraPaymentCategories.id, categoryIds) });
    const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

    const jobIds = [...new Set(rows.map((r) => r.jobId))];
    const jobRows = await tx.query.jobs.findMany({ where: inArray(jobs.id, jobIds) });
    const jobById = new Map(jobRows.map((j) => [j.id, j]));

    const stepIds = [...new Set(jobRows.map((j) => j.manufacturingStepId))];
    const stepRows = stepIds.length ? await tx.query.manufacturingSteps.findMany({ where: inArray(manufacturingSteps.id, stepIds) }) : [];
    const stepById = new Map(stepRows.map((s) => [s.id, s]));

    const componentIds = [...new Set(stepRows.map((s) => s.orderItemComponentId))];
    const componentRows = componentIds.length
      ? await tx.query.orderItemComponents.findMany({ where: inArray(orderItemComponents.id, componentIds) })
      : [];
    const componentById = new Map(componentRows.map((c) => [c.id, c]));

    const orderItemIds = [...new Set(componentRows.map((c) => c.orderItemId))];
    const orderItemRows = orderItemIds.length ? await tx.query.orderItems.findMany({ where: inArray(orderItems.id, orderItemIds) }) : [];
    const orderItemById = new Map(orderItemRows.map((oi) => [oi.id, oi]));

    const orderIds = [...new Set(orderItemRows.map((oi) => oi.orderId))];
    const orderRows = orderIds.length ? await tx.query.orders.findMany({ where: inArray(orders.id, orderIds) }) : [];
    const orderById = new Map(orderRows.map((o) => [o.id, o]));

    return rows.map((extraPayment) => {
      const job = jobById.get(extraPayment.jobId) ?? null;
      const step = job ? (stepById.get(job.manufacturingStepId) ?? null) : null;
      const component = step ? (componentById.get(step.orderItemComponentId) ?? null) : null;
      const orderItem = component ? (orderItemById.get(component.orderItemId) ?? null) : null;
      const order = orderItem ? (orderById.get(orderItem.orderId) ?? null) : null;
      const tailor = tailorById.get(extraPayment.tailorId) ?? null;
      const category = categoryById.get(extraPayment.categoryId) ?? null;

      return {
        ...extraPayment,
        tailor: tailor ? { id: tailor.id, name: tailor.name } : null,
        category: category ? { id: category.id, name: category.name, thaiName: category.thaiName } : null,
        order: order ? { id: order.id, orderNumber: order.orderNumber } : null,
        component: component ? { id: component.id, slotLabel: component.slotLabel } : null,
      };
    });
  });
}
