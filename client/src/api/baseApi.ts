import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

/**
 * Contract with Group 4's `src/features/auth/authSlice.ts` (not built yet):
 * the auth slice MUST be mounted in the store under the reducer key "auth"
 * and its state MUST expose the current token at `state.auth.token`
 * (`string | null`, present + truthy when logged in). `prepareHeaders`
 * below reads exactly that path. Until Group 4 exists, `state.auth` is
 * simply `undefined` and no Authorization header is sent.
 */
export interface AuthTokenSliceState {
  auth?: {
    token?: string | null;
  };
}

/**
 * Body shape siam/server sends on error responses, e.g. a 401 from an
 * expired/invalid token (see server/src/utils/http-error.ts and its
 * central error handler). `fetchBaseQuery` puts this on `error.data` of
 * the `FetchBaseQueryError` it returns, alongside `error.status` (the
 * HTTP status, or a string like "FETCH_ERROR" for network failures).
 * Group 4 checks `error.status === 401` on the `me` query to log the user
 * out on an expired token — nothing here needs to react to it.
 */
export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
  };
}

export type ApiError = FetchBaseQueryError;

export interface Me {
  id: string;
  name: string;
  username: string;
  actorType: "user" | "tailor" | "platform_admin";
  /** `null` only for `actorType: "platform_admin"` — a platform admin has no tenant (PHASE_11_TASKS.md Workstream A). */
  tenantId: string | null;
  /** Non-null only for a `retailer_users`-linked user (Workstream E Group 1) — null for staff, tailors, and platform admins. */
  retailerId: string | null;
  permissions: string[];
  /** Header branding (`AppShell.tsx`) — the retailer's own logo when `retailerId` is set, else the tenant's letterhead logo; a raw upload path, resolve with `resolveUploadUrl` before rendering. Always `null` for `actorType: "tailor" | "platform_admin"`. */
  logo: string | null;
  /** `true` only for a `user` who hasn't changed a temp/reset password yet — always `false` for tailors/platform admins (PHASE_11_TASKS.md Workstream D). */
  mustChangePassword: boolean;
  /** The caller's own tenant's onboarding-profile-completion flag — always `true` (inapplicable-but-harmless) for tailors/platform admins. */
  profileCompleted: boolean;
}

interface MeResponseEnvelope {
  data: Me;
}

/**
 * The single `createApi` instance for the whole app. Later groups/phases
 * add endpoints via `baseApi.injectEndpoints(...)` rather than calling
 * `createApi` again, so all server state shares one cache/tag namespace.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as AuthTokenSliceState).auth?.token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    "Product",
    "Process",
    "MeasurementDefinition",
    "ProductMeasurements",
    "SuperProduct",
    "Feature",
    "Fitting",
    "User",
    "Role",
    "Permission",
    "Retailer",
    "Tailor",
    "Customer",
    "Order",
    "OrderGroup",
    "ManufacturingComponent",
    "ExtraPaymentCategory",
    "ExtraPayment",
    "UnpaidJob",
    "Settlement",
    "Invoice",
    "OrderInvoice",
    "InvoiceSettings",
    "ShippingBox",
    "CustomerMeasurementProfile",
    "Me",
    "TenantRequest",
    "PlatformTenant",
  ],
  endpoints: (builder) => ({
    /**
     * `providesTags: ["Me"]` exists specifically so `PATCH /me/password`
     * (`authApi.ts`'s `changePassword`) and the onboarding-broadened
     * `PATCH /invoice-settings` (`invoiceSettingsApi.ts`'s `updateInvoiceSettings`,
     * PHASE_11_TASKS.md Workstream D3/G0) can `invalidatesTags: ["Me"]` to force
     * this query to refetch immediately after either action — both flip a flag
     * (`mustChangePassword`/`profileCompleted`) that `RequireProfileComplete`
     * reads straight out of this same cached response, so a stale cache entry
     * here would otherwise keep redirecting a user who has already cleared the
     * condition.
     */
    me: builder.query<Me, void>({
      query: () => "/me",
      transformResponse: (response: MeResponseEnvelope) => response.data,
      providesTags: ["Me"],
    }),
  }),
});

export const { useMeQuery } = baseApi;
