import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { TailorsPage } from "./TailorsPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `UsersPage.live.test.tsx`'s pattern. Covers PHASE_6_TASKS.md
 * Group 4's Tailors screen: create/edit/deactivate through the UI, plus the
 * acceptance test that matters most for this group — certifying a real
 * tailor for a real process entirely through the UI, then confirming via a
 * real fetch of `GET /tailors/:id` that the certification actually landed.
 * This is the test that finally lets manufacturing-related work stop using
 * direct-DB-insert fixtures for tailor certifications (see
 * `PHASE_6_TASKS.md`'s Group 4 acceptance note).
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
      <TailorsPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdTailorIds: string[] = [];
const createdProcessIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdTailorIds.length > 0) {
    const id = createdTailorIds.pop();
    if (!id) continue;
    await apiRequest(`/tailors/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
  while (createdProcessIds.length > 0) {
    const id = createdProcessIds.pop();
    if (!id) continue;
    await apiRequest(`/processes/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("TailorsPage (live siam/server integration)", () => {
  it(
    "creates, edits, and deactivates a real tailor entirely through the UI",
    async () => {
      const user = userEvent.setup();
      renderPage();

      const createdName = `Live Test Tailor ${Date.now()}`;
      const username = `live-test-tailor-${Date.now()}`;
      await screen.findByRole("heading", { name: "Tailors" });

      await user.click(screen.getByRole("button", { name: "Add Tailor" }));
      let dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await user.type(within(dialog).getByLabelText(/^Username/i), username);
      await user.type(within(dialog).getByLabelText(/^Password/i), "TestPassword123!");
      await user.click(within(dialog).getByRole("button", { name: "Add Tailor" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      await screen.findByText(createdName, {}, NETWORK_WAIT);
      const list = await apiRequest<{ data: { id: string; username: string }[] }>("/tailors", seededToken as string);
      const created = list.data.find((t) => t.username === username);
      expect(created).toBeDefined();
      if (!created) return;
      createdTailorIds.push(created.id);

      let row = screen.getByText(createdName).closest("tr");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText("Active")).toBeInTheDocument();

      // Edit: flip Active off — no password field should be present on edit.
      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByLabelText(/^Password/i)).not.toBeInTheDocument();
      await user.click(within(dialog).getByLabelText("Active"));
      await user.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      row = screen.getByText(createdName).closest("tr");
      await within(row as HTMLElement).findByText("Inactive", {}, NETWORK_WAIT);

      const serverDetail = await apiRequest<{ data: { isActive: boolean } }>(`/tailors/${created.id}`, seededToken as string);
      expect(serverDetail.data.isActive).toBe(false);

      // Deactivate (soft-delete) via the Delete action.
      await user.click(screen.getByRole("button", { name: `Delete ${createdName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));
      await waitFor(() => expect(screen.queryByText(createdName)).not.toBeInTheDocument(), NETWORK_WAIT);

      createdTailorIds.splice(createdTailorIds.indexOf(created.id), 1);
    },
    45000
  );

  it(
    "certifies a real tailor for a real process via the edit dialog's checkbox list, confirmed by a real fetch of the tailor detail",
    async () => {
      const token = seededToken as string;
      const processName = `Live Test Process For Tailor ${Date.now()}`;
      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processName }),
      });
      createdProcessIds.push(process.data.id);

      const fixtureName = `Live Test Tailor Fixture ${Date.now()}`;
      const username = `live-test-tailor-fixture-${Date.now()}`;
      const createdTailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName, username, password: "TestPassword123!" }),
      });
      createdTailorIds.push(createdTailor.data.id);

      const testUser = userEvent.setup();
      renderPage();

      await screen.findByText(fixtureName, {}, NETWORK_WAIT);
      await testUser.click(screen.getByRole("button", { name: `Edit ${fixtureName}` }));
      const dialog = await screen.findByRole("dialog");

      await within(dialog).findByText("Certified processes (0)", {}, NETWORK_WAIT);
      const processCheckbox = await within(dialog).findByRole("checkbox", { name: processName });
      expect(processCheckbox).not.toBeChecked();

      await testUser.click(processCheckbox);
      await within(dialog).findByText("Certified processes (1)", {}, NETWORK_WAIT);
      expect(processCheckbox).toBeChecked();

      const afterCertify = await apiRequest<{ data: { certifications: { id: string }[] } }>(
        `/tailors/${createdTailor.data.id}`,
        token
      );
      expect(afterCertify.data.certifications.map((c) => c.id)).toEqual([process.data.id]);

      await testUser.click(processCheckbox);
      await within(dialog).findByText("Certified processes (0)", {}, NETWORK_WAIT);
      expect(processCheckbox).not.toBeChecked();

      const afterDecertify = await apiRequest<{ data: { certifications: { id: string }[] } }>(
        `/tailors/${createdTailor.data.id}`,
        token
      );
      expect(afterDecertify.data.certifications).toEqual([]);

      await testUser.click(screen.getByRole("button", { name: "Cancel" }));
    },
    45000
  );

  it(
    "records a real cash advance through the UI, reflected in the advance balance column and a real fetch of the tailor",
    async () => {
      const token = seededToken as string;
      const fixtureName = `Live Advance Tailor ${Date.now()}`;
      const username = `live-advance-tailor-${Date.now()}`;
      const createdTailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName, username, password: "TestPassword123!" }),
      });
      createdTailorIds.push(createdTailor.data.id);

      const testUser = userEvent.setup();
      renderPage();

      await screen.findByText(fixtureName, {}, NETWORK_WAIT);
      let row = screen.getByText(fixtureName).closest("tr");
      await within(row as HTMLElement).findByText("THB 0.00");

      await testUser.click(screen.getByRole("button", { name: `Record advance for ${fixtureName}` }));
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByText("Current outstanding balance: THB 0.00");
      await testUser.type(within(dialog).getByLabelText(/^Advance amount/i), "75");
      await testUser.click(within(dialog).getByRole("button", { name: "Record Advance" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      row = screen.getByText(fixtureName).closest("tr");
      await within(row as HTMLElement).findByText("THB 75.00", {}, NETWORK_WAIT);

      const afterAdvance = await apiRequest<{ data: { advanceBalance: string } }>(`/tailors/${createdTailor.data.id}`, token);
      expect(afterAdvance.data.advanceBalance).toBe("75.00");
    },
    45000
  );
});
