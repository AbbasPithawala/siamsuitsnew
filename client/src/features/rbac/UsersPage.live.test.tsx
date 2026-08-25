import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { UsersPage } from "./UsersPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `FeaturesPage.live.test.tsx`'s pattern. Covers PHASE_5_TASKS.md
 * Group 4's Users screen: create/edit/deactivate through the UI, plus the
 * nested role-assignment checkbox list wired to `/users/:userId/roles`. The
 * bigger "grant a limited role, second-login, confirm /api/me matches
 * exactly" acceptance test lives in `RbacEndToEnd.live.test.tsx` — this file
 * covers the page's own CRUD/role-toggle mechanics in isolation.
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
      <UsersPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument(), NETWORK_WAIT);
}

/**
 * Mirrors `CustomersPage.live.test.tsx`'s `selectInCombobox` helper for the same MUI
 * `<Select>` pattern, but matches by `role="combobox"` + accessible name rather than
 * `getByLabelText` — this page's edit dialog has a same-named `Switch` sibling whose
 * bare `<input type="checkbox">` `getByLabelText`'s looser heuristics can false-positive
 * match against during a dialog re-open transition, which `getByRole` doesn't share.
 */
async function selectInCombobox(user: ReturnType<typeof userEvent.setup>, container: HTMLElement, labelText: string, optionName: string) {
  const combobox = within(container).getByRole("combobox", { name: new RegExp(`^${labelText}`, "i") });
  await user.click(combobox);
  const listbox = await screen.findByRole("listbox", {}, NETWORK_WAIT);
  await user.click(within(listbox).getByRole("option", { name: optionName }));
  await waitForNoOpenListbox();
}

