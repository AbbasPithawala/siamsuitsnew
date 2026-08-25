import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { RolesPage } from "./RolesPage";
import { UsersPage } from "./UsersPage";

/**
 * PHASE_5_TASKS.md Group 4's headline acceptance test — the real end-to-end
 * proof that Phase 4's permission-gated shell (`/api/me`'s `permissions[]`,
 * consumed by `RequirePermission`/`useHasPermission`) and this phase's RBAC
 * admin UI actually work together:
 *
 *   1. Create a role through `RolesPage`'s real UI.
 *   2. Grant it a small, deliberate subset — 3 of the 28 real catalog
 *      permissions — via the checkbox grid, also through the real UI.
 *   3. Create a user through `UsersPage`'s real UI.
 *   4. Assign that user the role, through the real UI.
 *   5. Log in a SECOND time as that brand-new user (`POST /auth/login` with
 *      their real username/password — a genuine bcrypt-verify + JWT-issue
 *      round trip, not a mock) and call `GET /api/me` with the resulting
 *      token, asserting its `permissions[]` is *exactly* the 3 granted keys
 *      — no more (proving the role's own scoping and `resolveUserPermissions`
 *      aren't leaking the seed admin's other 25 permissions) and no fewer.
 *
 * Two admin pages can't both be mounted at once meaningfully (they're full
 * `/admin/*` screens, not composable widgets), so this test renders and
 * unmounts each in turn against the same seeded-admin-token store, rather
 * than simulating actual page navigation — the thing being proven is the
 * data plumbing end to end, not the router.
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

function renderRolesPage() {
  return render(
    <Provider store={buildTestStore()}>
      <RolesPage />
    </Provider>
  );
}

function renderUsersPage() {
  return render(
    <Provider store={buildTestStore()}>
      <UsersPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

/** Deliberately a small, mixed-module subset (2 of "Orders", 1 of "Retailers") — the literal opposite of the seed admin's full 28. */
const GRANTED_PERMISSION_KEYS = ["orders.view", "orders.create", "retailers.manage"] as const;
const GRANTED_PERMISSION_PATTERNS: Record<(typeof GRANTED_PERMISSION_KEYS)[number], RegExp> = {
  "orders.view": /^orders\.view\b/,
  "orders.create": /^orders\.create\b/,
  "retailers.manage": /^retailers\.manage\b/,
};

const createdRoleIds: string[] = [];
const createdUserIds: string[] = [];

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

