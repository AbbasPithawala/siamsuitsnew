import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { baseApi } from "../api/baseApi";
import authReducer, { readStoredToken } from "../features/auth/authSlice";
import { AuthSessionProvider } from "../app/AuthSessionProvider";
import { AppRoutes } from "./AppRoutes";
import { cleanupProvisionedTenant } from "./testSupport/platformFixtures";

/**
 * Integration tests against a real, running `siam/server` (+ Postgres) — mirrors
 * `platformAdmin.live.test.tsx`'s established pattern, and covers this dispatch's actual scope:
 * PHASE_11_TASKS.md Workstream F Groups 1/2 (`TenantRequestsPage`/`TenantsPage`) and Workstream
 * G (the forced change-password/complete-profile flow), exercised end to end through the real
 * UI/API rather than mocked. Skips itself if the server isn't reachable.
 */

const PLATFORM_ADMIN = { username: "platform-admin", password: "ChangeMe123!" };
const NETWORK_WAIT = { timeout: 15000 };

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: "siam-suits", username: "admin", password: "definitely-wrong-password" }),
    });
    return res.status === 401 || res.ok;
  } catch {
    return false;
  }
}

const serverUp = await isServerReachable();

function buildTestStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState: {
      auth: { token: readStoredToken() },
    },
  });
}

function renderAppAt(initialPath: string, store: EnhancedStore) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthSessionProvider>
          <AppRoutes />
        </AuthSessionProvider>
      </MemoryRouter>
    </Provider>
  );
}

function uniqueSlug(): string {
  return `onboarding-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function submitTenantRequestViaApi(slug: string) {
  const res = await fetch(`${apiBaseUrl}/platform/tenant-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: `Onboarding Live Test ${slug}`,
      contactName: "Onboarding Test Contact",
      email: `${slug}@example.com`,
      phone: "555-0100",
      requestedSlug: slug,
    }),
  });
  expect(res.status).toBe(201);
}

async function loginAsPlatformAdmin(): Promise<EnhancedStore> {
  const store = buildTestStore();
  const rendered = renderAppAt("/platform/login", store);
  const user = userEvent.setup();

  await screen.findByRole("heading", { name: /platform admin login/i });
  await user.type(screen.getByLabelText(/^username/i), PLATFORM_ADMIN.username);
  await user.type(screen.getByLabelText(/^password/i), PLATFORM_ADMIN.password);
  await user.click(screen.getByRole("button", { name: /login/i }));

  await waitFor(() => expect(store.getState().auth.token).toBeTruthy(), NETWORK_WAIT);
  rendered.unmount();
  return store;
}

interface StaffCredentials {
  tenant: string;
  username: string;
  password: string;
}

/**
 * Mirrors `platformAdmin.live.test.tsx`'s own `loginAsStaff`: unmounts the login-form render
 * immediately once a token exists, rather than continuing to assert against that same
 * long-lived render — every subsequent assertion in these tests instead mounts a fresh
 * `renderAppAt` at whatever path it wants to inspect next, with the token already in the store/
 * localStorage. That's also the realistic shape of what's being tested here (does a *fresh*
 * page load land in the right place), not an artifact of test-only plumbing.
 */
async function loginAsStaff(credentials: StaffCredentials): Promise<EnhancedStore> {
  const store = buildTestStore();
  const rendered = renderAppAt("/dashboard", store);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/tenant/i), credentials.tenant);
  await user.type(screen.getByLabelText(/^username/i), credentials.username);
  await user.type(screen.getByLabelText(/^password/i), credentials.password);
  await user.click(screen.getByRole("button", { name: /login/i }));

  await waitFor(() => expect(store.getState().auth.token).toBeTruthy(), NETWORK_WAIT);
  rendered.unmount();
  return store;
}

async function loginRawStatus(credentials: StaffCredentials): Promise<number> {
  const res = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return res.status;
}

