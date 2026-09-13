import { baseApi } from "../../api/baseApi";

export interface CreateTenantRequestBody {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  requestedSlug: string;
  notes?: string;
}

export interface TenantRequest {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  requestedSlug: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
}

interface TenantRequestResponseEnvelope {
  data: TenantRequest;
}

/**
 * `POST /api/platform/tenant-requests` — the one genuinely public write
 * endpoint in the whole API (PHASE_11_TASKS.md Workstream B Group 1). No
 * auth header needed: `baseApi`'s `prepareHeaders` already harmlessly omits
 * the `Authorization` header whenever `state.auth.token` is falsy, same as
 * every other unauthenticated request today — no special-casing here.
 */
export const requestAccessApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createTenantRequest: builder.mutation<TenantRequest, CreateTenantRequestBody>({
      query: (body) => ({
        url: "/platform/tenant-requests",
        method: "POST",
        body,
      }),
      transformResponse: (response: TenantRequestResponseEnvelope) => response.data,
    }),
  }),
});

export const { useCreateTenantRequestMutation } = requestAccessApi;
