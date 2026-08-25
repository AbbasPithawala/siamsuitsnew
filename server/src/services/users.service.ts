import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { users, userRoles, retailerUsers } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { omit } from "../utils/object";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";
import { hashPassword } from "./auth.service";
import { requireRole } from "./roles.service";
import { requireRetailer } from "./customers.service";

export interface CreateUserInput {
  name: string;
  username: string;
  password: string;
  isActive?: boolean;
  /** Undefined = untouched, `null` = no retailer link, a uuid = linked to that retailer. */
  retailerId?: string | null;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & { password?: string };

/** Never let a `passwordHash` leak back out over the API — same posture as `tailors.service.ts`. */
function sanitize<T extends { passwordHash: string }>(user: T) {
  return omit(user, ["passwordHash"]);
}

/** `users` carries `tenant_id` and an RLS policy, so resolving it through a `withTenant`-scoped `tx` already proves tenant ownership — see `catalog-helpers.ts` for the same pattern. */
export async function requireUser(tx: Transaction, userId: string) {
  const user = await tx.query.users.findFirst({
    where: (u, { and: andOp, eq: eqOp, isNull: isNullOp }) => andOp(eqOp(u.id, userId), isNullOp(u.deletedAt)),
  });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", `User ${userId} not found`);
  return user;
}

async function withRoles(tx: Transaction, userId: string) {
  const links = await tx.query.userRoles.findMany({
    where: eq(userRoles.userId, userId),
    with: { role: true },
  });
  return links.map((link) => link.role);
}

async function withRetailerId(tx: Transaction, userId: string): Promise<string | null> {
  const link = await tx.query.retailerUsers.findFirst({ where: eq(retailerUsers.userId, userId) });
  return link?.retailerId ?? null;
}

/**
 * Keeps the user's one `retailer_users` row in sync with `retailerId`, matching the
 * `retailer_users_user_id_unique` constraint (a user is linked to at most one retailer) —
 * always deletes any existing row first, so re-assigning replaces it rather than adding a
 * second one. `null` removes the link entirely (converting a retailer user back to plain
 * staff — role/permission assignment via `user_roles` is untouched by this).
 */
async function syncRetailerLink(tx: Transaction, userId: string, retailerId: string | null) {
  if (retailerId) await requireRetailer(tx, retailerId);
  await tx.delete(retailerUsers).where(eq(retailerUsers.userId, userId));
  if (retailerId) await tx.insert(retailerUsers).values({ userId, retailerId });
}

/**
 * Blocks deactivating, deleting, or unassigning a system role from whoever is currently
 * the tenant's last active holder of it — the real-world failure mode legacy's hardcoded
 * `role_name === "administrator"` check was guarding against (PHASE_8_TASKS.md Group 3),
 * reworked for a multi-role system: it's not about protecting one specific user, it's
 * about never letting a tenant lock itself out of its own system role entirely.
 */
async function assertNotLastActiveSystemRoleHolder(tx: Transaction, userId: string, options?: { onlyRoleId?: string }) {
  const links = await tx.query.userRoles.findMany({ where: eq(userRoles.userId, userId), with: { role: true } });
  for (const link of links) {
    if (!link.role.isSystem || link.role.deletedAt) continue;
    if (options?.onlyRoleId && link.roleId !== options.onlyRoleId) continue;

    const holders = await tx.query.userRoles.findMany({ where: eq(userRoles.roleId, link.roleId), with: { user: true } });
    const activeHolderCount = holders.filter((h) => h.user.isActive && !h.user.deletedAt).length;
    if (activeHolderCount <= 1) {
      throw new HttpError(
        409,
        "LAST_SYSTEM_ROLE_HOLDER",
        `User ${userId} is the tenant's last active holder of system role ${link.roleId} — this would leave the tenant with no one able to administer it`
      );
    }
  }
}

export function createUser(tenantId: string, input: CreateUserInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const passwordHash = await hashPassword(input.password);
        const [user] = await tx
          .insert(users)
          .values({ tenantId, ...omit(input, ["password", "retailerId"]), passwordHash })
          .returning();
        if (!user) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create user");
        if (input.retailerId !== undefined) await syncRetailerLink(tx, user.id, input.retailerId);
        return { ...sanitize(user), retailerId: await withRetailerId(tx, user.id) };
      },
      "USERNAME_TAKEN",
      `A user with username "${input.username}" already exists`
    )
  );
}

export async function listUsers(tenantId: string, pagination: PaginationParams = DEFAULT_PAGINATION) {
  const { rows, total } = await withTenant(tenantId, async (tx) => {
    const where = isNull(users.deletedAt);
    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

    const [rows, [countRow]] = await Promise.all([
      tx.query.users.findMany({ where, orderBy: (u, { asc }) => asc(u.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
    ]);

    return { rows, total: countRow?.count ?? 0 };
  });
  return { data: rows.map(sanitize), total };
}

export function getUser(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const user = await requireUser(tx, id);
    return { ...sanitize(user), roles: await withRoles(tx, id), retailerId: await withRetailerId(tx, id) };
  });
}

export function updateUser(tenantId: string, id: string, input: UpdateUserInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireUser(tx, id);
        const { password, retailerId, ...rest } = input;
        const passwordHash = password ? await hashPassword(password) : undefined;

        if (rest.isActive === false) {
          await assertNotLastActiveSystemRoleHolder(tx, id);
        }

        const [updated] = await tx
          .update(users)
          .set({ ...rest, ...(passwordHash ? { passwordHash } : {}), updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();
        if (!updated) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update user");
        if (retailerId !== undefined) await syncRetailerLink(tx, id, retailerId);
        return { ...sanitize(updated), roles: await withRoles(tx, id), retailerId: await withRetailerId(tx, id) };
      },
      "USERNAME_TAKEN",
      `A user with username "${input.username}" already exists`
    )
  );
}

export function softDeleteUser(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireUser(tx, id);
    await assertNotLastActiveSystemRoleHolder(tx, id);
    await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
  });
}

/**
 * Assigning a user the same role twice is an explicit 409 conflict, not a silent no-op —
 * same posture as `tailors.service.ts`'s `certifyTailor`/`ALREADY_CERTIFIED` and
 * `roles.service.ts`'s `addPermission`/`ALREADY_GRANTED`.
 */
export function assignRole(tenantId: string, userId: string, roleId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireUser(tx, userId);
    await requireRole(tx, roleId);

    const existing = await tx.query.userRoles.findFirst({
      where: and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)),
    });
    if (existing) {
      throw new HttpError(409, "ALREADY_ASSIGNED", `User ${userId} already has role ${roleId}`);
    }

    await catchUniqueViolation(
      () => tx.insert(userRoles).values({ userId, roleId }),
      "ALREADY_ASSIGNED",
      `User ${userId} already has role ${roleId}`
    );

    return withRoles(tx, userId);
  });
}

export function unassignRole(tenantId: string, userId: string, roleId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireUser(tx, userId);

    const existing = await tx.query.userRoles.findFirst({
      where: and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)),
    });
    if (!existing) {
      throw new HttpError(404, "NOT_ASSIGNED", `User ${userId} does not have role ${roleId}`);
    }

    await assertNotLastActiveSystemRoleHolder(tx, userId, { onlyRoleId: roleId });

    await tx.delete(userRoles).where(eq(userRoles.id, existing.id));

    return withRoles(tx, userId);
  });
}
