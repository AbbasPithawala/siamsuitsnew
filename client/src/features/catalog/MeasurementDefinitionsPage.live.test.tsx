import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { MeasurementDefinitionsPage } from "./MeasurementDefinitionsPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked) —
 * see `ProcessesPage.live.test.tsx`'s doc comment for the shared pattern.
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
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}`);
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

function renderPage() {
  return render(
    <Provider store={buildTestStore(seededToken)}>
      <MeasurementDefinitionsPage />
    </Provider>
  );
}

/**
 * PHASE_10_TASKS.md Workstream C Group 4 added real pagination to this page
 * (default page size 25) — the real seeded catalog alone is already large
 * enough to span multiple pages, so a freshly-created fixture (sorted
 * alphabetically with everything else) isn't guaranteed to land on page 1.
 * Bumping to the largest "Rows per page" option keeps every test's own
 * created-then-immediately-interact-with-it flow working without needing to
 * hunt across pages.
 */
async function showMaxRowsPerPage(user: ReturnType<typeof userEvent.setup>) {
  const rowsPerPageSelect = await screen.findByRole("combobox", { name: /rows per page/i });
  await user.click(rowsPerPageSelect);
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: "100" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

const createdDefinitionIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdDefinitionIds.length > 0) {
    const id = createdDefinitionIds.pop();
    if (!id) continue;
    await apiRequest(`/measurement-definitions/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("MeasurementDefinitionsPage (live siam/server integration)", () => {
  it(
    "creates, edits, and deletes a real measurement definition entirely through the UI, with the list reflecting each change without a manual refresh",
    async () => {
      const user = userEvent.setup();
      renderPage();
      await showMaxRowsPerPage(user);

      const suffix = Date.now();
      const createdName = `Live Test Measurement ${suffix}`;
      const createdSlug = `live-test-measurement-${suffix}`;
      await screen.findByRole("heading", { name: "Measurement Definitions" });

      await user.click(screen.getByRole("button", { name: "Add Measurement Definition" }));
      let dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await user.type(within(dialog).getByLabelText(/^Slug/i), createdSlug);
      await user.click(within(dialog).getByRole("button", { name: "Add Measurement Definition" }));

      await screen.findByText(createdName);

      const list = await apiRequest<{ data: { id: string; name: string }[] }>(
        "/measurement-definitions",
        seededToken as string
      );
      const created = list.data.find((definition) => definition.name === createdName);
      if (created) createdDefinitionIds.push(created.id);

      const editedName = `${createdName} Edited`;
      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");
      const nameField = within(dialog).getByLabelText(/^Name/i);
      await user.clear(nameField);
      await user.type(nameField, editedName);
      await user.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await screen.findByText(editedName);
      await waitFor(() => expect(screen.queryByText(createdName)).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: `Delete ${editedName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      expect(within(confirmDialog).getByText("Confirmation?")).toBeInTheDocument();
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));

      await waitFor(() => expect(screen.queryByText(editedName)).not.toBeInTheDocument());
      createdDefinitionIds.length = 0;
    },
    45000
  );

  it(
    "surfaces a real backend validation error in the create dialog for a duplicate slug",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const fixtureName = `Live Test Duplicate Measurement ${suffix}`;
      const fixtureSlug = `live-test-duplicate-measurement-${suffix}`;
      const created = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName, slug: fixtureSlug }),
      });
      createdDefinitionIds.push(created.data.id);

      const user = userEvent.setup();
      renderPage();
      await showMaxRowsPerPage(user);

      await screen.findByText(fixtureName);
      await user.click(screen.getByRole("button", { name: "Add Measurement Definition" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), `Different Name ${suffix}`);
      await user.type(within(dialog).getByLabelText(/^Slug/i), fixtureSlug);
      await user.click(within(dialog).getByRole("button", { name: "Add Measurement Definition" }));

      await within(dialog).findByText(/already exists/i);
      expect(screen.queryByText(`Different Name ${suffix}`)).not.toBeInTheDocument();
    },
    25000
  );
});
