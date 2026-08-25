import { eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { extraPaymentCategories } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";
import { requireFeature, requireProcess, requireProduct, requireStyle } from "./catalog-helpers";

export interface CreateExtraPaymentCategoryInput {
  productId: string;
  processId: string;
  featureId?: string;
  styleId?: string;
  name: string;
  thaiName?: string;
  cost?: string;
}

export type UpdateExtraPaymentCategoryInput = Partial<CreateExtraPaymentCategoryInput>;

/** `extra_payment_categories` carries its own `tenant_id`/RLS policy, same as `processes`/`products` — no join-table walk needed. */
export async function requireExtraPaymentCategory(tx: Transaction, id: string) {
  const category = await tx.query.extraPaymentCategories.findFirst({
    where: (c, { and, eq: eqOp, isNull: isNullOp }) => and(eqOp(c.id, id), isNullOp(c.deletedAt)),
  });
  if (!category) throw new HttpError(404, "EXTRA_PAYMENT_CATEGORY_NOT_FOUND", `Extra payment category ${id} not found`);
  return category;
}

async function validateReferences(tx: Transaction, input: Partial<CreateExtraPaymentCategoryInput>) {
  if (input.productId) await requireProduct(tx, input.productId);
  if (input.processId) await requireProcess(tx, input.processId);
  if (input.featureId) await requireFeature(tx, input.featureId);
  if (input.styleId) await requireStyle(tx, input.styleId);
}

export function createExtraPaymentCategory(tenantId: string, input: CreateExtraPaymentCategoryInput) {
  return withTenant(tenantId, async (tx) => {
    await validateReferences(tx, input);

    const [category] = await tx.insert(extraPaymentCategories).values({ tenantId, ...input }).returning();
    if (!category) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create extra payment category");
    return category;
  });
}

export function listExtraPaymentCategories(tenantId: string, pagination: PaginationParams = DEFAULT_PAGINATION) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(extraPaymentCategories.deletedAt);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.extraPaymentCategories.findMany({ where, orderBy: (c, { asc }) => asc(c.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(extraPaymentCategories).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

export function getExtraPaymentCategory(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => requireExtraPaymentCategory(tx, id));
}

export function updateExtraPaymentCategory(tenantId: string, id: string, input: UpdateExtraPaymentCategoryInput) {
  return withTenant(tenantId, async (tx) => {
    await requireExtraPaymentCategory(tx, id);
    await validateReferences(tx, input);

    const [updated] = await tx
      .update(extraPaymentCategories)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(extraPaymentCategories.id, id))
      .returning();
    if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update extra payment category");
    return updated;
  });
}

export function softDeleteExtraPaymentCategory(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireExtraPaymentCategory(tx, id);
    await tx.update(extraPaymentCategories).set({ deletedAt: new Date() }).where(eq(extraPaymentCategories.id, id));
  });
}
