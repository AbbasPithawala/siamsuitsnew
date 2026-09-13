import { baseApi } from "../../api/baseApi";

export interface LoginRequest {
  tenant: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

interface LoginResponseEnvelope {
  data: LoginResponse;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
}

interface ChangePasswordResponseEnvelope {
  data: ChangePasswordResponse;
}

/**
 * Injected into the single `baseApi` instance (per its own doc comment) so
 * this endpoint shares the same cache/tag namespace as everything else,
 * rather than standing up a second `createApi`.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      transformResponse: (response: LoginResponseEnvelope) => response.data,
    }),
    /**
     * `PATCH /me/password` (`server/src/routes/me.routes.ts`, PHASE_11_TASKS.md
     * Workstream D Group 1) — colocated here rather than in a new API file since
     * this is the one existing client file dedicated to "the current session's
     * own credentials." `invalidatesTags: ["Me"]` is what makes
     * `RequireProfileComplete` stop redirecting immediately after a successful
     * change, without a manual page reload (`ChangePasswordPage.tsx` still
     * explicitly awaits a `/me` refetch before navigating, since invalidation
     * alone only marks the cache stale — it doesn't block on the new response).
     */
    changePassword: builder.mutation<ChangePasswordResponse, ChangePasswordRequest>({
      query: (body) => ({
        url: "/me/password",
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ChangePasswordResponseEnvelope) => response.data,
      invalidatesTags: ["Me"],
    }),
  }),
});

export const { useLoginMutation, useChangePasswordMutation } = authApi;
