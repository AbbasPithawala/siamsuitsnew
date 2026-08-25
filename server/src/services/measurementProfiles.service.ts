import { and, eq } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { customerMeasurementProfiles, customerMeasurementProfileValues } from "../db/schema/index";
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
 * Internal, `tx`-taking upsert for `orders.service.ts#buildOrder` to call in the same
 * transaction as its own component insert loop (PHASE_10_TASKS.md Workstream D Decision 2)
 * — never opens its own `withTenant`. For each submitted measurement: per-row
 * `INSERT ... ON CONFLICT (profile_id, measurement_definition_id) DO UPDATE`, deliberately
 * NOT a delete-then-reinsert full-replace — an order that omits a measurement must not be
 * read as "delete this from the customer's known profile," only refine what it actually
 * submits.
 *
 * Returns the pre-overwrite `value` for each submitted measurement definition (`null` when
 * no prior profile value existed to compare against), so the caller can compute
 * `order_item_component_measurements.changed_from_profile` before this function's own
 * writes clobber the comparison.
 */
export async function upsertCustomerMeasurementProfileValues(
  tx: Transaction,
  tenantId: string,
  customerId: string,
  productId: string,
  values: ProfileMeasurementInput[]
): Promise<Map<string, string | null>> {
  const oldValues = new Map<string, string | null>();
  if (values.length === 0) return oldValues;

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
    const existing = await tx.query.customerMeasurementProfileValues.findFirst({
      where: and(
        eq(customerMeasurementProfileValues.profileId, profile.id),
        eq(customerMeasurementProfileValues.measurementDefinitionId, measurement.measurementDefinitionId)
      ),
    });
    oldValues.set(measurement.measurementDefinitionId, existing?.value ?? null);

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

  return oldValues;
}
