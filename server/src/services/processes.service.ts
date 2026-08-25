import { eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { processes, productProcesses } from "../db/schema/index";
import { catchUniqueViolation } from "../utils/db-errors";
import { requireProcess, requireProduct } from "./catalog-helpers";
import { toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export interface CreateProcessInput {
  name: string;
  thaiName?: string;
  price?: string;
}

export type UpdateProcessInput = Partial<CreateProcessInput>;

export function createProcess(tenantId: string, input: CreateProcessInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const [process] = await tx.insert(processes).values({ tenantId, ...input }).returning();
        return process;
      },
      "PROCESS_NAME_TAKEN",
      `A process named "${input.name}" already exists`
    )
  );
}

/**
 * Opt-in pagination (PHASE_10_TASKS.md Workstream C) — omitting `pagination` keeps
 * returning the full unpaginated list, for the order-builder's own callers.
 */
export function listProcesses(tenantId: string): Promise<(typeof processes.$inferSelect)[]>;
export function listProcesses(tenantId: string, pagination: PaginationParams): Promise<{ data: (typeof processes.$inferSelect)[]; total: number }>;
export function listProcesses(tenantId: string, pagination?: PaginationParams) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(processes.deletedAt);
    if (!pagination) {
      return tx.query.processes.findMany({ where, orderBy: (p, { asc }) => asc(p.name) });
    }

    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);
    const [data, [countRow]] = await Promise.all([
      tx.query.processes.findMany({ where, orderBy: (p, { asc }) => asc(p.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(processes).where(where),
    ]);
    return { data, total: countRow?.count ?? 0 };
  });
}

export function getProcess(tenantId: string, id: string) {
  return withTenant(tenantId, (tx) => requireProcess(tx, id));
}

export function updateProcess(tenantId: string, id: string, input: UpdateProcessInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireProcess(tx, id);
        const [updated] = await tx
          .update(processes)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(processes.id, id))
          .returning();
        return updated;
      },
      "PROCESS_NAME_TAKEN",
      `A process named "${input.name}" already exists`
    )
  );
}

export function softDeleteProcess(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireProcess(tx, id);
    await tx.update(processes).set({ deletedAt: new Date() }).where(eq(processes.id, id));
  });
}

/** Full replace: the client resends the complete ordered list of process IDs to reorder. */
export function setProductProcessSequence(tenantId: string, productId: string, processIds: string[]) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    for (const processId of processIds) {
      await requireProcess(tx, processId);
    }

    await tx.delete(productProcesses).where(eq(productProcesses.productId, productId));
    for (const [index, processId] of processIds.entries()) {
      await tx.insert(productProcesses).values({ productId, processId, sequenceOrder: index + 1 });
    }

    return getProductProcessSequence(tx, productId);
  });
}

export function getProductProcessSequenceForProduct(tenantId: string, productId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireProduct(tx, productId);
    return getProductProcessSequence(tx, productId);
  });
}

function getProductProcessSequence(tx: Transaction, productId: string) {
  return tx.query.productProcesses.findMany({
    where: eq(productProcesses.productId, productId),
    orderBy: (pp, { asc }) => asc(pp.sequenceOrder),
    with: { process: true },
  });
}
