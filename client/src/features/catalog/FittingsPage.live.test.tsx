import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { FittingsPage } from "./FittingsPage";
import { ProductsPage } from "./ProductsPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `ProductsPage.live.test.tsx`'s pattern. Covers PHASE_8_TASKS.md
 * Group 6.3's admin CRUD acceptance: an admin can add, rename, and delete a
 * product's named fittings entirely through the UI.
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

function renderFittingsPage(productId: string, token: string | null) {
  return render(
    <Provider store={buildTestStore(token)}>
      <MemoryRouter initialEntries={[`/catalog/products/${productId}/fittings`]}>
        <Routes>
          <Route path="/catalog/products/:productId/fittings" element={<FittingsPage />} />
          <Route path="/catalog/products" element={<ProductsPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

const createdProductIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdProductIds.length > 0) {
    const id = createdProductIds.pop();
    if (!id) continue;
    await apiRequest(`/products/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("FittingsPage (live siam/server integration)", () => {
  it(
    "adds, renames, and deletes a product's fittings entirely through the UI",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const productName = `Live Fittings Product ${suffix}`;

      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);

      const user = userEvent.setup();
      renderFittingsPage(product.data.id, token);

      await screen.findByText(`${productName} — Fittings`);
      expect(screen.getByText(/no fittings defined/i)).toBeInTheDocument();

      // Add.
      await user.click(screen.getByRole("button", { name: /add new fitting/i }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^name/i), "Slim");
      await user.type(within(dialog).getByLabelText(/thai name/i), "สลิม");
      await user.click(within(dialog).getByRole("button", { name: /add fitting/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await screen.findByText("Slim");
      expect(screen.getByText("สลิม")).toBeInTheDocument();

      const listAfterCreate = await apiRequest<{ data: Array<{ id: string; name: string }> }>(
        `/products/${product.data.id}/fittings`,
        token
      );
      expect(listAfterCreate.data).toHaveLength(1);
      const fittingId = listAfterCreate.data[0]!.id;

      // Rename.
      await user.click(screen.getByRole("button", { name: "Edit Slim" }));
      const editDialog = await screen.findByRole("dialog");
      const nameInput = within(editDialog).getByLabelText(/^name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Regular");
      await user.click(within(editDialog).getByRole("button", { name: /^save$/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await screen.findByText("Regular");
      const afterRename = await apiRequest<{ data: { name: string } }>(`/fittings/${fittingId}`, token);
      expect(afterRename.data.name).toBe("Regular");

      // Delete.
      await user.click(screen.getByRole("button", { name: "Delete Regular" }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: /yes/i }));
      await waitFor(() => expect(screen.queryByText("Regular")).not.toBeInTheDocument());

      const finalList = await apiRequest<{ data: unknown[] }>(`/products/${product.data.id}/fittings`, token);
      expect(finalList.data).toHaveLength(0);
    },
    30000
  );
});