describe.skipIf(!seededToken)("RBAC admin end-to-end (live siam/server integration)", () => {
  it(
    "grants a role a limited permission subset and a newly created user that role, entirely through the UI, and a real second login as that user sees exactly those permissions",
    async () => {
      const token = seededToken as string;
      const admin = userEvent.setup();

      // 1 + 2: create the role and grant exactly the 3 chosen permissions via RolesPage's real UI.
      const roleName = `Live E2E Limited Role ${Date.now()}`;
      const rolesRender = renderRolesPage();

      await screen.findByRole("heading", { name: "Roles" });
      await admin.click(screen.getByRole("button", { name: "Add Role" }));
      const createRoleDialog = await screen.findByRole("dialog");
      await admin.type(within(createRoleDialog).getByLabelText(/^Name/i), roleName);
      await admin.click(within(createRoleDialog).getByRole("button", { name: "Add Role" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);
      await screen.findByText(roleName, {}, NETWORK_WAIT);

      const roleList = await apiRequest<{ data: { id: string; name: string }[] }>("/roles", token);
      const createdRole = roleList.data.find((r) => r.name === roleName);
      expect(createdRole).toBeDefined();
      if (!createdRole) return;
      createdRoleIds.push(createdRole.id);

      await admin.click(screen.getByRole("button", { name: `Edit ${roleName}` }));
      const editRoleDialog = await screen.findByRole("dialog");
      await within(editRoleDialog).findByText("Permissions (0)", {}, NETWORK_WAIT);

      for (const key of GRANTED_PERMISSION_KEYS) {
        const checkbox = await within(editRoleDialog).findByRole("checkbox", { name: GRANTED_PERMISSION_PATTERNS[key] });
        await admin.click(checkbox);
      }
      await within(editRoleDialog).findByText(`Permissions (${GRANTED_PERMISSION_KEYS.length})`, {}, NETWORK_WAIT);
      for (const key of GRANTED_PERMISSION_KEYS) {
        expect(within(editRoleDialog).getByRole("checkbox", { name: GRANTED_PERMISSION_PATTERNS[key] })).toBeChecked();
      }

      await admin.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      // Confirm the exact 3 landed server-side before moving on — the
      // acceptance criterion is about exactness, not just "some subset".
      const roleDetail = await apiRequest<{ data: { permissions: { key: string }[] } }>(`/roles/${createdRole.id}`, token);
      expect(roleDetail.data.permissions.map((p) => p.key).sort()).toEqual([...GRANTED_PERMISSION_KEYS].sort());

      rolesRender.unmount();

      // 3 + 4: create a user and assign it that role via UsersPage's real UI.
      const userName = `Live E2E Limited User ${Date.now()}`;
      const username = `live-e2e-limited-user-${Date.now()}`;
      const password = "LiveE2ePassword123!";
      const usersRender = renderUsersPage();

      await screen.findByRole("heading", { name: "Users" });
      await admin.click(screen.getByRole("button", { name: "Add User" }));
      const createUserDialog = await screen.findByRole("dialog");
      await admin.type(within(createUserDialog).getByLabelText(/^Name/i), userName);
      await admin.type(within(createUserDialog).getByLabelText(/^Username/i), username);
      await admin.type(within(createUserDialog).getByLabelText(/^Password/i), password);
      await admin.click(within(createUserDialog).getByRole("button", { name: "Add User" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);
      await screen.findByText(userName, {}, NETWORK_WAIT);

      const userList = await apiRequest<{ data: { id: string; username: string }[] }>("/users", token);
      const createdUser = userList.data.find((u) => u.username === username);
      expect(createdUser).toBeDefined();
      if (!createdUser) return;
      createdUserIds.push(createdUser.id);

      await admin.click(screen.getByRole("button", { name: `Edit ${userName}` }));
      const editUserDialog = await screen.findByRole("dialog");
      await within(editUserDialog).findByText("Roles (0)", {}, NETWORK_WAIT);
      const roleCheckbox = await within(editUserDialog).findByRole("checkbox", { name: roleName });
      await admin.click(roleCheckbox);
      await within(editUserDialog).findByText("Roles (1)", {}, NETWORK_WAIT);
      expect(roleCheckbox).toBeChecked();

      await admin.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const userDetail = await apiRequest<{ data: { roles: { id: string }[] } }>(`/users/${createdUser.id}`, token);
      expect(userDetail.data.roles.map((r) => r.id)).toEqual([createdRole.id]);

      usersRender.unmount();

      // 5: a REAL second login as the brand-new user — genuine bcrypt
      // verification + JWT issuance against the real server, not a mock.
      const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: "siam-suits", username, password }),
      });
      expect(loginResponse.ok).toBe(true);
      const loginBody = (await loginResponse.json()) as { data: { token: string } };
      const secondLoginToken = loginBody.data.token;
      expect(secondLoginToken).toBeTruthy();

      const meResponse = await fetch(`${apiBaseUrl}/me`, {
        headers: { Authorization: `Bearer ${secondLoginToken}` },
      });
      expect(meResponse.ok).toBe(true);
      const meBody = (await meResponse.json()) as { data: { permissions: string[]; username: string } };

      expect(meBody.data.username).toBe(username);
      // The exact-match assertion: neither a superset (leaking the seed
      // admin's other 25 permissions) nor a subset (a grant that silently
      // didn't take) — precisely the 3 checked in the UI above.
      expect(meBody.data.permissions.sort()).toEqual([...GRANTED_PERMISSION_KEYS].sort());
    },
    60000
  );
});
