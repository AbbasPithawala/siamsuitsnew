import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { RetailersPage } from "./RetailersPage";
import {
  clickNextPage,
  getFirstDataRowText,
  getPaginationRangeText,
  parsePaginationTotal,
  switchRowsPerPage,
  waitForFirstDataRowChange,
  waitForRangeText,
} from "../../testSupport/paginationTestHelpers";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `UsersPage.live.test.tsx`'s pattern. Covers PHASE_6_TASKS.md
 * Group 4's Retailers screen: create/edit/deactivate through the UI,
 * replacing Phase 4's placeholder at the same `/retailers` route.
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
      <RetailersPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdRetailerIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdRetailerIds.length > 0) {
    const id = createdRetailerIds.pop();
    if (!id) continue;
    await apiRequest(`/retailers/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("RetailersPage (live siam/server integration)", () => {
  it(
    "creates, edits, and deactivates a real retailer entirely through the UI",
    async () => {
      const user = userEvent.setup();
      renderPage();

      const createdName = `Live Test Retailer ${Date.now()}`;
      const code = `LTR-${Date.now()}`;
      await screen.findByRole("heading", { name: "Retailers" });

      await user.click(screen.getByRole("button", { name: "Add Retailer" }));
      let dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await user.type(within(dialog).getByLabelText(/^Code/i), code);
      await user.type(within(dialog).getByLabelText(/^Owner name/i), "Live Test Owner");
      await user.type(within(dialog).getByLabelText(/^Email recipients/i), "a@example.com, b@example.com");
      await user.click(within(dialog).getByRole("button", { name: "Add Retailer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      await screen.findByText(createdName, {}, NETWORK_WAIT);
      const list = await apiRequest<{ data: { id: string; code: string }[] }>("/retailers", seededToken as string);
      const created = list.data.find((r) => r.code === code);
      expect(created).toBeDefined();
      if (!created) return;
      createdRetailerIds.push(created.id);

      const detail = await apiRequest<{ data: { ownerName: string | null; emailRecipients: string[] | null } }>(
        `/retailers/${created.id}`,
        seededToken as string
      );
      expect(detail.data.ownerName).toBe("Live Test Owner");
      expect(detail.data.emailRecipients).toEqual(["a@example.com", "b@example.com"]);

      let row = screen.getByText(createdName).closest("tr");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText("Active")).toBeInTheDocument();

      // Edit: flip Active off.
      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByLabelText("Active"));
      await user.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      row = screen.getByText(createdName).closest("tr");
      await within(row as HTMLElement).findByText("Inactive", {}, NETWORK_WAIT);

      const serverDetail = await apiRequest<{ data: { isActive: boolean } }>(`/retailers/${created.id}`, seededToken as string);
      expect(serverDetail.data.isActive).toBe(false);

      // Deactivate (soft-delete) via the Delete action.
      await user.click(screen.getByRole("button", { name: `Delete ${createdName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));
      await waitFor(() => expect(screen.queryByText(createdName)).not.toBeInTheDocument(), NETWORK_WAIT);

      createdRetailerIds.splice(createdRetailerIds.indexOf(created.id), 1);
    },
    45000
  );

  it(
    "paginates the retailer list against real, already-seeded data (PHASE_10_TASKS.md Workstream C Group 4)",
    async () => {
      const token = seededToken as string;
      const user = userEvent.setup();

      renderPage();
      await screen.findByRole("heading", { name: "Retailers" });
      await waitForRangeText(/of \d+/);

      // Switch to rows-per-page 10 — the real, already-seeded tenant has more
      // than 10 retailers from prior phases' ETL/other live tests, so no new
      // fixtures are needed to prove a real second page exists.
      await switchRowsPerPage(user, 10);
      await waitForRangeText(/1.*10 of \d+/);
      const total = parsePaginationTotal(getPaginationRangeText());
      expect(total).toBeGreaterThan(10);

      const firstPageFirstRowText = getFirstDataRowText();

      await clickNextPage(user);
      await waitForRangeText(/11.*\d+ of \d+/);
      // The range text updates synchronously on click (local pagination
      // state) — it doesn't prove the real page-2 request has resolved yet.
      // Waiting for the row content to genuinely change is the real signal.
      await waitForFirstDataRowChange(firstPageFirstRowText);

      const tableAfter = screen.getByRole("table");
      const secondPageFirstRowText = within(tableAfter).getAllByRole("row")[1]?.textContent;
      expect(secondPageFirstRowText).not.toBe(firstPageFirstRowText);

      const page1 = await apiRequest<{ data: { id: string }[] }>("/retailers?page=1&pageSize=10", token);
      const page2 = await apiRequest<{ data: { id: string }[] }>("/retailers?page=2&pageSize=10", token);
      const page1Ids = new Set(page1.data.map((r) => r.id));
      expect(page2.data.every((r) => !page1Ids.has(r.id))).toBe(true);
    },
    20000
  );
});
