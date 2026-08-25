import { and, eq } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { jobs, manufacturingSteps, extraPaymentCategories, extraPayments, orderItemComponentFeatures } from "../db/schema/index";
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
 */
export async function createExtraPayment(tenantId: string, jobId: string, categoryId: string) {
  return withTenant(tenantId, async (tx) => {
    const { job, step, component } = await requireOwnedJob(tx, tenantId, jobId);
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
 * silent no-op, same style as `manufacturing.service.ts`'s `completeStep`. `extra_payments`
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

    const [updated] = await tx
      .update(extraPayments)
      .set({ approved: true, updatedAt: new Date() })
      .where(eq(extraPayments.id, extraPaymentId))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to approve extra payment");

    return updated;
  });
}
