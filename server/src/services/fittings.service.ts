import { eq, isNull } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import { fittingValues, productFittings } from "../db/schema/index";
import { requireMeasurementDefinition, requireProduct, requireProductFitting } from "./catalog-helpers";

export interface CreateFittingInput {
  name: string;
  thaiName?: string;
}

export type UpdateFittingInput = Partial<CreateFittingInput>;

export interface FittingValueInput {
  measurementDefinitionId: string;
  value: string;
}

export function listFittingsForProduct(tenantId: string, productId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    return tx.query.productFittings.findMany({
      where: (f, { and, eq: eqOp }) => and(eqOp(f.productId, productId), isNull(f.deletedAt)),
      orderBy: (f, { asc }) => asc(f.name),
    });
  });
}

export function createFitting(tenantId: string, productId: string, input: CreateFittingInput) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    const [fitting] = await tx.insert(productFittings).values({ tenantId, productId, ...input }).returning();
    return fitting;
  });
}

/**
 * Values joined with their measurement definitions — the shape the matrix editor needs in
 * one call, mirroring `setProductMeasurements`'s `with: { measurementDefinition: true }`.
 */
export function getFitting(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const fitting = await requireProductFitting(tx, id);
    const values = await tx.query.fittingValues.findMany({
      where: eq(fittingValues.productFittingId, id),
      with: { measurementDefinition: true },
    });
    return { ...fitting, values };
  });
}

export function updateFitting(tenantId: string, id: string, input: UpdateFittingInput) {
  return withTenant(tenantId, async (tx) => {
    await requireProductFitting(tx, id);
    const [updated] = await tx
      .update(productFittings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(productFittings.id, id))
      .returning();
    return updated;
  });
}

export function softDeleteFitting(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireProductFitting(tx, id);
    await tx.update(productFittings).set({ deletedAt: new Date() }).where(eq(productFittings.id, id));
  });
}

/** Full replace of a fitting's per-measurement values, matching `setProductMeasurements`'s delete-then-reinsert shape. */
export function setFittingValues(tenantId: string, id: string, values: FittingValueInput[]) {
  return withTenant(tenantId, async (tx) => {
    await requireProductFitting(tx, id);
    for (const { measurementDefinitionId } of values) {
      await requireMeasurementDefinition(tx, measurementDefinitionId);
    }

    await tx.delete(fittingValues).where(eq(fittingValues.productFittingId, id));
    for (const { measurementDefinitionId, value } of values) {
      await tx.insert(fittingValues).values({ productFittingId: id, measurementDefinitionId, value });
    }

    return tx.query.fittingValues.findMany({
      where: eq(fittingValues.productFittingId, id),
      with: { measurementDefinition: true },
    });
  });
}
