import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { ProcessesPage } from "./ProcessesPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring the pattern established by `src/features/measurements/MeasurementForm.live.test.tsx`:
 * log in with the seeded dev admin (all 28 permissions, including
 * `catalog.processes.manage`), then drive the real page end to end through
 * the UI. Skips itself if the server isn't reachable.
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
      <ProcessesPage />
    </Provider>
  );
}

const createdProcessIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdProcessIds.length > 0) {
    const id = createdProcessIds.pop();
    if (!id) continue;
    await apiRequest(`/processes/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("ProcessesPage (live siam/server integration)", () => {
  it(
    "creates, edits, and deletes a real process entirely through the UI, with the list reflecting each change without a manual refresh",
    async () => {
      const user = userEvent.setup();
      renderPage();

      const createdName = `Live Test Process ${Date.now()}`;
      await screen.findByRole("heading", { name: "Processes" });

      await user.click(screen.getByRole("button", { name: "Add Process" }));
      let dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await user.click(within(dialog).getByRole("button", { name: "Add Process" }));

      const row = await screen.findByText(createdName);
      expect(row).toBeInTheDocument();

      // Track the real ID via a fresh list fetch in case the edit/delete
      // steps below fail partway through, so afterEach can still clean up.
      const list = await apiRequest<{ data: { id: string; name: string }[] }>("/processes", seededToken as string);
      const created = list.data.find((process) => process.name === createdName);
      if (created) createdProcessIds.push(created.id);

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
      createdProcessIds.length = 0;
    },
    45000
  );

  it(
    "surfaces a real backend validation error in the create dialog for a duplicate process name",
    async () => {
      const token = seededToken as string;
      const fixtureName = `Live Test Duplicate Process ${Date.now()}`;
      const created = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName }),
      });
      createdProcessIds.push(created.data.id);

      const user = userEvent.setup();
      renderPage();

      await screen.findByText(fixtureName);
      await user.click(screen.getByRole("button", { name: "Add Process" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), fixtureName);
      await user.click(within(dialog).getByRole("button", { name: "Add Process" }));

      await within(dialog).findByText(/already exists/i);
      expect(screen.getAllByText(fixtureName)).toHaveLength(1);
    },
    25000
  );
});
