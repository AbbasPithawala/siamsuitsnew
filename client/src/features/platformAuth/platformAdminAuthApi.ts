import { baseApi } from "../../api/baseApi";

export interface PlatformAdminLoginRequest {
  username: string;
  password: string;
}

export interface PlatformAdminLoginResponse {
  token: string;
}

interface PlatformAdminLoginResponseEnvelope {
  data: PlatformAdminLoginResponse;
}

/**
 * Mirrors `tailorAuth/tailorAuthApi.ts`'s `login` exactly, posting to the
 * platform-admin login endpoint (`server/src/routes/platformAuth.routes.ts`'s
 * `POST /api/platform/login`) instead — same JWT mechanism, same
 * `authSlice`/`loginSucceeded` token storage on the client. The one real
 * shape difference from both the staff and tailor login bodies: no `tenant`
 * field — platform admins aren't tenant members.
 */
export const platformAdminAuthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    platformAdminLogin: builder.mutation<PlatformAdminLoginResponse, PlatformAdminLoginRequest>({
      query: (body) => ({
        url: "/platform/login",
        method: "POST",
        body,
      }),
      transformResponse: (response: PlatformAdminLoginResponseEnvelope) => response.data,
    }),
  }),
});

export const { usePlatformAdminLoginMutation } = platformAdminAuthApi;
