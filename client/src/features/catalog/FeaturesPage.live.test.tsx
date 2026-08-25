import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { FeaturesPage } from "./FeaturesPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `SuperProductsPage.live.test.tsx`'s pattern. These exercise
 * PHASE_5_TASKS.md Group 3's actual acceptance criterion: create a `choice`
 * feature linked to exactly 2 of the real migrated catalog's 6 products
 * (not all 6), give it 2 styles, entirely through the UI — the literal proof
 * that a feature like Piping/Lining/Monogram can apply to a genuine subset
 * of products, matching what the Phase 2 ETL already proved at the data
 * level (see the pre-existing "Piping" feature these tests deliberately
 * never touch).
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
      <FeaturesPage />
    </Provider>
  );
}

/**
 * Extended `waitFor`/`findBy*` timeout for assertions that follow a real
 * mutation round trip (create/update/delete + RTK Query cache invalidation
 * and refetch) — this suite's edit flow chains a `PATCH` and a `PUT` (see
 * `FeaturesPage.tsx`'s `handleSubmit`), which can occasionally exceed the
 * testing-library default 1000ms `waitFor` timeout when this file runs
 * concurrently with the rest of the live-test suite against the same
 * single dev-server process and Postgres pool.
 */
const NETWORK_WAIT = { timeout: 10000 };

/**
 * PHASE_10_TASKS.md Workstream C Group 4 added real pagination to the "All
 * Products" (unfiltered) branch of this page (default page size 25) — the
 * real seeded catalog's features alone can span multiple pages, so a
 * freshly-created fixture (sorted alphabetically with everything else) isn't
 * guaranteed to land on page 1. Bumping to the largest "Rows per page"
 * option keeps every test's own created-then-immediately-check-visibility
 * flow working without needing to hunt across pages.
 */
async function showMaxRowsPerPage(user: ReturnType<typeof userEvent.setup>) {
  const rowsPerPageSelect = await screen.findByRole("combobox", { name: /rows per page/i });
  await user.click(rowsPerPageSelect);
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: "100" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

async function toggleProductCheckbox(dialog: HTMLElement, productName: string) {
  const combobox = within(dialog).getByLabelText("Products");
  await userEvent.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: productName }));
  await userEvent.keyboard("{Escape}");
  await waitForNoOpenListbox();
}

const createdFeatureIds: string[] = [];

/**
 * Soft-deletes a feature's styles/style-options before the feature itself —
 * `softDeleteFeature` in `features.service.ts` doesn't cascade, so without
 * this a failed/partial test run would leave non-deleted style rows parented
 * to an already-soft-deleted feature.
 */
async function cleanupFeature(token: string, featureId: string) {
  const detail = await apiRequest<{
    data: { styles?: { id: string; options: { id: string }[] }[] };
  }>(`/features/${featureId}`, token).catch(() => null);
  for (const style of detail?.data.styles ?? []) {
    for (const option of style.options) {
      await apiRequest(`/style-options/${option.id}`, token, { method: "DELETE" }).catch(() => {});
    }
    await apiRequest(`/styles/${style.id}`, token, { method: "DELETE" }).catch(() => {});
  }
  await apiRequest(`/features/${featureId}`, token, { method: "DELETE" }).catch(() => {});
}

afterEach(async () => {
  if (!seededToken) return;
  while (createdFeatureIds.length > 0) {
    const id = createdFeatureIds.pop();
    if (!id) continue;
    await cleanupFeature(seededToken, id);
  }
});

