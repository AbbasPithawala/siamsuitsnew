import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import App from "../../App";
import authReducer, { AUTH_TOKEN_STORAGE_KEY, readStoredToken } from "./authSlice";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring the pattern established by `src/api/baseApi.live.test.ts`:
 * exercise the actual login form + session-restoration wiring end to end.
 * Skips itself (rather than failing `npm test`) if the server isn't up.
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function fetchSeedToken(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SEED_CREDENTIALS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { token: string } };
    return body.data.token;
  } catch {
    return null;
  }
}

const seededToken = await fetchSeedToken();

/**
 * Mirrors `src/app/store.ts`'s real `preloadedState` wiring: reads
 * `localStorage` synchronously at store-creation time (not in a mount
 * effect), so this test store's very first render already reflects
 * whatever token a test set up beforehand — see `authSlice.ts`'s
 * `readStoredToken` doc comment for why that matters for route guards.
 */
function buildTestStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState: {
      auth: { token: readStoredToken() },
    },
  });
}

afterEach(() => {
  window.localStorage.clear();
});

describe.skipIf(!seededToken)("Login flow (live siam/server integration)", () => {
  it("logs in with valid credentials, setting the token in the slice and localStorage", async () => {
    const store = buildTestStore();
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await user.type(screen.getByLabelText(/tenant/i), SEED_CREDENTIALS.tenant);
    await user.type(screen.getByLabelText(/username/i), SEED_CREDENTIALS.username);
    await user.type(screen.getByLabelText(/password/i), SEED_CREDENTIALS.password);
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(store.getState().auth.token).toBeTruthy();
    });
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(store.getState().auth.token);
  });

  it("shows an error message and does not set a token on invalid credentials", async () => {
    const store = buildTestStore();
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await user.type(screen.getByLabelText(/tenant/i), SEED_CREDENTIALS.tenant);
    await user.type(screen.getByLabelText(/username/i), SEED_CREDENTIALS.username);
    await user.type(screen.getByLabelText(/password/i), "definitely-wrong-password");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await screen.findByText(/invalid credentials/i);
    expect(store.getState().auth.token).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("restores a valid session from localStorage without requiring the user to log in again", async () => {
    const token = await fetchSeedToken();
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token as string);

    const store = buildTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      // Scoped to the header — PHASE_8_TASKS.md's sidebar regrouping introduced a real
      // "Admin" nav-group label, which now collides with an unscoped lookup for the
      // seeded admin user's own displayed name ("Admin (admin)").
      const header = screen.getByRole("banner");
      expect(within(header).getByText(new RegExp(SEED_CREDENTIALS.username, "i"))).toBeInTheDocument();
    });
    expect(store.getState().auth.token).toBe(token);
    expect(screen.queryByRole("heading", { name: /login/i })).not.toBeInTheDocument();
  });

  it("clears an expired/invalid stored token instead of getting stuck logged in", async () => {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "not-a-real-token");

    const store = buildTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      expect(store.getState().auth.token).toBeNull();
    });
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    await screen.findByRole("heading", { name: /login/i });
  });
});
