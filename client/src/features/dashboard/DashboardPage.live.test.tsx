import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createRetailerLinkedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { DashboardPage } from "./DashboardPage";

/**
 * Integration test against a real, running `siam/server` (not mocked),
 * mirroring `OrderEditWizard.live.test.tsx`'s pattern: real fixture data
 * created via raw `fetch`, real tokens minted via `POST /auth/login`, and
 * the real `GET /dashboard/summary` response driving rendering — not a
 * mocked API layer. Covers the one branch `DashboardPage.tsx` actually has:
 * admin-only tiles/charts shown for a staff session, hidden for a
 * retailer-linked one, keyed off `me.retailerId` (same convention
 * `RetailerProfilePage.tsx` already uses), not off a permission key.
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
  return (await res.json()) as T;
}

const seededToken = await fetchToken(SEED_CREDENTIALS);

const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const retailerFixture = seededToken
  ? await apiRequest<{ data: { id: string } }>("/retailers", seededToken, {
      method: "POST",
      body: JSON.stringify({ name: `Live Dashboard Retailer ${suffix}`, code: `LDB-${suffix}`.toUpperCase() }),
    })
  : null;
const retailerUserFixture =
  seededToken && retailerFixture ? await createRetailerLinkedUserInTenant("siam-suits", retailerFixture.data.id, []) : null;
const retailerToken = retailerUserFixture ? await fetchToken(retailerUserFixture) : null;

afterAll(async () => {
  if (!seededToken) return;
  if (retailerUserFixture) {
    await retailerUserFixture.cleanup().catch((err: unknown) => console.error("Failed to clean up the retailer-linked fixture user:", err));
  }
  if (retailerFixture) {
    await apiRequest(`/retailers/${retailerFixture.data.id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error("Failed to soft-delete the dashboard retailer fixture:", err)
    );
  }
});

function buildTestStore(token: string | null): EnhancedStore {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token }) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function renderDashboard(token: string | null) {
  return render(
    <Provider store={buildTestStore(token)}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardPage />
      </MemoryRouter>
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const ADMIN_ONLY_LABELS = ["Total Retailers", "Active Tailor Jobs", "Revenue vs Tailor Cost", "Top Retailers", "Active Tailor Jobs by Status"];

describe.skipIf(!seededToken)("DashboardPage (live siam/server integration)", () => {
  it("hides the admin-only tiles/charts for a retailer-linked session", async () => {
    if (!retailerToken) throw new Error("Expected a retailer-linked fixture token to have been minted for this file");

    renderDashboard(retailerToken);

    await screen.findByRole("heading", { name: "Dashboard" }, NETWORK_WAIT);
    await screen.findByText("Total Orders", {}, NETWORK_WAIT);
    expect(screen.getByText("Active Orders")).toBeInTheDocument();
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();

    for (const label of ADMIN_ONLY_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("shows the admin-only tiles/charts for a staff/admin session", async () => {
    const token = seededToken as string;

    renderDashboard(token);

    await screen.findByRole("heading", { name: "Dashboard" }, NETWORK_WAIT);
    await screen.findByText("Total Orders", {}, NETWORK_WAIT);

    for (const label of ADMIN_ONLY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
