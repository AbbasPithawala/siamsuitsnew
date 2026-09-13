import { eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { tenants } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";
import { provisionTenant, PROVISIONED_OWNER_USERNAME } from "./provisioning.service";

/**
 * `tenants` itself carries no `tenant_id`/RLS policy (it's the root tenant row — see
 * `0001_enable_row_level_security.sql`'s own comment), so every function here is a plain
 * `db` query, not `withTenant` — there's no single tenant to scope a superadmin's
 * cross-tenant browse/edit to.
 */

export async function listTenants(pagination: PaginationParams = DEFAULT_PAGINATION) {
  const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

  const [data, [countRow]] = await Promise.all([
    db.query.tenants.findMany({ orderBy: (t, { asc }) => asc(t.name), limit, offset }),
    db.select({ count: sql<number>`count(*)::int` }).from(tenants),
  ]);

  return { data, total: countRow?.count ?? 0 };
}

export interface CreateTenantInput {
  businessName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  plan?: string;
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
}

/**
 * Direct superadmin-initiated creation — bypasses the request/approve flow entirely (there's
 * no `tenant_requests` row here), but otherwise provisions identically to an approved request:
 * same `provisionTenant()`, same fixed owner username, same forced-password-change default.
 */
export function createTenant(input: CreateTenantInput) {
  const profileFieldsProvided =
    input.logo !== undefined || input.address !== undefined || input.invoiceFooterText !== undefined;

  return provisionTenant({
    businessName: input.businessName,
    slug: input.slug,
    ...(input.plan !== undefined ? { plan: input.plan } : {}),
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    ownerUsername: PROVISIONED_OWNER_USERNAME,
    ...(profileFieldsProvided
      ? {
          profileFields: {
            ...(input.logo !== undefined ? { logo: input.logo } : {}),
            ...(input.address !== undefined ? { address: input.address } : {}),
            ...(input.invoiceFooterText !== undefined ? { invoiceFooterText: input.invoiceFooterText } : {}),
          },
        }
      : {}),
  });
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  plan?: string;
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
  isActive?: boolean;
}

/**
 * Full tenant edit (name/slug/plan/letterhead/active state), all fields optional — same
 * "only touch fields present" convention as `updateTenantSettings`. `slug` is the one field
 * that can collide (`tenants_slug_unique`), so it's the only case wrapped in
 * `catchUniqueViolation` — no other column on `tenants` has a unique constraint.
 */
export async function updateTenant(id: string, input: UpdateTenantInput) {
  const isLetterheadUpdate = input.logo !== undefined || input.address !== undefined || input.invoiceFooterText !== undefined;

  const setValues = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.plan !== undefined ? { plan: input.plan } : {}),
    ...(input.logo !== undefined ? { logo: input.logo || null } : {}),
    ...(input.address !== undefined ? { address: input.address || null } : {}),
    ...(input.invoiceFooterText !== undefined ? { invoiceFooterText: input.invoiceFooterText || null } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    // Mirrors `updateTenantSettings`'s own rule: a real letterhead update — whether made by
    // the tenant itself or, here, by a superadmin on its behalf — satisfies onboarding.
    ...(isLetterheadUpdate ? { profileCompleted: true } : {}),
    updatedAt: new Date(),
  };

  const runUpdate = () => db.update(tenants).set(setValues).where(eq(tenants.id, id)).returning();

  const [updated] =
    input.slug !== undefined
      ? await catchUniqueViolation(runUpdate, "TENANT_SLUG_TAKEN", `A tenant with slug "${input.slug}" already exists`)
      : await runUpdate();

  if (!updated) throw new HttpError(404, "TENANT_NOT_FOUND", `Tenant ${id} not found`);
  return updated;
}

export function setTenantActive(id: string, isActive: boolean) {
  return updateTenant(id, { isActive });
}
