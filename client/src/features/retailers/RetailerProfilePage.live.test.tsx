import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { RetailerProfilePage } from "./RetailerProfilePage";
import { createRetailerLinkedUserInTenant, isDatabaseReachable } from "../../routes/testSupport/permissionFixtures";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `RetailersPage.live.test.tsx`'s pattern. Covers the new
 * retailer self-service "My Profile" page: a `retailer_users`-linked
 * session editing its OWN retailer via the pre-existing self-edit
 * allowance on `PATCH /retailers/:id` (Workstream E Group 2).
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function fetchToken(credentials: { tenant: string; username: string; password: string }): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { token: string } };
    return body.data.token;
  } catch {
    return null;
  }
}

const seededToken = await fetchToken(SEED_CREDENTIALS);
const dbUp = await isDatabaseReachable();

async function apiRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function buildTestStore(token: string | null) {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token }) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function renderPage(token: string | null) {
  return render(
    <Provider store={buildTestStore(token)}>
      <RetailerProfilePage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdRetailerIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  for (const id of createdRetailerIds) {
    await fetch(`${apiBaseUrl}/retailers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${seededToken}` } });
  }
});

describe.skipIf(!seededToken || !dbUp)("RetailerProfilePage (live siam/server integration)", () => {
  it("a retailer-linked session sees its own retailer's real data, edits it, and the change persists", async () => {
    const token = seededToken as string;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const created = await apiRequest<{ data: { id: string; name: string } }>("/retailers", token, {
      method: "POST",
      body: JSON.stringify({ name: `Profile Test Retailer ${suffix}`, code: `PTR-${suffix}`.toUpperCase() }),
    });
    createdRetailerIds.push(created.data.id);

    const fixture = await createRetailerLinkedUserInTenant("siam-suits", created.data.id, []);
    try {
      const fixtureToken = await fetchToken(fixture);
      if (!fixtureToken) throw new Error("Expected to log in as the retailer-linked fixture user");

      const user = userEvent.setup();
      renderPage(fixtureToken);

      const nameInput = await screen.findByLabelText(/^Retailer Name/i, {}, NETWORK_WAIT);
      await waitFor(() => expect(nameInput).toHaveValue(created.data.name));

      const addressInput = screen.getByLabelText("Address");
      await user.clear(addressInput);
      await user.type(addressInput, "42 Sukhumvit Road");
      const phoneInput = screen.getByLabelText("Cell Phone");
      await user.clear(phoneInput);
      await user.type(phoneInput, "+66-99-000-1111");

      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText("Profile updated.", {}, NETWORK_WAIT);

      const refetched = await apiRequest<{ data: { address: string; phone: string } }>(`/retailers/${created.data.id}`, token);
      expect(refetched.data.address).toBe("42 Sukhumvit Road");
      expect(refetched.data.phone).toBe("+66-99-000-1111");
    } finally {
      await fixture.cleanup();
    }
  }, 30000);

  it("a staff (non-retailer-linked) session sees the explanatory message instead of the form", async () => {
    renderPage(seededToken);
    await screen.findByText(/isn.t linked to a retailer/i, {}, NETWORK_WAIT);
    expect(screen.queryByLabelText("Retailer Name")).not.toBeInTheDocument();
  });
});
