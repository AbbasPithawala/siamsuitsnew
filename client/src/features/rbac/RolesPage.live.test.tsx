import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { RolesPage } from "./RolesPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `FeaturesPage.live.test.tsx`'s pattern. Covers PHASE_5_TASKS.md
 * Group 4's Roles screen: create/edit/delete through the UI, and the core
 * permission-checkbox grid wired to `/roles/:roleId/permissions`, including
 * that the list's displayed permission count updates live off the same
 * cache entry the checkboxes read (no manual refresh). The full
 * role-to-second-login RBAC proof lives in `RbacEndToEnd.live.test.tsx`.
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
      <RolesPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdRoleIds: string[] = [];

afterEach(async () => {
  if (!seededToken) return;
  while (createdRoleIds.length > 0) {
    const id = createdRoleIds.pop();
    if (!id) continue;
    await apiRequest(`/roles/${id}`, seededToken, { method: "DELETE" }).catch(() => {});
  }
});

describe.skipIf(!seededToken)("RolesPage (live siam/server integration)", () => {
  it(
    "creates a role, grants and revokes permissions via checkboxes, and the list's permission count updates live",
    async () => {
      const user = userEvent.setup();
      renderPage();

      const createdName = `Live Test Role ${Date.now()}`;
      await screen.findByRole("heading", { name: "Roles" });

      await user.click(screen.getByRole("button", { name: "Add Role" }));
      let dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), createdName);
      await user.click(within(dialog).getByRole("button", { name: "Add Role" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      await screen.findByText(createdName, {}, NETWORK_WAIT);
      const list = await apiRequest<{ data: { id: string; name: string }[] }>("/roles", seededToken as string);
      const created = list.data.find((r) => r.name === createdName);
      expect(created).toBeDefined();
      if (!created) return;
      createdRoleIds.push(created.id);

      let row = screen.getByText(createdName).closest("tr");
      await within(row as HTMLElement).findByText("0", {}, NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");

      await within(dialog).findByText("Permissions (0)", {}, NETWORK_WAIT);
      const ordersViewCheckbox = await within(dialog).findByRole("checkbox", { name: /^orders\.view/ });
      const ordersCreateCheckbox = within(dialog).getByRole("checkbox", { name: /^orders\.create\b/ });

      await user.click(ordersViewCheckbox);
      await within(dialog).findByText("Permissions (1)", {}, NETWORK_WAIT);
      await user.click(ordersCreateCheckbox);
      await within(dialog).findByText("Permissions (2)", {}, NETWORK_WAIT);
      expect(ordersViewCheckbox).toBeChecked();
      expect(ordersCreateCheckbox).toBeChecked();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      row = screen.getByText(createdName).closest("tr");
      await within(row as HTMLElement).findByText("2", {}, NETWORK_WAIT);

      const afterGrant = await apiRequest<{ data: { permissions: { key: string }[] } }>(`/roles/${created.id}`, seededToken as string);
      expect(afterGrant.data.permissions.map((p) => p.key).sort()).toEqual(["orders.create", "orders.view"]);

      // Revoke one, confirm the count drops both in the dialog and the row.
      await user.click(screen.getByRole("button", { name: `Edit ${createdName}` }));
      dialog = await screen.findByRole("dialog");
      await within(dialog).findByText("Permissions (2)", {}, NETWORK_WAIT);
      const ordersViewCheckboxAgain = within(dialog).getByRole("checkbox", { name: /^orders\.view/ });
      await user.click(ordersViewCheckboxAgain);
      await within(dialog).findByText("Permissions (1)", {}, NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      row = screen.getByText(createdName).closest("tr");
      await within(row as HTMLElement).findByText("1", {}, NETWORK_WAIT);

      const afterRevoke = await apiRequest<{ data: { permissions: { key: string }[] } }>(`/roles/${created.id}`, seededToken as string);
      expect(afterRevoke.data.permissions.map((p) => p.key)).toEqual(["orders.create"]);

      await user.click(screen.getByRole("button", { name: `Delete ${createdName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));
      await waitFor(() => expect(screen.queryByText(createdName)).not.toBeInTheDocument(), NETWORK_WAIT);

      createdRoleIds.splice(createdRoleIds.indexOf(created.id), 1);
    },
    60000
  );

  it(
    "surfaces a real backend validation error in the create dialog for a duplicate role name",
    async () => {
      const token = seededToken as string;
      const fixtureName = `Live Test Duplicate Role ${Date.now()}`;
      const created = await apiRequest<{ data: { id: string } }>("/roles", token, {
        method: "POST",
        body: JSON.stringify({ name: fixtureName }),
      });
      createdRoleIds.push(created.data.id);

      const user = userEvent.setup();
      renderPage();

      await screen.findByText(fixtureName, {}, NETWORK_WAIT);
      await user.click(screen.getByRole("button", { name: "Add Role" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/^Name/i), fixtureName);
      await user.click(within(dialog).getByRole("button", { name: "Add Role" }));

      await within(dialog).findByText(/already exists/i, {}, NETWORK_WAIT);
      expect(screen.getAllByText(fixtureName)).toHaveLength(1);
    },
    25000
  );
});
