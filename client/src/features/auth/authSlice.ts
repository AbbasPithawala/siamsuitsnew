import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { baseApi } from "../../api/baseApi";
import type { AppDispatch } from "../../app/store";

export const AUTH_TOKEN_STORAGE_KEY = "siam_auth_token";

export interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    clearToken: (state) => {
      state.token = null;
    },
  },
});

export const { setToken, clearToken } = authSlice.actions;
export default authSlice.reducer;

/**
 * Reads the persisted token synchronously, for use as `configureStore`'s
 * `preloadedState` — NOT as a post-mount `useEffect`. A route guard
 * (`RequireAuth`/`LoginRoute`) makes its allow/redirect decision on the
 * store's very first render; if restoration instead happened in an effect,
 * that first render would still see `token: null` and redirect away before
 * the effect had a chance to run, so a deep link to e.g. `/retailers` with
 * a perfectly valid persisted session would incorrectly bounce through
 * `/login` (and, since a restored token immediately looks "authenticated"
 * to `LoginRoute`, on to `/orders`) instead of landing on `/retailers`.
 * Reading it into `preloadedState` up front means the guard's first render
 * already has the real answer.
 */
export function readStoredToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

/**
 * Wraps `setToken` with the localStorage write a successful login needs.
 * Kept out of the reducer itself so the slice stays a pure state container
 * (easy to unit-test / seed directly in tests) while call sites don't have
 * to remember the persistence step separately.
 */
export const loginSucceeded = (token: string) => (dispatch: AppDispatch) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  dispatch(setToken(token));
};

/**
 * Full logout: clears the slice, clears localStorage, and resets the RTK
 * Query cache. The cache reset matters here even though it's a hand-wave-y
 * detail for a single-user dev session: `me` (and any future user-scoped
 * endpoint) isn't keyed by user/token in its cache key, so without
 * resetting, a second user logging in on the same tab after a logout would
 * briefly render the previous user's cached `me` response before RTK Query
 * revalidates it. Also used to unwind an expired/invalid stored token.
 */
export const logout = () => (dispatch: AppDispatch) => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  dispatch(clearToken());
  dispatch(baseApi.util.resetApiState());
};
