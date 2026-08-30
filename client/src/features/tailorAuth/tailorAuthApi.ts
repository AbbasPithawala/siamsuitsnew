import { baseApi } from "../../api/baseApi";

export interface TailorLoginRequest {
  tenant: string;
  username: string;
  password: string;
}

export interface TailorLoginResponse {
  token: string;
}

interface TailorLoginResponseEnvelope {
  data: TailorLoginResponse;
}

/**
 * Mirrors `features/auth/authApi.ts`'s `login` exactly, just posting to the tailor login
 * endpoint (`server/src/routes/tailor.routes.ts`'s `POST /api/tailor/login`) instead of
 * the staff one — same JWT mechanism (`issueToken`/`verifyToken`), same
 * `authSlice`/`loginSucceeded` token storage on the client, only the actor type embedded
 * in the resulting token differs.
 */
export const tailorAuthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    tailorLogin: builder.mutation<TailorLoginResponse, TailorLoginRequest>({
      query: (body) => ({
        url: "/tailor/login",
        method: "POST",
        body,
      }),
      transformResponse: (response: TailorLoginResponseEnvelope) => response.data,
    }),
  }),
});

export const { useTailorLoginMutation } = tailorAuthApi;