async function approveViaUi(
  adminStore: EnhancedStore,
  slug: string,
  overrides?: { logo?: string; address?: string; invoiceFooterText?: string }
): Promise<string> {
  const rendered = renderAppAt("/platform/tenant-requests", adminStore);
  const user = userEvent.setup();

  await screen.findByRole("heading", { name: /tenant requests/i });
  const row = (await screen.findByText(slug, {}, NETWORK_WAIT)).closest("tr");
  expect(row).not.toBeNull();
  await user.click(within(row as HTMLElement).getByRole("button", { name: /approve/i }));

  await screen.findByRole("heading", { name: /approve request/i });
  const dialog = screen.getByRole("dialog");
  if (overrides?.logo) await user.type(within(dialog).getByLabelText(/logo url/i), overrides.logo);
  if (overrides?.address) await user.type(within(dialog).getByLabelText(/business address/i), overrides.address);
  if (overrides?.invoiceFooterText) {
    await user.type(within(dialog).getByLabelText(/invoice footer text/i), overrides.invoiceFooterText);
  }
  await user.click(within(dialog).getByRole("button", { name: /^approve$/i }));

  await screen.findByRole("heading", { name: /tenant provisioned/i }, NETWORK_WAIT);
  const tempPassword = screen.getByTestId("approval-temp-password").textContent ?? "";
  expect(tempPassword.length).toBeGreaterThan(0);
  const resultDialog = screen.getByRole("dialog");
  await user.click(within(resultDialog).getByRole("button", { name: /close/i }));
  rendered.unmount();

  return tempPassword;
}

afterEach(() => {
  window.localStorage.clear();
});

