import { eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { tenantRequests } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { DEFAULT_PAGINATION, toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";
import { slugifyBusinessName } from "../utils/slug";
import { generateUniqueTenantSlug, provisionTenant, PROVISIONED_OWNER_USERNAME } from "./provisioning.service";

/**
 * `tenant_requests` is a global table (PHASE_11_TASKS.md Convention 1) — a request exists
 * before any tenant does, so this never goes through `withTenant`. Approve/reject
 * transitions are Workstream C Group 1's scope, not this file's — this is submit + read only.
 */

export interface CreateTenantRequestInput {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  notes?: string;
}

export type TenantRequestStatus = "pending" | "approved" | "rejected";

/**
 * `requestedSlug` is never collected from the requester — it's derived from `businessName`
 * (`slugifyBusinessName`). No uniqueness check against other requests/tenants here (see this
 * table's own schema comment): it's purely informational until approval, where
 * `approveTenantRequest()` re-derives and dedupes it for real against `tenants.slug`.
 */
export async function createTenantRequest(input: CreateTenantRequestInput) {
  const [request] = await db
    .insert(tenantRequests)
    .values({ ...input, requestedSlug: slugifyBusinessName(input.businessName) })
    .returning();
  if (!request) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create tenant request");
  return request;
}

export async function listTenantRequests(pagination: PaginationParams = DEFAULT_PAGINATION, status?: TenantRequestStatus) {
  const where = status ? eq(tenantRequests.status, status) : undefined;
  const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);

  const [data, [countRow]] = await Promise.all([
    db.query.tenantRequests.findMany({ where, orderBy: (t, { desc }) => desc(t.createdAt), limit, offset }),
    db.select({ count: sql<number>`count(*)::int` }).from(tenantRequests).where(where),
  ]);

  return { data, total: countRow?.count ?? 0 };
}

export async function getTenantRequest(id: string) {
  const request = await db.query.tenantRequests.findFirst({ where: eq(tenantRequests.id, id) });
  if (!request) throw new HttpError(404, "TENANT_REQUEST_NOT_FOUND", `Tenant request ${id} not found`);
  return request;
}

export interface ApproveTenantRequestOverrides {
  plan?: string;
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
}

/**
 * PHASE_11_TASKS.md Workstream C Group 1 / C3: only flips the request to `approved` (setting
 * `reviewedByPlatformAdminId`/`reviewedAt`/`createdTenantId`) after `provisionTenant()` has
 * already returned successfully — if it throws, the request row is left untouched, still
 * `pending`, visibly retryable from the superadmin's own queue.
 *
 * `slug` is never an override here — it's re-derived from `request.businessName` via
 * `generateUniqueTenantSlug()`, the same auto-generated-and-unique rule `createTenant()` uses
 * for direct creation, rather than trusting the request's own `requestedSlug` (which was never
 * checked for collisions when the request was submitted).
 */
export async function approveTenantRequest(id: string, platformAdminId: string, overrides: ApproveTenantRequestOverrides = {}) {
  const request = await getTenantRequest(id);
  if (request.status !== "pending") {
    throw new HttpError(409, "TENANT_REQUEST_NOT_PENDING", `Tenant request ${id} is already ${request.status}`);
  }

  const profileFieldsProvided =
    overrides.logo !== undefined || overrides.address !== undefined || overrides.invoiceFooterText !== undefined;
  const slug = await generateUniqueTenantSlug(request.businessName);

  const provisioned = await provisionTenant({
    businessName: request.businessName,
    slug,
    ...(overrides.plan !== undefined ? { plan: overrides.plan } : {}),
    ownerName: request.contactName,
    ownerEmail: request.email,
    ownerUsername: PROVISIONED_OWNER_USERNAME,
    ...(profileFieldsProvided
      ? {
          profileFields: {
            ...(overrides.logo !== undefined ? { logo: overrides.logo } : {}),
            ...(overrides.address !== undefined ? { address: overrides.address } : {}),
            ...(overrides.invoiceFooterText !== undefined ? { invoiceFooterText: overrides.invoiceFooterText } : {}),
          },
        }
      : {}),
  });

  const [updatedRequest] = await db
    .update(tenantRequests)
    .set({
      status: "approved",
      reviewedByPlatformAdminId: platformAdminId,
      reviewedAt: new Date(),
      createdTenantId: provisioned.tenant.id,
      updatedAt: new Date(),
    })
    .where(eq(tenantRequests.id, id))
    .returning();
  if (!updatedRequest) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update tenant request after provisioning");

  return { request: updatedRequest, ...provisioned };
}

export async function rejectTenantRequest(id: string, platformAdminId: string, reason: string) {
  const request = await getTenantRequest(id);
  if (request.status !== "pending") {
    throw new HttpError(409, "TENANT_REQUEST_NOT_PENDING", `Tenant request ${id} is already ${request.status}`);
  }

  const [updatedRequest] = await db
    .update(tenantRequests)
    .set({
      status: "rejected",
      rejectionReason: reason,
      reviewedByPlatformAdminId: platformAdminId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tenantRequests.id, id))
    .returning();
  if (!updatedRequest) throw new HttpError(500, "INTERNAL_ERROR", "Failed to update tenant request");

  return updatedRequest;
}
