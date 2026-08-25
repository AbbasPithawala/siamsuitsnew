import { eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import { measurementDefinitions, productMeasurements } from "../db/schema/index";
import { catchUniqueViolation } from "../utils/db-errors";
import { requireMeasurementDefinition, requireProduct } from "./catalog-helpers";
import { toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export interface CreateMeasurementDefinitionInput {
  name: string;
  thaiName?: string;
  slug: string;
}

export type UpdateMeasurementDefinitionInput = Partial<CreateMeasurementDefinitionInput>;

export function createMeasurementDefinition(tenantId: string, input: CreateMeasurementDefinitionInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const [definition] = await tx.insert(measurementDefinitions).values({ tenantId, ...input }).returning();
        return definition;
      },
      "MEASUREMENT_SLUG_TAKEN",
      `A measurement definition with slug "${input.slug}" already exists`
    )
  );
}

/**
 * Opt-in pagination (PHASE_10_TASKS.md Workstream C) — omitting `pagination` keeps
 * returning the full unpaginated list, for the order-builder's own `MeasurementForm`.
 */
export function listMeasurementDefinitions(tenantId: string): Promise<(typeof measurementDefinitions.$inferSelect)[]>;
export function listMeasurementDefinitions(
  tenantId: string,
  pagination: PaginationParams
): Promise<{ data: (typeof measurementDefinitions.$inferSelect)[]; total: number }>;
export function listMeasurementDefinitions(tenantId: string, pagination?: PaginationParams) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(measurementDefinitions.deletedAt);
    if (!pagination) {
      return tx.query.measurementDefinitions.findMany({ where, orderBy: (m, { asc }) => asc(m.name) });
    }

    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);
    const [data, [countRow]] = await Promise.all([
      tx.query.measurementDefinitions.findMany({ where, orderBy: (m, { asc }) => asc(m.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(measurementDefinitions).where(where),
    ]);
    return { data, total: countRow?.count ?? 0 };
  });
}

export function getMeasurementDefinition(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => requireMeasurementDefinition(tx, id));
}

export function updateMeasurementDefinition(tenantId: string, id: string, input: UpdateMeasurementDefinitionInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireMeasurementDefinition(tx, id);
        const [updated] = await tx
          .update(measurementDefinitions)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(measurementDefinitions.id, id))
          .returning();
        return updated;
      },
      "MEASUREMENT_SLUG_TAKEN",
      `A measurement definition with slug "${input.slug}" already exists`
    )
  );
}

export function softDeleteMeasurementDefinition(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireMeasurementDefinition(tx, id);
    await tx.update(measurementDefinitions).set({ deletedAt: new Date() }).where(eq(measurementDefinitions.id, id));
  });
}

/**
 * Full replace of the product<->measurement-definition link set, in the given order —
 * `measurementDefinitionIds`' array position becomes `sequence_order` (PHASE_8_TASKS.md
 * Group 1), matching legacy `ManageProduct.jsx`'s drag-reorder-then-`PUT` semantics.
 */
export function setProductMeasurements(tenantId: string, productId: string, measurementDefinitionIds: string[]) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    for (const id of measurementDefinitionIds) {
      await requireMeasurementDefinition(tx, id);
    }

    await tx.delete(productMeasurements).where(eq(productMeasurements.productId, productId));
    for (const [sequenceOrder, measurementDefinitionId] of measurementDefinitionIds.entries()) {
      await tx.insert(productMeasurements).values({ productId, measurementDefinitionId, sequenceOrder });
    }

    return tx.query.productMeasurements.findMany({
      where: eq(productMeasurements.productId, productId),
      with: { measurementDefinition: true },
      orderBy: (pm, { asc }) => asc(pm.sequenceOrder),
    });
  });
}

export function getProductMeasurements(tenantId: string, productId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    return tx.query.productMeasurements.findMany({
      where: eq(productMeasurements.productId, productId),
      with: { measurementDefinition: true },
      orderBy: (pm, { asc }) => asc(pm.sequenceOrder),
    });
  });
}
