import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { ExtraPaymentCategoriesPage } from "./ExtraPaymentCategoriesPage";
import { switchRowsPerPage } from "../../testSupport/paginationTestHelpers";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `FeaturesPage.live.test.tsx`'s pattern. Covers PHASE_6_TASKS.md
 * Group 7's admin screen for Group 0's `extraPaymentCategories.routes.ts`
 * CRUD — a real blocking gap found while scoping Phase 6 (the extra-payments
 * feature had nothing to create the category templates it references).
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function buildTestStore() {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token: seededToken }) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function renderPage() {
  return render(
    <Provider store={buildTestStore()}>
      <ExtraPaymentCategoriesPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdCategoryIds: string[] = [];
const createdFeatureIds: string[] = [];
const createdStyleIds: string[] = [];
const createdProductIds: string[] = [];
const createdProcessIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  const token = seededToken;
  while (createdCategoryIds.length > 0) {
    const id = createdCategoryIds.pop();
    if (!id) continue;
    await apiRequest(`/extra-payment-categories/${id}`, token, { method: "DELETE" }).catch(() => {});
  }
  while (createdStyleIds.length > 0) {
    const id = createdStyleIds.pop();
    if (!id) continue;
    await apiRequest(`/styles/${id}`, token, { method: "DELETE" }).catch(() => {});
  }
  while (createdFeatureIds.length > 0) {
    const id = createdFeatureIds.pop();
    if (!id) continue;
    await apiRequest(`/features/${id}`, token, { method: "DELETE" }).catch(() => {});
  }
  while (createdProductIds.length > 0) {
    const id = createdProductIds.pop();
    if (!id) continue;
    await apiRequest(`/products/${id}`, token, { method: "DELETE" }).catch(() => {});
  }
  while (createdProcessIds.length > 0) {
    const id = createdProcessIds.pop();
    if (!id) continue;
    await apiRequest(`/processes/${id}`, token, { method: "DELETE" }).catch(() => {});
  }
});

/**
 * `labelText` is a regex, not an exact string, because MUI's `required`
 * `FormControl`s (Product/Process here) render their `InputLabel`'s
 * accessible text as e.g. "Product *" (an aria-hidden asterisk span still
 * included in the label's computed text content) — same reason
 * `ProductsPage.live.test.tsx`/`ProcessesPage.live.test.tsx` match their
 * required "Name" field with `/^Name/i` rather than the exact string.
 */
async function selectOption(labelText: RegExp, optionName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(labelText));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: optionName }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe.skipIf(!seededToken)("ExtraPaymentCategoriesPage (live siam/server integration)", () => {
  it(
    "creates a category tied to a real product/process/feature/style, edits its cost, then deletes it — entirely through the UI",
    async () => {
      const token = seededToken as string;
      const suffix = uniqueSuffix();
      const user = userEvent.setup();

      const processName = `Live EPC Process ${suffix}`;
      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processName }),
      });
      createdProcessIds.push(process.data.id);

      const productName = `Live EPC Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);

      const featureName = `Live EPC Feature ${suffix}`;
      const feature = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: featureName, type: "choice", productIds: [product.data.id] }),
      });
      createdFeatureIds.push(feature.data.id);

      const styleName = `Live EPC Style ${suffix}`;
      const style = await apiRequest<{ data: { id: string } }>(`/features/${feature.data.id}/styles`, token, {
        method: "POST",
        body: JSON.stringify({ name: styleName }),
      });
      createdStyleIds.push(style.data.id);

      renderPage();
      await screen.findByRole("heading", { name: "Extra Payment Categories" });

      const categoryName = `Live EPC Category ${suffix}`;
      await user.click(screen.getByRole("button", { name: "Add Category" }));
      const dialog = await screen.findByRole("dialog");

      await user.type(within(dialog).getByLabelText(/^Name/i), categoryName);
      await selectOption(/^Product/, productName);
      await selectOption(/^Process/, processName);
      await selectOption(/^Feature/, featureName);
      await selectOption(/^Style/, styleName);
      await user.type(within(dialog).getByLabelText("Cost"), "35.00");

      await user.click(within(dialog).getByRole("button", { name: "Add Category" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      // PHASE_10_TASKS.md Workstream C Group 4 added real pagination (default
      // page size 25) — the real seeded catalog alone spans multiple pages,
      // so the newly-created fixture isn't guaranteed to land on page 1.
      // Done here (after the dialog is fully closed), not before opening it,
      // to avoid any overlap between the page-size refetch and the dialog's
      // own open/close transition.
      await switchRowsPerPage(user, 100);

      await screen.findByText(new RegExp(`^${categoryName}`), {}, NETWORK_WAIT);
      const row = screen.getByText(new RegExp(`^${categoryName}`)).closest("tr") as HTMLElement;
      expect(within(row).getByText(productName)).toBeInTheDocument();
      expect(within(row).getByText(processName)).toBeInTheDocument();
      expect(within(row).getByText(`${featureName} / ${styleName}`)).toBeInTheDocument();
      expect(within(row).getByText("35.00")).toBeInTheDocument();

      // `pageSize=100` explicitly — this endpoint is mandatory-paginated
      // (PHASE_10_TASKS.md Workstream C Group 1), so an unparameterized
      // request only returns page 1 of the default 25, which the real
      // already-large seeded catalog can easily push this fixture past.
      const list = await apiRequest<{ data: { id: string; name: string; cost: string }[] }>(
        "/extra-payment-categories?pageSize=100",
        token
      );
      const created = list.data.find((c) => c.name === categoryName);
      expect(created).toBeDefined();
      if (!created) return;
      createdCategoryIds.push(created.id);
      expect(created.cost).toBe("35.00");

      // Edit: change the cost.
      await user.click(screen.getByRole("button", { name: `Edit ${categoryName}` }));
      const editDialog = await screen.findByRole("dialog");
      const costField = within(editDialog).getByLabelText("Cost") as HTMLInputElement;
      await user.clear(costField);
      await user.type(costField, "50.00");
      await user.click(within(editDialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const updatedRow = screen.getByText(new RegExp(`^${categoryName}`)).closest("tr") as HTMLElement;
      await within(updatedRow).findByText("50.00", {}, NETWORK_WAIT);

      const serverAfterEdit = await apiRequest<{ data: { cost: string } }>(`/extra-payment-categories/${created.id}`, token);
      expect(serverAfterEdit.data.cost).toBe("50.00");

      // Delete.
      await user.click(screen.getByRole("button", { name: `Delete ${categoryName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));
      await waitFor(() => expect(screen.queryByText(new RegExp(`^${categoryName}`))).not.toBeInTheDocument(), NETWORK_WAIT);

      createdCategoryIds.splice(createdCategoryIds.indexOf(created.id), 1);
      await expect(apiRequest(`/extra-payment-categories/${created.id}`, token)).rejects.toThrow();
    },
    45000
  );
});