describe.skipIf(!serverUp)(
  "Tenant onboarding: request -> approve/reject -> forced first-login flow (live siam/server integration)",
  () => {
    it(
      "approves with no overrides: forces change-password then complete-profile, and a subsequent login skips both",
      async () => {
        const slug = uniqueSlug();
        await submitTenantRequestViaApi(slug);

        try {
          const adminStore = await loginAsPlatformAdmin();
          const tempPassword = await approveViaUi(adminStore, slug);
          window.localStorage.clear();

          const ownerStore = await loginAsStaff({ tenant: slug, username: "owner", password: tempPassword });

          // Direct navigation to /dashboard while `mustChangePassword` is still true must NOT
          // reach the dashboard.
          const directNav = renderAppAt("/dashboard", ownerStore);
          await screen.findByRole("heading", { name: /change your password/i }, NETWORK_WAIT);
          directNav.unmount();

          const changePasswordRendered = renderAppAt("/change-password", ownerStore);
          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/current password/i), tempPassword);
          await user.type(screen.getByLabelText(/^new password/i), "NewOwnerPass123!");
          await user.type(screen.getByLabelText(/confirm new password/i), "NewOwnerPass123!");
          await user.click(screen.getByRole("button", { name: /change password/i }));

          // No pre-fill was given at approval -> forced to complete-profile next. The form
          // itself only mounts once `useGetInvoiceSettingsQuery` resolves, so wait for a field,
          // not just the (always-present) static heading above it.
          await screen.findByRole("heading", { name: /finish setting up your business/i }, NETWORK_WAIT);
          await user.type(await screen.findByLabelText(/business address/i, {}, NETWORK_WAIT), "123 Test Street");
          await user.click(screen.getByRole("button", { name: /save and continue/i }));

          await screen.findByRole("heading", { name: "Dashboard" }, NETWORK_WAIT);
          changePasswordRendered.unmount();
          window.localStorage.clear();

          // A subsequent login with the new password goes straight to the dashboard — no more
          // forced redirects.
          const secondLoginStore = await loginAsStaff({ tenant: slug, username: "owner", password: "NewOwnerPass123!" });
          const secondLoginRendered = renderAppAt("/dashboard", secondLoginStore);
          await screen.findByRole("heading", { name: "Dashboard" }, NETWORK_WAIT);
          secondLoginRendered.unmount();
        } finally {
          await cleanupProvisionedTenant(slug);
        }
      },
      60000
    );

    it(
      "hybrid pre-fill: approving WITH logo/address/footer overrides skips profile completion entirely",
      async () => {
        const slug = uniqueSlug();
        await submitTenantRequestViaApi(slug);

        try {
          const adminStore = await loginAsPlatformAdmin();
          const tempPassword = await approveViaUi(adminStore, slug, {
            logo: "https://example.com/logo.png",
            address: "456 Hybrid Ave",
            invoiceFooterText: "Thanks for shopping!",
          });
          window.localStorage.clear();

          const ownerStore = await loginAsStaff({ tenant: slug, username: "owner", password: tempPassword });
          const rendered = renderAppAt("/dashboard", ownerStore);
          await screen.findByRole("heading", { name: /change your password/i }, NETWORK_WAIT);

          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/current password/i), tempPassword);
          await user.type(screen.getByLabelText(/^new password/i), "NewOwnerPass123!");
          await user.type(screen.getByLabelText(/confirm new password/i), "NewOwnerPass123!");
          await user.click(screen.getByRole("button", { name: /change password/i }));

          // Pre-filled at approval time -> straight to the dashboard, no complete-profile step.
          await screen.findByRole("heading", { name: "Dashboard" }, NETWORK_WAIT);
          expect(screen.queryByRole("heading", { name: /finish setting up your business/i })).not.toBeInTheDocument();
          rendered.unmount();
        } finally {
          await cleanupProvisionedTenant(slug);
        }
      },
      60000
    );

    it(
      "rejects a request with a reason: shows rejected + reason, creates no tenant, hides its actions",
      async () => {
        const slug = uniqueSlug();
        await submitTenantRequestViaApi(slug);

        try {
          const adminStore = await loginAsPlatformAdmin();
          renderAppAt("/platform/tenant-requests", adminStore);
          const user = userEvent.setup();

          await screen.findByRole("heading", { name: /tenant requests/i });
          const row = (await screen.findByText(slug, {}, NETWORK_WAIT)).closest("tr");
          expect(row).not.toBeNull();
          await user.click(within(row as HTMLElement).getByRole("button", { name: /reject/i }));

          await screen.findByRole("heading", { name: /reject request/i });
          const dialog = screen.getByRole("dialog");
          await user.type(within(dialog).getByLabelText(/reason/i), "Duplicate submission");
          await user.click(within(dialog).getByRole("button", { name: /^reject$/i }));

          // The default "Pending" filter no longer includes this request once it's rejected —
          // switch to "All" to find its row again.
          await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);
          await user.click(screen.getByRole("combobox", { name: /status/i }));
          await user.click(await screen.findByRole("option", { name: "All" }));

          await waitFor(
            () => {
              const refreshedRow = screen.getByText(slug).closest("tr") as HTMLElement;
              expect(within(refreshedRow).getByText(/rejected/i)).toBeInTheDocument();
              expect(within(refreshedRow).queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
              expect(within(refreshedRow).queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
            },
            NETWORK_WAIT
          );

          const token = adminStore.getState().auth.token as string;
          const listRes = await fetch(`${apiBaseUrl}/platform/tenant-requests?status=rejected&pageSize=50`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const listBody = (await listRes.json()) as {
            data: Array<{ requestedSlug: string; rejectionReason: string | null; createdTenantId: string | null }>;
          };
          const rejected = listBody.data.find((r) => r.requestedSlug === slug);
          expect(rejected?.rejectionReason).toBe("Duplicate submission");
          expect(rejected?.createdTenantId).toBeNull();

          expect(await loginRawStatus({ tenant: slug, username: "owner", password: "irrelevant" })).toBe(401);
        } finally {
          await cleanupProvisionedTenant(slug);
        }
      },
      30000
    );

    it(
      "TenantsPage: deactivating a tenant blocks its owner's login, reactivating restores it",
      async () => {
        const slug = uniqueSlug();
        await submitTenantRequestViaApi(slug);

        try {
          const adminStore = await loginAsPlatformAdmin();
          const tempPassword = await approveViaUi(adminStore, slug);

          expect(await loginRawStatus({ tenant: slug, username: "owner", password: tempPassword })).toBe(200);

          renderAppAt("/platform/tenants", adminStore);
          const user = userEvent.setup();
          await screen.findByRole("heading", { name: "Tenants" });

          // Bump rows-per-page so this freshly-created row isn't pushed onto a later page by
          // however many other tenants already exist in this (real, shared dev) database.
          await user.click(screen.getByRole("combobox", { name: /rows per page/i }));
          await user.click(await screen.findByRole("option", { name: "100" }));

          const tenantRow = (await screen.findByText(slug, {}, NETWORK_WAIT)).closest("tr") as HTMLElement;
          const toggle = within(tenantRow).getByRole("checkbox");
          expect(toggle).toBeChecked();

          await user.click(toggle);
          await waitFor(() => expect(toggle).not.toBeChecked(), NETWORK_WAIT);
          expect(await loginRawStatus({ tenant: slug, username: "owner", password: tempPassword })).toBe(401);

          await user.click(toggle);
          await waitFor(() => expect(toggle).toBeChecked(), NETWORK_WAIT);
          expect(await loginRawStatus({ tenant: slug, username: "owner", password: tempPassword })).toBe(200);
        } finally {
          await cleanupProvisionedTenant(slug);
        }
      },
      60000
    );

    it(
      "regression: an existing, already-onboarded tenant's login is completely unaffected by the new guard",
      async () => {
        const store = await loginAsStaff({ tenant: "siam-suits", username: "admin", password: "ChangeMe123!" });
        expect(store.getState().auth.token).toBeTruthy();

        const rendered = renderAppAt("/dashboard", store);
        await screen.findByRole("heading", { name: "Dashboard" }, NETWORK_WAIT);
        expect(screen.queryByRole("heading", { name: /change your password/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /finish setting up your business/i })).not.toBeInTheDocument();
        rendered.unmount();
      },
      30000
    );
  }
);