describe.skipIf(!seededToken)("FeaturesPage (live siam/server integration)", () => {
  it(
    "creates a choice feature linked to a genuine subset of real products with two styles entirely through the UI, and displays it correctly",
    async () => {
      const user = userEvent.setup();
      renderPage();
      await showMaxRowsPerPage(user);

      const createdName = `Live Feature Subset ${Date.now()}`;
      await screen.findByRole("heading", { name: "Features & Styles" });

      await user.click(screen.getByRole("button", { name: "Add Feature" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);

      // Type defaults to "Choice" already — this is exactly the acceptance
      // criterion's type. Link to 2 of the 6 real products, not all 6.
      await toggleProductCheckbox(dialog, "jacket");
      await toggleProductCheckbox(dialog, "vest");

      await user.click(within(dialog).getByRole("button", { name: "Add Feature" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      await screen.findByText(createdName, {}, NETWORK_WAIT);
      const row = screen.getByText(createdName).closest("tr");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText(/^2 \(/)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText(/jacket/)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText(/vest/)).toBeInTheDocument();
      // The subset proof: exactly 2, not all 6 — overcoat/tuxedojacket/shirt/pant absent.
      expect(within(row as HTMLElement).queryByText(/overcoat/)).not.toBeInTheDocument();
      expect(within(row as HTMLElement).queryByText(/pant/)).not.toBeInTheDocument();

      const list = await apiRequest<{ data: { id: string; name: string; products: { id: string; name: string }[] }[] }>(
        "/features",
        seededToken as string
      );
      const created = list.data.find((f) => f.name === createdName);
      expect(created).toBeDefined();
      if (!created) return;
      createdFeatureIds.push(created.id);
      expect(created.products.map((p) => p.id).sort()).toEqual([realProducts.jacket, realProducts.vest].sort());

      // Reopen for editing to add the 2 styles — there's no bulk "create with
      // styles" endpoint, styles are always managed on an already-persisted feature.
      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      const editDialog = await screen.findByRole("dialog");

      await user.click(within(editDialog).getByRole("button", { name: "Add style" }));
      await user.type(within(editDialog).getByLabelText("Style name"), "Piped edge");
      await user.type(within(editDialog).getByLabelText("Style thai name"), "ขอบเชือก");
      await user.click(within(editDialog).getByRole("button", { name: "Save new style" }));
      await within(editDialog).findByText(/Piped edge/, {}, NETWORK_WAIT);

      await user.click(within(editDialog).getByRole("button", { name: "Add style" }));
      await user.type(within(editDialog).getByLabelText("Style name"), "Plain edge");
      await user.click(within(editDialog).getByRole("button", { name: "Save new style" }));
      await within(editDialog).findByText(/Plain edge/, {}, NETWORK_WAIT);

      expect(within(editDialog).getByText("Styles (2)")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      // Re-open and confirm both styles persisted server-side and display on reload.
      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      const reopenedDialog = await screen.findByRole("dialog");
      await within(reopenedDialog).findByText(/Piped edge/, {}, NETWORK_WAIT);
      await within(reopenedDialog).findByText(/Plain edge/, {}, NETWORK_WAIT);
      expect(within(reopenedDialog).getByText("Styles (2)")).toBeInTheDocument();

      const serverDetail = await apiRequest<{ data: { styles: { name: string }[] } }>(
        `/features/${created.id}`,
        seededToken as string
      );
      expect(serverDetail.data.styles.map((s) => s.name).sort()).toEqual(["Piped edge", "Plain edge"]);

      await user.click(screen.getByRole("button", { name: "Cancel" }));
    },
    45000
  );

  it(
    "edits an existing feature's linked products and type-independent fields, deletes one of its styles, then deletes the whole feature",
    async () => {
      const token = seededToken as string;
      const fixtureName = `Live Feature Edit Fixture ${Date.now()}`;
      const created = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName, type: "choice", productIds: [realProducts.jacket] }),
      });
      createdFeatureIds.push(created.data.id);
      const styleA = await apiRequest<{ data: { id: string } }>(`/features/${created.data.id}/styles`, token, {
        method: "POST",
        body: JSON.stringify({ name: "Style A" }),
      });
      await apiRequest(`/features/${created.data.id}/styles`, token, {
        method: "POST",
        body: JSON.stringify({ name: "Style B" }),
      });

      const user = userEvent.setup();
      renderPage();
      await showMaxRowsPerPage(user);

      await screen.findByText(fixtureName, {}, NETWORK_WAIT);
      await user.click(screen.getByRole("button", { name: `Edit ${fixtureName}` }));
      const dialog = await screen.findByRole("dialog");

      // Add a second linked product — the same subset proof, now shown via
      // an edit rather than only at creation time.
      await toggleProductCheckbox(dialog, "vest");

      // Style rows render name/price/worker-price as one Typography (multiple
      // interpolations in one text node), so exact-string `getByText` won't
      // match — use a substring regex, same as the "Piped edge"/"Plain edge"
      // assertions in the previous test.
      await within(dialog).findByText(/Style A/, {}, NETWORK_WAIT);
      await within(dialog).findByText(/Style B/, {}, NETWORK_WAIT);
      await user.click(within(dialog).getByRole("button", { name: "Delete style Style A" }));
      await waitFor(() => expect(within(dialog).queryByText(/Style A/)).not.toBeInTheDocument(), NETWORK_WAIT);
      expect(within(dialog).getByText(/Style B/)).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const row = screen.getByText(fixtureName).closest("tr");
      expect(within(row as HTMLElement).getByText(/jacket/)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText(/vest/)).toBeInTheDocument();

      const afterEdit = await apiRequest<{ data: { products: { id: string }[]; styles: { id: string; name: string }[] } }>(
        `/features/${created.data.id}`,
        token
      );
      expect(afterEdit.data.products.map((p) => p.id).sort()).toEqual([realProducts.jacket, realProducts.vest].sort());
      expect(afterEdit.data.styles.map((s) => s.name)).toEqual(["Style B"]);
      expect(afterEdit.data.styles.find((s) => s.id === styleA.data.id)).toBeUndefined();

      // `softDeleteFeature` doesn't cascade to its styles (see
      // `features.service.ts`), and `requireStyle` 404s once the parent
      // feature is itself soft-deleted — so any style left active at
      // feature-delete time becomes permanently unreachable via the API.
      // Delete the remaining "Style B" explicitly first so this test doesn't
      // orphan a row on every run (this was a real leak this suite was
      // causing, not just live-server flakiness — confirmed by direct DB
      // inspection during verification).
      for (const style of afterEdit.data.styles) {
        await apiRequest(`/styles/${style.id}`, token, { method: "DELETE" });
      }

      await user.click(screen.getByRole("button", { name: `Delete ${fixtureName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      expect(within(confirmDialog).getByText("Confirmation?")).toBeInTheDocument();
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));

      await waitFor(() => expect(screen.queryByText(fixtureName)).not.toBeInTheDocument(), NETWORK_WAIT);
      createdFeatureIds.splice(createdFeatureIds.indexOf(created.data.id), 1);
    },
    60000
  );

  it(
    "filters the table to a real product's linked features, in configured order, and clearing the filter restores the full unfiltered list",
    async () => {
      const token = seededToken as string;
      const jacketOnlyName = `Live Filter Jacket Only ${Date.now()}`;
      const vestOnlyName = `Live Filter Vest Only ${Date.now()}`;
      const jacketOnly = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: jacketOnlyName, type: "text", productIds: [realProducts.jacket] }),
      });
      createdFeatureIds.push(jacketOnly.data.id);
      const vestOnly = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: vestOnlyName, type: "text", productIds: [realProducts.vest] }),
      });
      createdFeatureIds.push(vestOnly.data.id);

      const user = userEvent.setup();
      renderPage();
      await showMaxRowsPerPage(user);

      await screen.findByText(jacketOnlyName, {}, NETWORK_WAIT);
      await screen.findByText(vestOnlyName, {}, NETWORK_WAIT);

      await user.click(screen.getByLabelText("Filter by product"));
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: "jacket" }));
      await waitForNoOpenListbox();

      await waitFor(() => expect(screen.getByText(jacketOnlyName)).toBeInTheDocument(), NETWORK_WAIT);
      expect(screen.queryByText(vestOnlyName)).not.toBeInTheDocument();

      await user.click(screen.getByLabelText("Filter by product"));
      const listbox2 = await screen.findByRole("listbox");
      await user.click(within(listbox2).getByRole("option", { name: "All Products" }));
      await waitForNoOpenListbox();

      await waitFor(() => expect(screen.getByText(jacketOnlyName)).toBeInTheDocument(), NETWORK_WAIT);
      await waitFor(() => expect(screen.getByText(vestOnlyName)).toBeInTheDocument(), NETWORK_WAIT);
    },
    45000
  );

  // No "duplicate feature name surfaces a real validation error" test here
  // (unlike ProcessesPage's/SuperProductsPage's equivalent): unlike
  // `products`/`processes`/`super_products`, `server/src/db/schema/catalog.ts`'s
  // `features` table has no `uniqueIndex` on `(tenantId, name)`, so
  // `createFeature`'s `catchUniqueViolation(..., "FEATURE_NAME_TAKEN", ...)`
  // wrapper can never actually fire for a name collision — confirmed by
  // creating two features with the same name directly against the real
  // server, which succeeds both times. This looks like a genuine backend gap
  // (dead error-handling code) rather than a UI concern; flagging for
  // backend-developer/software-architect rather than asserting behavior the
  // API doesn't have.
});
