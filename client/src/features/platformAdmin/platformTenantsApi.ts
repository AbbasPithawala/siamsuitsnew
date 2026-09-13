import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/** Mirrors `server/src/db/schema/tenancy.ts`'s `tenants` table shape. */
export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  logo: string | null;
  address: string | null;
  invoiceFooterText: string | null;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlatformTenantResponseEnvelope {
  data: PlatformTenant;
}

/** `POST /api/platform/tenants` body — direct-provisioning counterpart to
 * `ApproveTenantRequestInput` (`tenantRequestsApi.ts`), same hybrid pre-fill reasoning:
 * only `businessName`/`slug`/`ownerName`/`ownerEmail` are required, the rest is optional
 * business-profile detail a superadmin can set now or leave for the new owner to fill in
 * on first login. */
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

export interface ProvisionedTenantOwnerUser {
  id: string;
  name: string;
  username: string;
}

export interface CreateTenantResult {
  tenant: PlatformTenant;
  ownerUser: ProvisionedTenantOwnerUser;
  /** Real, plaintext, one-time — same manual-relay reasoning as `ApproveTenantRequestResult.tempPassword`. */
  tempPassword: string;
}

interface CreateTenantResponseEnvelope {
  data: CreateTenantResult;
}

/** `PATCH /api/platform/tenants/:id` body — every field optional/partial, the same contract
 * `setTenantActive` below already relies on for its single-field `isActive` case. The server's
 * Zod schema (`updateTenantSchema`) types `logo`/`address`/`invoiceFooterText` as
 * `z.string().optional()` — `string | undefined`, never `null` (a literal `null` 400s with
 * "Expected string, received null"). To clear one of these on an existing tenant, send `""`,
 * not `null` — the service layer itself does the `input.logo || null` conversion server-side. */
export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  plan?: string;
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
  isActive?: boolean;
}

function listTenantsQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/platform/tenants?${qs}` : "/platform/tenants";
}

/**
 * PHASE_11_TASKS.md Workstream F Group 2 — `TenantsPage.tsx`'s data layer, calling
 * `server/src/routes/platformTenants.routes.ts`'s superadmin-only cross-tenant listing/
 * deactivation surface. `setTenantActive`'s cache invalidation is the whole mechanism behind
 * "toggling is reflected immediately without a manual refresh" (C Group 2's own acceptance
 * criterion) — no optimistic update needed, the round trip is a single small PATCH.
 */
export const platformTenantsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPlatformTenants: builder.query<PaginatedResponse<PlatformTenant>, PaginationQueryParams>({
      query: listTenantsQuery,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((tenant) => ({ type: "PlatformTenant" as const, id: tenant.id })),
              { type: "PlatformTenant" as const, id: "LIST" },
            ]
          : [{ type: "PlatformTenant" as const, id: "LIST" }],
    }),
    setTenantActive: builder.mutation<PlatformTenant, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({ url: `/platform/tenants/${id}`, method: "PATCH", body: { isActive } }),
      transformResponse: (response: PlatformTenantResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "PlatformTenant", id },
        { type: "PlatformTenant", id: "LIST" },
      ],
    }),
    createTenant: builder.mutation<CreateTenantResult, CreateTenantInput>({
      query: (body) => ({ url: "/platform/tenants", method: "POST", body }),
      transformResponse: (response: CreateTenantResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "PlatformTenant", id: "LIST" }],
    }),
    updateTenant: builder.mutation<PlatformTenant, { id: string; body: UpdateTenantInput }>({
      query: ({ id, body }) => ({ url: `/platform/tenants/${id}`, method: "PATCH", body }),
      transformResponse: (response: PlatformTenantResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "PlatformTenant", id },
        { type: "PlatformTenant", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListPlatformTenantsQuery,
  useSetTenantActiveMutation,
  useCreateTenantMutation,
  useUpdateTenantMutation,
} = platformTenantsApi;
