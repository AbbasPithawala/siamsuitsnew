import { eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import { retailers } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { requireRetailer } from "./customers.service";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export interface CreateRetailerInput {
  name: string;
  code: string;
  ownerName?: string;
  logo?: string;
  address?: string;
  phone?: string;
  emailRecipients?: string[];
  isActive?: boolean;
}

export type UpdateRetailerInput = Partial<CreateRetailerInput>;

export function createRetailer(tenantId: string, input: CreateRetailerInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const [retailer] = await tx.insert(retailers).values({ tenantId, ...input }).returning();
        if (!retailer) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create retailer");
        return retailer;
      },
      "RETAILER_CODE_TAKEN",
      `A retailer with code "${input.code}" already exists`
    )
  );
}

export function listRetailers(tenantId: string, pagination: PaginationParams = DEFAULT_PAGINATION) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(retailers.deletedAt);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [data, [countRow]] = await Promise.all([
      tx.query.retailers.findMany({ where, orderBy: (r, { asc }) => asc(r.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(retailers).where(where),
    ]);

    return { data, total: countRow?.count ?? 0 };
  });
}

export function getRetailer(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => requireRetailer(tx, id));
}

export function updateRetailer(tenantId: string, id: string, input: UpdateRetailerInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireRetailer(tx, id);
        const [updated] = await tx
          .update(retailers)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(retailers.id, id))
          .returning();
        if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update retailer");
        return updated;
      },
      "RETAILER_CODE_TAKEN",
      `A retailer with code "${input.code}" already exists`
    )
  );
}

export function softDeleteRetailer(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireRetailer(tx, id);
    await tx.update(retailers).set({ deletedAt: new Date() }).where(eq(retailers.id, id));
  });
}
