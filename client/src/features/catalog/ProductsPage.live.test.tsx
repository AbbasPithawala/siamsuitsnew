import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { ProductsPage } from "./ProductsPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked), mirroring
 * `SuperProductsPage.live.test.tsx`'s pattern. Covers PHASE_8_TASKS.md Group 1's actual
 * acceptance criterion: a product's linked measurements/features can be added, removed,
 * and reordered entirely through the UI — the capability this page previously had no way
 * to expose at all.
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

// `ProductsPage` links to `/catalog/processes` via `react-router-dom`'s `Link` (matching
// legacy `ManageProduct.jsx`'s "Manage Processes" button) — needs a Router in scope, same
// gotcha `OrderBuilderPage.live.test.tsx` already hit.
function renderPage() {
  return render(
    <Provider store={buildTestStore(seededToken)}>
      <MemoryRouter initialEntries={["/catalog/products"]}>
        <ProductsPage />
      </MemoryRouter>
    </Provider>
  );
}

/**
 * `ManageLinkedItemsDialog` renders behind a brief loading placeholder (also a real
 * `role="dialog"`) until its two queries resolve — `screen.findByRole("dialog")` alone can
 * grab that transient one instead of the real content. Wait for the title text first,
 * which only exists once the real dialog has mounted, then derive the dialog element from it.
 */
async function findLoadedDialog(titleText: string): Promise<HTMLElement> {
  const title = await screen.findByText(titleText);
  return title.closest('[role="dialog"]') as HTMLElement;
}

const createdProductIds: string[] = [];
const createdMeasurementDefinitionIds: string[] = [];
const createdFeatureIds: string[] = [];

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
  while (createdFeatureIds.length > 0) {
    const id = createdFeatureIds.pop();
    if (!id) continue;
    await apiRequest(`/features/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("ProductsPage (live siam/server integration)", () => {
  it(
    "adds, reorders, and removes a product's linked measurements entirely through the Manage Measurements dialog",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const productName = `Live Test Product ${suffix}`;

      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);

      const defA = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: `Chest ${suffix}`, slug: `chest-${suffix}` }),
      });
      createdMeasurementDefinitionIds.push(defA.data.id);
      const defB = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: `Waist ${suffix}`, slug: `waist-${suffix}` }),
      });
      createdMeasurementDefinitionIds.push(defB.data.id);

      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("button", { name: `Edit ${productName}` });
      const row = screen.getByRole("button", { name: `Edit ${productName}` }).closest("tr")!;
      const manageButtons = within(row).getAllByText("Manage");
      await user.click(manageButtons[0]!); // Measurements column comes first

      const dialog = await findLoadedDialog(productName.toUpperCase());

      // Add both, in B-then-A order.
      async function addByLabel(label: RegExp, optionText: string) {
        const input = within(dialog).getByLabelText(label);
        await user.click(input);
        await user.clear(input);
        await user.type(input, optionText);
        await user.click(await screen.findByRole("option", { name: new RegExp(optionText) }));
      }

      await addByLabel(/Add measurement name/i, `Waist ${suffix}`);
      await addByLabel(/Add measurement name/i, `Chest ${suffix}`);

      await user.click(within(dialog).getByRole("button", { name: /save/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      // Reopen and confirm both persisted, in the order added (B, A).
      await user.click(within(row).getAllByText("Manage")[0]!);
      let reopened = await findLoadedDialog(productName.toUpperCase());
      let chips = within(reopened).getAllByRole("button", { name: new RegExp(`(Chest|Waist) ${suffix}`) });
      expect(chips.map((chip) => chip.textContent)).toEqual([
        expect.stringContaining(`Waist ${suffix}`),
        expect.stringContaining(`Chest ${suffix}`),
      ]);

      // Reorder via drag: drag the second chip's handle onto the first.
      const dragHandles = within(reopened).getAllByTestId("linked-item-drag-handle");
      fireEvent.dragStart(dragHandles[1]!);
      fireEvent.dragEnter(dragHandles[0]!);
      await user.click(within(reopened).getByRole("button", { name: /save/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(within(row).getAllByText("Manage")[0]!);
      reopened = await findLoadedDialog(productName.toUpperCase());
      chips = within(reopened).getAllByRole("button", { name: new RegExp(`(Chest|Waist) ${suffix}`) });
      expect(chips.map((chip) => chip.textContent)).toEqual([
        expect.stringContaining(`Chest ${suffix}`),
        expect.stringContaining(`Waist ${suffix}`),
      ]);

      // Remove one via the chip's delete affordance.
      const chestChip = within(reopened)
        .getAllByRole("button", { name: new RegExp(`Chest ${suffix}`) })
        .find((el) => el.closest(".MuiChip-root"))!;
      const deleteIcon = within(chestChip.closest(".MuiChip-root") as HTMLElement).getByTestId("CancelIcon");
      await user.click(deleteIcon);
      await user.click(within(reopened).getByRole("button", { name: /save/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const finalLinks = await apiRequest<{ data: Array<{ measurementDefinitionId: string }> }>(
        `/products/${product.data.id}/measurements`,
        token
      );
      expect(finalLinks.data.map((l) => l.measurementDefinitionId)).toEqual([defB.data.id]);
    },
    30000
  );

  it(
    "adds a feature to a product's Manage Styling list",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const productName = `Live Test Styling Product ${suffix}`;

      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);

      const feature = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Styling Feature ${suffix}`, type: "text" }),
      });
      createdFeatureIds.push(feature.data.id);

      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("button", { name: `Edit ${productName}` });
      const row = screen.getByRole("button", { name: `Edit ${productName}` }).closest("tr")!;
      const manageButtons = within(row).getAllByText("Manage");
      await user.click(manageButtons[1]!); // Styling column comes second

      const dialog = await findLoadedDialog(productName.toUpperCase());
      const addInput = within(dialog).getByLabelText(/Add style option/i);
      await user.click(addInput);
      await user.type(addInput, `Live Styling Feature ${suffix}`);
      await user.click(await screen.findByRole("option", { name: new RegExp(`Live Styling Feature ${suffix}`) }));
      await user.click(within(dialog).getByRole("button", { name: /save/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const finalLinks = await apiRequest<{ data: Array<{ id: string }> }>(`/features?productId=${product.data.id}`, token);
      expect(finalLinks.data.map((f) => f.id)).toEqual([feature.data.id]);
    },
    30000
  );
});
