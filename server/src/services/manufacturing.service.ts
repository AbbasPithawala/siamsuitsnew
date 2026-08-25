import { and, eq, inArray, isNull } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import {
  orders,
  orderItems,
  orderItemComponents,
  orderItemComponentFeatures,
  features,
  styles,
  manufacturingSteps,
  tailorProcesses,
  jobs,
} from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireTailor } from "./manufacturing-helpers";
import { requireProcess } from "./catalog-helpers";

type ManufacturingStepRow = typeof manufacturingSteps.$inferSelect;

/**
 * `order_item_components`/`order_items` carry no `tenant_id` of their own (see
 * `0001_enable_row_level_security.sql`'s comment) — ownership is proven by walking up to
 * `orders`, which does. `orders` is itself RLS-scoped by the `withTenant` transaction this
 * runs inside, so a cross-tenant order id already can't be found here; the explicit
 * `order.tenantId === tenantId` check is defense in depth so a bad `orderItemComponentId`
 * 404s cleanly instead of relying solely on RLS.
 */
export async function requireOwnedComponent(tx: Transaction, tenantId: string, orderItemComponentId: string) {
  const component = await tx.query.orderItemComponents.findFirst({
    where: eq(orderItemComponents.id, orderItemComponentId),
  });
  if (!component) {
    throw new HttpError(404, "COMPONENT_NOT_FOUND", `Order item component ${orderItemComponentId} not found`);
  }

  const item = await tx.query.orderItems.findFirst({ where: eq(orderItems.id, component.orderItemId) });
  if (!item) {
    throw new HttpError(404, "COMPONENT_NOT_FOUND", `Order item component ${orderItemComponentId} not found`);
  }

  const order = await tx.query.orders.findFirst({
    where: and(eq(orders.id, item.orderId), isNull(orders.deletedAt)),
  });
  if (!order || order.tenantId !== tenantId) {
    throw new HttpError(404, "COMPONENT_NOT_FOUND", `Order item component ${orderItemComponentId} not found`);
  }

  return component;
}

/**
 * Scans the component's steps (already ordered by `sequenceOrder`) for the one that can be
 * assigned next: the first `pending` step whose predecessor is `complete` (or which has no
 * predecessor). Three distinct rejection reasons, not one generic "can't assign":
 * - `STEP_LOCKED`: a later pending step exists but its predecessor isn't complete yet.
 * - `STEP_IN_PROGRESS`: no pending step is reachable because an earlier step is currently
 *   `assigned` — finish that one first.
 * - `NO_STEP_AVAILABLE`: every step is `complete` — nothing left to assign.
 */
function findAssignableStep(steps: ManufacturingStepRow[], componentId: string): ManufacturingStepRow {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.status !== "pending") continue;

    const prev = steps[i - 1];
    if (prev && prev.status !== "complete") {
      throw new HttpError(
        409,
        "STEP_LOCKED",
        `Step ${step.id} (sequence ${step.sequenceOrder}) can't be assigned yet — sequence ${prev.sequenceOrder} is not complete`
      );
    }
    return step;
  }

  if (steps.every((s) => s.status === "complete")) {
    throw new HttpError(409, "NO_STEP_AVAILABLE", `Component ${componentId}: all manufacturing steps are already complete`);
  }
  throw new HttpError(
    409,
    "STEP_IN_PROGRESS",
    `Component ${componentId}: a manufacturing step is currently assigned to a tailor; complete it before assigning another`
  );
}

/**
 * Job cost formula (PHASE_3_TASKS.md Group 0): `process.price + sum(workerPrice of every
 * order_item_component_feature on this component whose feature.processId matches this
 * step's processId)`. The `jobs` table has two numeric columns, not one — `cost` holds the
 * base `process.price`, `stylingPrice` holds the summed feature workerPrices, and
 * `cost + stylingPrice` is the formula's total. Only features whose selected style declares
 * a `workerPrice` and whose own `processId` equals this step's process contribute.
 */
async function computeStylingPrice(tx: Transaction, orderItemComponentId: string, processId: string): Promise<number> {
  const componentFeatures = await tx.query.orderItemComponentFeatures.findMany({
    where: eq(orderItemComponentFeatures.orderItemComponentId, orderItemComponentId),
  });
  if (componentFeatures.length === 0) return 0;

  const featureIds = [...new Set(componentFeatures.map((f) => f.featureId))];
  const featureRows = await tx.query.features.findMany({ where: inArray(features.id, featureIds) });
  const featureById = new Map(featureRows.map((f) => [f.id, f]));

  const styleIds = componentFeatures.map((f) => f.styleId).filter((id): id is string => id !== null);
  const styleRows = styleIds.length ? await tx.query.styles.findMany({ where: inArray(styles.id, styleIds) }) : [];
  const styleById = new Map(styleRows.map((s) => [s.id, s]));

  let total = 0;
  for (const componentFeature of componentFeatures) {
    const feature = featureById.get(componentFeature.featureId);
    if (!feature || feature.processId !== processId) continue;
    if (!componentFeature.styleId) continue;

    const style = styleById.get(componentFeature.styleId);
    if (!style) continue;

    total += Number(style.workerPrice);
  }

  return total;
}

export interface AssignabilityPreview {
  step: ManufacturingStepRow | null;
  blockedReason: "STEP_LOCKED" | "STEP_IN_PROGRESS" | "NO_STEP_AVAILABLE" | null;
}

