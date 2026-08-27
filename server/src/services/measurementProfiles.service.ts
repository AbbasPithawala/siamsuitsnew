import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import {
  customerMeasurementProfiles,
  customerMeasurementProfileValues,
  orders,
  orderItems,
  orderItemComponents,
  orderItemComponentMeasurements,
} from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { computeTotalValue } from "../utils/measurement-values";
import { requireCustomer } from "./customers.service";
import { requireProduct } from "./catalog-helpers";

export interface ProfileMeasurementInput {
  measurementDefinitionId: string;
  value?: string | undefined;
  adjustmentValue?: string | undefined;
}

/**
 * `getX` for a resource whose absence is a normal, expected state, not an error — a
 * brand-new customer+product pairing legitimately has no profile yet (PHASE_10_TASKS.md
 * Workstream D Group 1), so this returns `null` rather than throwing a 404 the way
 * `requireX`-backed `getX` functions elsewhere in this codebase do for a missing primary
 * resource. `customerId`/`productId` themselves still 404 if they don't resolve to a real,
 * tenant-owned row — only the profile's own absence is non-error.
 */
export function getCustomerMeasurementProfile(tenantId: string, customerId: string, productId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireCustomer(tx, customerId);
    await requireProduct(tx, productId);

    const profile = await tx.query.customerMeasurementProfiles.findFirst({
      where: (p, { and: andOp, eq: eqOp, isNull }) => andOp(eqOp(p.customerId, customerId), eqOp(p.productId, productId), isNull(p.deletedAt)),
    });
    if (!profile) return null;

    const values = await tx.query.customerMeasurementProfileValues.findMany({
      where: eq(customerMeasurementProfileValues.profileId, profile.id),
    });

    return { ...profile, values };
  });
}

/**
 * The customer's most recent order's component for a specific product, excluding one order
 * (its own current order, when resolving mid-edit — omitted entirely for a brand-new order,
 * since nothing to exclude exists yet). One indexed query — see `orders.customer_id_order_date_idx`
 * — not a loop stepping through orders one at a time.
 *
 * Shared by two callers that must never drift apart: `orders.service.ts#resolveBaselineComponentId`
 * (the write path — persists this onto the new component, the actual source of truth for the
 * PDF/`changed_from_profile`) and `getMeasurementBaseline` below (a read-only live preview for
 * the order-builder's UI checkmark, PHASE_10_TASKS.md follow-up). Using one query for both means
 * what the checkmark shows while typing is guaranteed to match what gets saved.
 */
export async function findMostRecentOrderComponentIdForProduct(
  tx: Transaction,
  customerId: string,
  productId: string,
  excludeOrderId?: string
): Promise<string | null> {
  const conditions = [eq(orders.customerId, customerId), eq(orderItemComponents.productId, productId), isNull(orders.deletedAt)];
  if (excludeOrderId) conditions.push(ne(orders.id, excludeOrderId));

  const [found] = await tx
    .select({ id: orderItemComponents.id })
    .from(orderItemComponents)
    .innerJoin(orderItems, eq(orderItemComponents.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .orderBy(desc(orders.orderDate))
    .limit(1);

  return found?.id ?? null;
}

/**
 * Read-only live preview of the exact same comparison `changed_from_profile` will end up using
 * once the order is actually saved — the order-builder's Measurements panel calls this (via
 * `GET /customers/:customerId/measurement-baseline/:productId`) to drive its live checkmark,
 * instead of `getCustomerMeasurementProfile` above (which answers a different question — "the
 * customer's latest known value across any write" — not "this specific product's specific prior
 * order", see `baseline_component_id`'s own schema doc comment for why those two diverge).
 *
 * `excludeOrderId`: the order currently being edited, if any — so an existing order's own
 * already-saved component never counts as its own baseline candidate while its edit form is
 * open. Omitted for order creation, where nothing exists yet to accidentally self-reference.
 *
 * Returns `null` when no prior order for this product exists at all (same "no baseline" case
 * `changed_from_profile: null` represents) — not an error.
 */
export function getMeasurementBaseline(tenantId: string, customerId: string, productId: string, excludeOrderId?: string) {
  return withTenant(tenantId, async (tx) => {
    await requireCustomer(tx, customerId);
    await requireProduct(tx, productId);

    const baselineComponentId = await findMostRecentOrderComponentIdForProduct(tx, customerId, productId, excludeOrderId);
    if (!baselineComponentId) return null;

    const values = await tx.query.orderItemComponentMeasurements.findMany({
      where: eq(orderItemComponentMeasurements.orderItemComponentId, baselineComponentId),
    });

    return { values };
  });
}

/**
 * Internal, `tx`-taking upsert for `orders.service.ts#buildOrder`/`editOrderItems` to call in
 * the same transaction as their own component write (PHASE_10_TASKS.md Workstream D Decision
 * 2) — never opens its own `withTenant`. For each submitted measurement: per-row
 * `INSERT ... ON CONFLICT (profile_id, measurement_definition_id) DO UPDATE`, deliberately
 * NOT a delete-then-reinsert full-replace — an order that omits a measurement must not be
 * read as "delete this from the customer's known profile," only refine what it actually
 * submits.
 *
 * Purely a side-effecting write (no return value) — this table only ever feeds pre-filling a
 * *brand-new* order's form with the customer's latest known measurements. It is NOT consulted
 * for `order_item_component_measurements.changed_from_profile` anymore: that comparison now
 * targets a specific fixed prior order via `order_item_components.baseline_component_id`
 * instead (see that column's own schema doc comment for why the two were split apart — this
 * profile is legitimately mutated by every order write regardless of chronological order,
 * which made it the wrong source for "did THIS order's own measurement change").
 */
export async function upsertCustomerMeasurementProfileValues(
  tx: Transaction,
  tenantId: string,
  customerId: string,
  productId: string,
  values: ProfileMeasurementInput[]
): Promise<void> {
  if (values.length === 0) return;

  const [profile] = await tx
    .insert(customerMeasurementProfiles)
    .values({ tenantId, customerId, productId })
    .onConflictDoUpdate({
      target: [customerMeasurementProfiles.tenantId, customerMeasurementProfiles.customerId, customerMeasurementProfiles.productId],
      set: { updatedAt: new Date() },
    })
    .returning();
  if (!profile) throw new HttpError(500, "INTERNAL_ERROR", "Failed to upsert customer measurement profile");

  for (const measurement of values) {
    const row = {
      value: measurement.value ?? null,
      adjustmentValue: measurement.adjustmentValue ?? null,
      totalValue: computeTotalValue(measurement.value, measurement.adjustmentValue) ?? null,
    };

    await tx
      .insert(customerMeasurementProfileValues)
      .values({
        profileId: profile.id,
        measurementDefinitionId: measurement.measurementDefinitionId,
        ...row,
      })
      .onConflictDoUpdate({
        target: [customerMeasurementProfileValues.profileId, customerMeasurementProfileValues.measurementDefinitionId],
        set: row,
      });
  }
}