const createdUserIds: string[] = [];
const createdRoleIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop();
    if (!id) continue;
    await apiRequest(`/users/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
  while (createdRoleIds.length > 0) {
    const id = createdRoleIds.pop();
    if (!id) continue;
    await apiRequest(`/roles/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("UsersPage (live siam/server integration)", () => {
  it(
    "creates, edits, and deactivates a real user entirely through the UI",
    async () => {
      const user = userEvent.setup();
      renderPage();

      const createdName = `Live Test User ${Date.now()}`;
      const username = `live-test-user-${Date.now()}`;
      await screen.findByRole("heading", { name: "Users" });

      await user.click(screen.getByRole("button", { name: "Add User" }));
      let dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await user.type(within(dialog).getByLabelText(/^Username/i), username);
      await user.type(within(dialog).getByLabelText(/^Password/i), "TestPassword123!");
      await user.click(within(dialog).getByRole("button", { name: "Add User" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      await screen.findByText(createdName, {}, NETWORK_WAIT);
      const list = await apiRequest<{ data: { id: string; username: string }[] }>("/users", seededToken as string);
      const created = list.data.find((u) => u.username === username);
      expect(created).toBeDefined();
      if (!created) return;
      createdUserIds.push(created.id);

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

      const serverDetail = await apiRequest<{ data: { isActive: boolean } }>(`/users/${created.id}`, seededToken as string);
      expect(serverDetail.data.isActive).toBe(false);

      // Deactivate (soft-delete) via the Delete action.
      await user.click(screen.getByRole("button", { name: `Delete ${createdName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));
      await waitFor(() => expect(screen.queryByText(createdName)).not.toBeInTheDocument(), NETWORK_WAIT);

      createdUserIds.splice(createdUserIds.indexOf(created.id), 1);
    },
    45000
  );

  it(
    "assigns and unassigns a real role for a user via the edit dialog's checkbox list",
    async () => {
      const token = seededToken as string;
      const roleName = `Live Test Role For User ${Date.now()}`;
      const role = await apiRequest<{ data: { id: string } }>("/roles", token, {
        method: "POST",
        body: JSON.stringify({ name: roleName }),
      });
      createdRoleIds.push(role.data.id);

      const fixtureName = `Live Test User Fixture ${Date.now()}`;
      const username = `live-test-user-fixture-${Date.now()}`;
      const createdUser = await apiRequest<{ data: { id: string } }>("/users", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName, username, password: "TestPassword123!" }),
      });
      createdUserIds.push(createdUser.data.id);

      const testUser = userEvent.setup();
      renderPage();

      await screen.findByText(fixtureName, {}, NETWORK_WAIT);
      await testUser.click(screen.getByRole("button", { name: `Edit ${fixtureName}` }));
      const dialog = await screen.findByRole("dialog");

      await within(dialog).findByText("Roles (0)", {}, NETWORK_WAIT);
      const roleCheckbox = await within(dialog).findByRole("checkbox", { name: roleName });
      expect(roleCheckbox).not.toBeChecked();

      await testUser.click(roleCheckbox);
      await within(dialog).findByText("Roles (1)", {}, NETWORK_WAIT);
      expect(roleCheckbox).toBeChecked();

      const afterAssign = await apiRequest<{ data: { roles: { id: string }[] } }>(`/users/${createdUser.data.id}`, token);
      expect(afterAssign.data.roles.map((r) => r.id)).toEqual([role.data.id]);

      await testUser.click(roleCheckbox);
      await within(dialog).findByText("Roles (0)", {}, NETWORK_WAIT);
      expect(roleCheckbox).not.toBeChecked();

      const afterUnassign = await apiRequest<{ data: { roles: { id: string }[] } }>(`/users/${createdUser.data.id}`, token);
      expect(afterUnassign.data.roles).toEqual([]);

      await testUser.click(screen.getByRole("button", { name: "Cancel" }));
    },
    45000
  );

  it(
    "links a user to a real retailer via the picker, round-trips it, clears it, and leaves an untouched link alone across an unrelated edit",
    async () => {
      const token = seededToken as string;
      const retailersList = await apiRequest<{ data: { id: string; name: string }[] }>("/retailers", token);
      const [retailerA, retailerB] = retailersList.data;
      expect(retailerA).toBeDefined();
      expect(retailerB).toBeDefined();
      if (!retailerA || !retailerB) return;

      const testUser = userEvent.setup();
      renderPage();
      await screen.findByRole("heading", { name: "Users" });

      // Create a user linked to retailerA through the picker.
      const createdName = `Live Test Retailer-Linked User ${Date.now()}`;
      const username = `live-test-retailer-user-${Date.now()}`;
      await testUser.click(screen.getByRole("button", { name: "Add User" }));
      let dialog = await screen.findByRole("dialog");
      await testUser.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await testUser.type(within(dialog).getByLabelText(/^Username/i), username);
      await testUser.type(within(dialog).getByLabelText(/^Password/i), "TestPassword123!");
      await selectInCombobox(testUser, dialog, "Retailer", retailerA.name);
      await testUser.click(within(dialog).getByRole("button", { name: "Add User" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      await screen.findByText(createdName, {}, NETWORK_WAIT);
      const list = await apiRequest<{ data: { id: string; username: string }[] }>("/users", token);
      const created = list.data.find((u) => u.username === username);
      expect(created).toBeDefined();
      if (!created) return;
      createdUserIds.push(created.id);

      const afterCreate = await apiRequest<{ data: { retailerId: string | null } }>(`/users/${created.id}`, token);
      expect(afterCreate.data.retailerId).toBe(retailerA.id);

      // Re-open the edit form: confirm the picker round-trips the same retailer.
      await testUser.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");
      await within(dialog).findByText(retailerA.name, {}, NETWORK_WAIT);

      // Change some OTHER field (Active) without touching the retailer picker — the link
      // must survive, proving an untouched retailer selection is never silently sent as null.
      await testUser.click(within(dialog).getByLabelText("Active"));
      await testUser.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const afterUnrelatedEdit = await apiRequest<{ data: { retailerId: string | null; isActive: boolean } }>(
        `/users/${created.id}`,
        token
      );
      expect(afterUnrelatedEdit.data.retailerId).toBe(retailerA.id);
      expect(afterUnrelatedEdit.data.isActive).toBe(false);

      // Re-open again and explicitly clear the link via "None / Staff".
      await testUser.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");
      await within(dialog).findByText(retailerA.name, {}, NETWORK_WAIT);
      await selectInCombobox(testUser, dialog, "Retailer", "None / Staff");
      await testUser.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const afterClear = await apiRequest<{ data: { retailerId: string | null } }>(`/users/${created.id}`, token);
      expect(afterClear.data.retailerId).toBeNull();
    },
    45000
  );
});