/**
 * Non-throwing sibling of `findAssignableStep` below, for the read-only
 * `getComponentDetail` endpoint (PHASE_6_TASKS.md Group 7 — the frontend
 * needs to know a component's next assignable process *before* attempting
 * an assignment, both to filter the tailor picker down to certified tailors
 * and to show a clear blocked-state message proactively, not only after a
 * failed `assignNextStep` call). Kept as a separate small function rather
 * than refactoring `findAssignableStep` to call this one and throw off its
 * result — that would lose the specific step/sequence detail the existing,
 * already-tested error messages below reference.
 */
function previewAssignableStep(steps: ManufacturingStepRow[]): AssignabilityPreview {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.status !== "pending") continue;

    const prev = steps[i - 1];
    if (prev && prev.status !== "complete") {
      return { step: null, blockedReason: "STEP_LOCKED" };
    }
    return { step, blockedReason: null };
  }

  if (steps.every((s) => s.status === "complete")) {
    return { step: null, blockedReason: "NO_STEP_AVAILABLE" };
  }
  return { step: null, blockedReason: "STEP_IN_PROGRESS" };
}

/**
 * Read-only counterpart to `assignNextStep`/`completeStep` — PHASE_6_TASKS.md
 * Group 7 found there was no way for the frontend to look up a scanned/typed
 * `order_item_component` id and show anything about it (product, slot,
 * per-process step status, which process comes next) before committing to an
 * assignment. Small, additive read endpoint reusing the exact ownership walk
 * and step query `assignNextStep` already performs, per this codebase's
 * "add a genuinely small missing read endpoint" allowance.
 */
export async function getComponentDetail(tenantId: string, orderItemComponentId: string) {
  return withTenant(tenantId, async (tx) => {
    const component = await requireOwnedComponent(tx, tenantId, orderItemComponentId);

    const steps = await tx.query.manufacturingSteps.findMany({
      where: eq(manufacturingSteps.orderItemComponentId, component.id),
      orderBy: (s, { asc }) => asc(s.sequenceOrder),
    });

    const { step, blockedReason } = previewAssignableStep(steps);

    return { ...component, manufacturingSteps: steps, nextStep: step, blockedReason };
  });
}

/**
 * Assigns the next available manufacturing step for a component to a tailor and creates
 * its `jobs` row. Takes the component's own id (the QR/scan identifier per
 * `REWRITE_ARCHITECTURE.md`'s QR redesign) — no string parsing, no order-type branching:
 * a normal order's component and a group order's component reach this function identically.
 */
export async function assignNextStep(tenantId: string, orderItemComponentId: string, tailorId: string) {
  return withTenant(tenantId, async (tx) => {
    const component = await requireOwnedComponent(tx, tenantId, orderItemComponentId);

    const steps = await tx.query.manufacturingSteps.findMany({
      where: eq(manufacturingSteps.orderItemComponentId, component.id),
      orderBy: (s, { asc }) => asc(s.sequenceOrder),
    });
    if (steps.length === 0) {
      throw new HttpError(404, "NO_MANUFACTURING_STEPS", `Component ${orderItemComponentId} has no manufacturing steps`);
    }

    const step = findAssignableStep(steps, component.id);

    const tailor = await requireTailor(tx, tailorId);
    const certification = await tx.query.tailorProcesses.findFirst({
      where: and(eq(tailorProcesses.tailorId, tailor.id), eq(tailorProcesses.processId, step.processId)),
    });
    if (!certification) {
      throw new HttpError(403, "NOT_CERTIFIED", `Tailor ${tailorId} is not certified for process ${step.processId}`);
    }

    const process = await requireProcess(tx, step.processId);
    const stylingPrice = await computeStylingPrice(tx, component.id, step.processId);

    const [updatedStep] = await tx
      .update(manufacturingSteps)
      .set({ status: "assigned", tailorId: tailor.id, startedAt: new Date(), updatedAt: new Date() })
      .where(eq(manufacturingSteps.id, step.id))
      .returning();
    if (!updatedStep) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update manufacturing step");

    const [job] = await tx
      .insert(jobs)
      .values({
        tenantId,
        manufacturingStepId: step.id,
        tailorId: tailor.id,
        cost: process.price,
        stylingPrice: stylingPrice.toFixed(2),
      })
      .returning();
    if (!job) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create job");

    return { step: updatedStep, job };
  });
}

/**
 * Marks a step's job complete. Rejects a step that's still `pending` (never assigned) and
 * a step that's already `complete` (no silent no-op) with distinct error codes, same
 * component-ownership walk as `assignNextStep` for consistency.
 */
export async function completeStep(tenantId: string, jobId: string) {
  return withTenant(tenantId, async (tx) => {
    const job = await tx.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
    if (!job) throw new HttpError(404, "JOB_NOT_FOUND", `Job ${jobId} not found`);

    const step = await tx.query.manufacturingSteps.findFirst({ where: eq(manufacturingSteps.id, job.manufacturingStepId) });
    if (!step) throw new HttpError(404, "JOB_NOT_FOUND", `Job ${jobId} not found`);

    await requireOwnedComponent(tx, tenantId, step.orderItemComponentId);

    if (step.status === "pending") {
      throw new HttpError(409, "STEP_NOT_STARTED", `Step ${step.id} has not been assigned to a tailor yet`);
    }
    if (step.status === "complete") {
      throw new HttpError(409, "STEP_ALREADY_COMPLETE", `Step ${step.id} is already complete`);
    }

    const [updatedStep] = await tx
      .update(manufacturingSteps)
      .set({ status: "complete", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(manufacturingSteps.id, step.id))
      .returning();
    if (!updatedStep) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update manufacturing step");

    return updatedStep;
  });
}
