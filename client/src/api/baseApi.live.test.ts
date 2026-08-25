import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import { baseApi } from "./baseApi";
import type { ApiErrorBody, ApiError, AuthTokenSliceState } from "./baseApi";

// RTK Query types a query-thunk result's `.error` as
// `FetchBaseQueryError | SerializedError` (the latter covers uncaught
// exceptions inside the query fn itself, which `fetchBaseQuery` doesn't
// throw). This narrows it back to the shape we actually expect here.
function isFetchBaseQueryError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "status" in error;
}

/**
 * Integration test against a real, running `siam/server` (not mocked) —
 * proves the `me` endpoint works end to end through the actual RTK Query
 * pipeline: baseUrl resolution, the auth header, fetch, and parsing.
 *
 * `authSlice` (Group 4) doesn't exist yet, so this seeds a throwaway
 * reducer under the "auth" key matching the documented `state.auth.token`
 * contract from baseApi.ts, instead of a real slice.
 *
 * If the server isn't reachable, these tests skip themselves rather than
 * failing `npm test` for anyone who hasn't started it locally.
 */

// Seeded Phase 3 dev fixture on the local server — not a production secret.
const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

let seededToken: string | null = null;
try {
  const res = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SEED_CREDENTIALS),
  });
  if (res.ok) {
    const body = (await res.json()) as { data: { token: string } };
    seededToken = body.data.token;
  }
} catch {
  seededToken = null;
}

function buildTestStore(authState: { token?: string | null } | undefined) {
  const authReducer = (state: AuthTokenSliceState["auth"] = authState) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

describe.skipIf(!seededToken)("baseApi `me` query (live siam/server integration)", () => {
  it("returns real /me data given a seeded auth token", async () => {
    const store = buildTestStore({ token: seededToken });

    const result = await store.dispatch(baseApi.endpoints.me.initiate());

    expect(result.error).toBeUndefined();
    expect(result.data).toMatchObject({
      username: SEED_CREDENTIALS.username,
      actorType: "user",
    });
    expect(result.data?.permissions.length).toBeGreaterThan(0);
  });

  it("surfaces a 401 as a plain, inspectable FetchBaseQueryError (error.status)", async () => {
    const store = buildTestStore({ token: "not-a-real-token" });

    const result = await store.dispatch(baseApi.endpoints.me.initiate());

    expect(result.data).toBeUndefined();
    if (!isFetchBaseQueryError(result.error)) {
      throw new Error("expected a FetchBaseQueryError");
    }
    expect(result.error.status).toBe(401);
    expect((result.error.data as ApiErrorBody).error.code).toBe("UNAUTHORIZED");
  });
});
