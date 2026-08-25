import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { FittingValuesPage } from "./FittingValuesPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `ProductsPage.live.test.tsx`'s pattern. Covers PHASE_8_TASKS.md
 * Group 6.3's fit x measurement matrix editor: rows are the product's real
 * linked measurements in their configured order, and setting per-measurement
 * adjustment values for the fitting currently being edited round-trips
 * through the real `PUT /fittings/:id/values` endpoint.
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

const seededToken = await fetchSeedToken();

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

function renderPage(productId: string, fittingId: string, token: string | null) {
  return render(
    <Provider store={buildTestStore(token)}>
      <MemoryRouter initialEntries={[`/catalog/products/${productId}/fittings/${fittingId}`]}>
        <Routes>
          <Route path="/catalog/products/:productId/fittings/:fittingId" element={<FittingValuesPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

const createdProductIds: string[] = [];
const createdMeasurementDefinitionIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdProductIds.length > 0) {
    const id = createdProductIds.pop();
    if (!id) continue;
    await apiRequest(`/products/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
  while (createdMeasurementDefinitionIds.length > 0) {
    const id = createdMeasurementDefinitionIds.pop();
    if (!id) continue;
    await apiRequest(`/measurement-definitions/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("FittingValuesPage (live siam/server integration)", () => {
  it(
    "shows the product's real measurements in configured order and round-trips saved adjustment values",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();

      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Fit Values Product ${suffix}` }),
      });
      createdProductIds.push(product.data.id);

      const chest = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: `Chest ${suffix}`, slug: `chest-${suffix}` }),
      });
      createdMeasurementDefinitionIds.push(chest.data.id);
      const waist = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: `Waist ${suffix}`, slug: `waist-${suffix}` }),
      });
      createdMeasurementDefinitionIds.push(waist.data.id);

      // Link in a deliberate, checkable order: Waist first, then Chest.
      await apiRequest(`/products/${product.data.id}/measurements`, token, {
        method: "PUT",
        body: JSON.stringify({ measurementDefinitionIds: [waist.data.id, chest.data.id] }),
      });

      const fitting = await apiRequest<{ data: { id: string } }>(`/products/${product.data.id}/fittings`, token, {
        method: "POST",
        body: JSON.stringify({ name: `Regular ${suffix}` }),
      });

      const user = userEvent.setup();
      renderPage(product.data.id, fitting.data.id, token);

      await screen.findByText(`Regular ${suffix} — Fitting Values`);

      const rows = await screen.findAllByRole("row");
      // rows[0] is the header row; data rows should be Waist then Chest, matching link order.
      expect(rows[1]).toHaveTextContent(`Waist ${suffix}`);
      expect(rows[2]).toHaveTextContent(`Chest ${suffix}`);

      const waistInput = screen.getByLabelText(`Waist ${suffix} adjustment value`);
      const chestInput = screen.getByLabelText(`Chest ${suffix} adjustment value`);
      await user.type(waistInput, "1.5");
      await user.type(chestInput, "-2");

      await user.click(screen.getByRole("button", { name: /^save$/i }));
      await screen.findByText(/fitting values saved/i);

      const persisted = await apiRequest<{
        data: { values: Array<{ measurementDefinitionId: string; value: string }> };
      }>(`/fittings/${fitting.data.id}`, token);
      const byId = new Map(persisted.data.values.map((v) => [v.measurementDefinitionId, v.value]));
      expect(byId.get(waist.data.id)).toBe("1.50");
      expect(byId.get(chest.data.id)).toBe("-2.00");
    },
    30000
  );
});
