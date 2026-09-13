import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

export type TenantRequestStatus = "pending" | "approved" | "rejected";

/** Mirrors `server/src/db/schema/platform.ts`'s `tenant_requests` table shape. */
export interface TenantRequest {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  requestedSlug: string;
  notes: string | null;
  status: TenantRequestStatus;
  reviewedByPlatformAdminId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdTenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListTenantRequestsParams extends PaginationQueryParams {
  status?: TenantRequestStatus;
}

/** The hybrid pre-fill surface (PHASE_11_TASKS.md Workstream C5/F Group 1) — every field optional. */
export interface ApproveTenantRequestInput {
  slug?: string;
  plan?: string;
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
}

export interface RejectTenantRequestInput {
  reason: string;
}

/** `provisionTenant()`'s real return shape (`provisioning.service.ts`), as relayed by the approve route. */
export interface ProvisionedTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface ProvisionedOwnerUser {
  id: string;
  name: string;
  username: string;
}

export interface ApproveTenantRequestResult {
  request: TenantRequest;
  tenant: ProvisionedTenant;
  ownerUser: ProvisionedOwnerUser;
  /** Real, plaintext, one-time — the superadmin's manual-relay fallback when `emailSent` is false (C4). */
  tempPassword: string;
  emailSent: boolean;
}

interface TenantRequestResponseEnvelope {
  data: TenantRequest;
}

interface ApproveTenantRequestResponseEnvelope {
  data: ApproveTenantRequestResult;
}

function listTenantRequestsQuery(args: ListTenantRequestsParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  if (args.status !== undefined) params.set("status", args.status);
  const qs = params.toString();
  return qs ? `/platform/tenant-requests?${qs}` : "/platform/tenant-requests";
}

/**
 * PHASE_11_TASKS.md Workstream F Group 1 — `TenantRequestsPage.tsx`'s data layer. List/detail
 * mirror `server/src/routes/tenantRequests.routes.ts`'s superadmin-gated routes exactly (the
 * public `POST /tenant-requests` itself lives in `requestAccess/requestAccessApi.ts`, a
 * separate concern with a separate caller). Approve/reject both invalidate the `LIST` tag (so
 * the table refreshes without a manual reload) and the individual request's own tag.
 */
export const tenantRequestsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTenantRequests: builder.query<PaginatedResponse<TenantRequest>, ListTenantRequestsParams>({
      query: listTenantRequestsQuery,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((request) => ({ type: "TenantRequest" as const, id: request.id })),
              { type: "TenantRequest" as const, id: "LIST" },
            ]
          : [{ type: "TenantRequest" as const, id: "LIST" }],
    }),
    getTenantRequest: builder.query<TenantRequest, string>({
      query: (id) => `/platform/tenant-requests/${id}`,
      transformResponse: (response: TenantRequestResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "TenantRequest", id }],
    }),
    approveTenantRequest: builder.mutation<ApproveTenantRequestResult, { id: string; body: ApproveTenantRequestInput }>({
      query: ({ id, body }) => ({ url: `/platform/tenant-requests/${id}/approve`, method: "POST", body }),
      transformResponse: (response: ApproveTenantRequestResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "TenantRequest", id },
        { type: "TenantRequest", id: "LIST" },
        { type: "PlatformTenant", id: "LIST" },
      ],
    }),
    rejectTenantRequest: builder.mutation<TenantRequest, { id: string; body: RejectTenantRequestInput }>({
      query: ({ id, body }) => ({ url: `/platform/tenant-requests/${id}/reject`, method: "POST", body }),
      transformResponse: (response: TenantRequestResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "TenantRequest", id },
        { type: "TenantRequest", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListTenantRequestsQuery,
  useGetTenantRequestQuery,
  useApproveTenantRequestMutation,
  useRejectTenantRequestMutation,
} = tenantRequestsApi;
