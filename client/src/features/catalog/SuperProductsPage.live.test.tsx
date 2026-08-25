import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { SuperProductsPage } from "./SuperProductsPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `ProcessesPage.live.test.tsx`'s pattern. These exercise
 * PHASE_5_TASKS.md Group 2's actual acceptance criterion: combining 3 of
 * the real migrated catalog's 6 products into a brand-new super product
 * entirely through the UI (not just the API).
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

/** The real migrated catalog's 6 products (PHASE_5_TASKS.md), fetched once by name. */
async function fetchRealProductIds(token: string): Promise<Record<string, string>> {
  const list = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
  const byName: Record<string, string> = {};
  for (const product of list.data) byName[product.name] = product.id;
  return byName;
}

const realProducts = seededToken ? await fetchRealProductIds(seededToken) : {};

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

function renderPage() {
  return render(
    <Provider store={buildTestStore(seededToken)}>
      <SuperProductsPage />
    </Provider>
  );
}

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

async function selectProductInRow(dialog: HTMLElement, comboboxIndex: number, productName: string) {
  const combobox = within(dialog).getAllByRole("combobox")[comboboxIndex]!;
  await userEvent.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: productName }));
  await waitForNoOpenListbox();
}

const createdSuperProductIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdSuperProductIds.length > 0) {
    const id = createdSuperProductIds.pop();
    if (!id) continue;
    await apiRequest(`/super-products/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("SuperProductsPage (live siam/server integration)", () => {
  it(
    "combines 3 distinct real products into a brand-new super product entirely through the UI and displays it correctly",
    async () => {
      const user = userEvent.setup();
      renderPage();

      const createdName = `Live Three-Piece ${Date.now()}`;
      await screen.findByRole("heading", { name: "Super Products" });

      await user.click(screen.getByRole("button", { name: "Add Super Product" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);

      const addComponentButton = () => within(dialog).getByRole("button", { name: "Add component" });
      await user.click(addComponentButton());
      await user.click(addComponentButton());
      await user.click(addComponentButton());
      expect(addComponentButton()).toBeDisabled();

      const plan = [
        { productName: "jacket", slotLabel: "Jacket" },
        { productName: "pant", slotLabel: "Pant" },
        { productName: "vest", slotLabel: "Vest" },
      ];
      const slotLabelInputs = within(dialog).getAllByLabelText("Slot label");
      expect(slotLabelInputs).toHaveLength(3);

      for (let i = 0; i < plan.length; i++) {
        await selectProductInRow(dialog, i, plan[i]!.productName);
        await user.type(slotLabelInputs[i]!, plan[i]!.slotLabel);
      }

      await user.click(within(dialog).getByRole("button", { name: "Add Super Product" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const createdRow = (await screen.findByText(createdName)).closest("tr")!;
      // Scoped to this fixture's own row, not the whole document — see the "edits an
      // existing super product" test's comment below for why "3 (Jacket, Pant, Vest)" is
      // not unique enough to search for globally.
      await within(createdRow).findByText("3 (Jacket, Pant, Vest)");

      const list = await apiRequest<{ data: { id: string; name: string; components: { slotLabel: string; productId: string }[] }[] }>(
        "/super-products",
        seededToken as string
      );
      const created = list.data.find((sp) => sp.name === createdName);
      expect(created).toBeDefined();
      if (created) {
        createdSuperProductIds.push(created.id);
        expect(created.components).toHaveLength(3);
        expect(created.components.map((c) => c.productId).sort()).toEqual(
          [realProducts.jacket, realProducts.pant, realProducts.vest].sort()
        );
      }
    },
    45000
  );

  it(
    "disables adding a 4th component client-side, and surfaces the real 422 TOO_MANY_COMPONENTS gracefully if the request slips through anyway",
    async () => {
      const token = seededToken as string;
      const fixtureName = `Live Race Fixture ${Date.now()}`;
      const created = await apiRequest<{ data: { id: string } }>("/super-products", token, {
        method: "POST",
        body: JSON.stringify({
          name: fixtureName,
          components: [
            { productId: realProducts.jacket, slotLabel: "Jacket", sequence: 1 },
            { productId: realProducts.pant, slotLabel: "Pant", sequence: 2 },
          ],
        }),
      });
      createdSuperProductIds.push(created.data.id);

      const user = userEvent.setup();
      renderPage();

      await screen.findByText(fixtureName);
      await user.click(screen.getByRole("button", { name: `Edit ${fixtureName}` }));
      const dialog = await screen.findByRole("dialog");

      const addComponentButton = () => within(dialog).getByRole("button", { name: "Add component" });
      expect(addComponentButton()).toBeEnabled();
      await user.click(addComponentButton());

      // Simulate the exact race the client-side disable can't catch: a 3rd
      // component lands on the server via a channel other than this UI
      // instance (another tab, another admin) between the dialog opening
      // and this "Add" being submitted, so the client's view is stale.
      await apiRequest(`/super-products/${created.data.id}/components`, token, {
        method: "POST",
        body: JSON.stringify({ productId: realProducts.vest, slotLabel: "Vest" }),
      });

      await selectProductInRow(dialog, 0, "shirt");
      await user.type(within(dialog).getByLabelText("Slot label"), "Shirt");
      await user.click(within(dialog).getByRole("button", { name: "Save new component" }));

      await within(dialog).findByText(/at most 3 components/i);
      expect(within(dialog).queryByText(/failed to fetch|typeerror|\[object/i)).not.toBeInTheDocument();

      const server = await apiRequest<{ data: { components: unknown[] } }>(`/super-products/${created.data.id}`, token);
      expect(server.data.components).toHaveLength(3);
    },
    30000
  );

  it(
    "edits an existing super product's components (add then remove) and deletes the whole super product",
    async () => {
      const token = seededToken as string;
      const fixtureName = `Live Edit Fixture ${Date.now()}`;
      const created = await apiRequest<{ data: { id: string } }>("/super-products", token, {
        method: "POST",
        body: JSON.stringify({
          name: fixtureName,
          components: [
            { productId: realProducts.jacket, slotLabel: "Jacket", sequence: 1 },
            { productId: realProducts.pant, slotLabel: "Pant", sequence: 2 },
          ],
        }),
      });
      createdSuperProductIds.push(created.data.id);

      const user = userEvent.setup();
      renderPage();

      // Scoped to this fixture's own row throughout, not `screen.findByText` against the
      // whole document: the component-count/name summary text (e.g. "3 (Jacket, Pant,
      // Vest)") is NOT unique to this fixture — any other active super product built from
      // the same 3 real products renders identically, and multiple live test files across
      // this project independently pick "jacket, pant, vest" as their example combination.
      // Concurrent file execution (or leftover fixtures from a prior interrupted run) can
      // and did produce a real "found multiple elements" failure here even though this
      // test's own fixture was rendering correctly.
      const rowFor = () => screen.getByRole("button", { name: `Edit ${fixtureName}` }).closest("tr")!;

      // `findByRole` (not `getByRole`) for the first wait, since the row needs time to
      // initially render after creation — `rowFor()` itself is synchronous and only safe
      // to call once the row is already known to exist.
      await screen.findByRole("button", { name: `Edit ${fixtureName}` });
      await within(rowFor()).findByText("2 (Jacket, Pant)");

      await user.click(within(rowFor()).getByRole("button", { name: `Edit ${fixtureName}` }));
      let dialog = await screen.findByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Add component" }));
      await selectProductInRow(dialog, 0, "vest");
      await user.type(within(dialog).getByLabelText("Slot label"), "Vest");
      await user.click(within(dialog).getByRole("button", { name: "Save new component" }));

      await within(dialog).findByText("Vest: vest");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await within(rowFor()).findByText("3 (Jacket, Pant, Vest)");

      await user.click(within(rowFor()).getByRole("button", { name: `Edit ${fixtureName}` }));
      dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Remove component Pant" }));
      await waitFor(() => expect(within(dialog).queryByText("Pant: pant")).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await within(rowFor()).findByText("2 (Jacket, Vest)");

      await user.click(screen.getByRole("button", { name: `Delete ${fixtureName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      expect(within(confirmDialog).getByText("Confirmation?")).toBeInTheDocument();
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));

      await waitFor(() => expect(screen.queryByText(fixtureName)).not.toBeInTheDocument());
      createdSuperProductIds.splice(createdSuperProductIds.indexOf(created.data.id), 1);
    },
    45000
  );
});
