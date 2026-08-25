import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { tailors, tailorProcesses } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { omit } from "../utils/object";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";
import { hashPassword } from "./auth.service";
import { requireTailor } from "./manufacturing-helpers";
import { requireProcess } from "./catalog-helpers";

export interface CreateTailorInput {
  name: string;
  username: string;
  password: string;
  isActive?: boolean;
}

export type UpdateTailorInput = Partial<Omit<CreateTailorInput, "password">> & { password?: string };

/** Never let a `passwordHash` leak back out over the API — only `auth.service.ts`'s `verifyPassword` needs it. */
function sanitize<T extends { passwordHash: string }>(tailor: T) {
  return omit(tailor, ["passwordHash"]);
}

async function withCertifications(tx: Transaction, tailorId: string) {
  const links = await tx.query.tailorProcesses.findMany({
    where: eq(tailorProcesses.tailorId, tailorId),
    with: { process: true },
  });
  return links.map((link) => link.process);
}

export function createTailor(tenantId: string, input: CreateTailorInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const passwordHash = await hashPassword(input.password);
        const [tailor] = await tx
          .insert(tailors)
          .values({ tenantId, ...omit(input, ["password"]), passwordHash })
          .returning();
        if (!tailor) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create tailor");
        return sanitize(tailor);
      },
      "USERNAME_TAKEN",
      `A tailor with username "${input.username}" already exists`
    )
  );
}

export async function listTailors(tenantId: string, pagination: PaginationParams = DEFAULT_PAGINATION) {
  const { rows, total } = await withTenant(tenantId, async (tx) => {
    const where = isNull(tailors.deletedAt);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [rows, [countRow]] = await Promise.all([
      tx.query.tailors.findMany({ where, orderBy: (t, { asc }) => asc(t.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(tailors).where(where),
    ]);

    return { rows, total: countRow?.count ?? 0 };
  });
  return { data: rows.map(sanitize), total };
}

export function getTailor(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const tailor = await requireTailor(tx, id);
    return { ...sanitize(tailor), certifications: await withCertifications(tx, id) };
  });
}

export function updateTailor(tenantId: string, id: string, input: UpdateTailorInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireTailor(tx, id);
        const { password, ...rest } = input;
        const passwordHash = password ? await hashPassword(password) : undefined;

        const [updated] = await tx
          .update(tailors)
          .set({ ...rest, ...(passwordHash ? { passwordHash } : {}), updatedAt: new Date() })
          .where(eq(tailors.id, id))
          .returning();
        if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update tailor");
        return { ...sanitize(updated), certifications: await withCertifications(tx, id) };
      },
      "USERNAME_TAKEN",
      `A tailor with username "${input.username}" already exists`
    )
  );
}

export function softDeleteTailor(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireTailor(tx, id);
    await tx.update(tailors).set({ deletedAt: new Date() }).where(eq(tailors.id, id));
  });
}

/**
 * Certifying a tailor for the same process twice is an explicit 409 conflict, not a
 * silent no-op — same posture as `extra-payments.service.ts`'s `DUPLICATE_EXTRA_PAYMENT`/
 * `ALREADY_APPROVED`: this codebase surfaces "you already did this" rather than
 * swallowing it, so a caller can't mistake a no-op 200 for a certification that just
 * happened. The pre-check makes the common case a clean error; `catchUniqueViolation`
 * around the insert closes the race window the same way `createExtraPayment` does.
 */
export function certifyTailor(tenantId: string, tailorId: string, processId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireTailor(tx, tailorId);
    await requireProcess(tx, processId);

    const existing = await tx.query.tailorProcesses.findFirst({
      where: and(eq(tailorProcesses.tailorId, tailorId), eq(tailorProcesses.processId, processId)),
    });
    if (existing) {
      throw new HttpError(409, "ALREADY_CERTIFIED", `Tailor ${tailorId} is already certified for process ${processId}`);
    }

    await catchUniqueViolation(
      () => tx.insert(tailorProcesses).values({ tailorId, processId }),
      "ALREADY_CERTIFIED",
      `Tailor ${tailorId} is already certified for process ${processId}`
    );

    return withCertifications(tx, tailorId);
  });
}

export function decertifyTailor(tenantId: string, tailorId: string, processId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireTailor(tx, tailorId);

    const existing = await tx.query.tailorProcesses.findFirst({
      where: and(eq(tailorProcesses.tailorId, tailorId), eq(tailorProcesses.processId, processId)),
    });
    if (!existing) {
      throw new HttpError(404, "NOT_CERTIFIED", `Tailor ${tailorId} is not certified for process ${processId}`);
    }

    await tx.delete(tailorProcesses).where(eq(tailorProcesses.id, existing.id));

    return withCertifications(tx, tailorId);
  });
}
