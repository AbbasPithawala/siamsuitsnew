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
  }),
});

export const { useLoginMutation } = authApi;
