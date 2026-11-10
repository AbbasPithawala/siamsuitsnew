import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { TenantsPage } from "./TenantsPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked) — same established
 * pattern as `MeasurementDefinitionsPage.live.test.tsx`/`FeaturesPage.live.test.tsx`, logged in
 * as the platform admin (`/platform/login`) rather than a tenant-scoped staff user, mirroring
 * `routes/platformAdmin.live.test.tsx`'s own credentials.
 *
 * There is no `DELETE /platform/tenants/:id` route (by design — a provisioned tenant is real
 * production data, not a soft-deletable catalog row), so unlike every other `*.live.test.tsx`
 * file in this codebase, cleanup of tenants created here can't happen inside the test process
 * itself. It's done out-of-band after this suite runs, directly against the dev database (see
 * the verification notes accompanying this change) — every tenant this file creates uses a
 * `Live Test ...` business name specifically so it's unambiguous which rows are throwaway. The
 * server derives each tenant's slug from its business name (there's no Slug input anymore), so
 * every one of those rows also lands with a `live-test-...` slug prefix automatically.
 */

const PLATFORM_ADMIN_CREDENTIALS = { username: "platform-admin", password: "ChangeMe123!" };

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function fetchPlatformAdminToken(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/platform/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PLATFORM_ADMIN_CREDENTIALS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { token: string } };
    return body.data.token;
  } catch {
    return null;
  }
}

const seededToken = await fetchPlatformAdminToken();

async function apiRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function buildTestStore(token: string | null) {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token }) => state;
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function renderPage() {
  return render(
    <Provider store={buildTestStore(seededToken)}>
      <TenantsPage />
    </Provider>
  );
}

interface PlatformTenantDto {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  isActive: boolean;
}

/**
 * Every business name this file creates carries this prefix — the out-of-band cleanup step run
 * after this suite finishes targets the `live-test-...` slugs the server derives from it, never
 * touching `siam-suits`/`sawasdee-suits`.
 */
function liveTestBusinessName(suffix: number | string): string {
  return `Live Test Tenant Co ${suffix}`;
}

// Recorded purely for this file's own reporting/debugging — actual deletion happens out-of-band
// (see this file's doc comment), not here, since there's no delete endpoint to call.
const createdBusinessNames: string[] = [];

afterAll(() => {
  if (createdBusinessNames.length > 0) {
    console.log("Live-test tenants created this run (clean up out-of-band):", createdBusinessNames);
  }
});

describe.skipIf(!seededToken)("TenantsPage (live siam/server integration, platform admin)", () => {
  it(
    "creates a tenant through the Add Tenant dialog with no Slug field, and the returned temp password lets the new owner log in",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const businessName = liveTestBusinessName(suffix);
      createdBusinessNames.push(businessName);

      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("heading", { name: "Tenants" });
      await user.click(screen.getByRole("button", { name: "Add Tenant" }));
      const dialog = await screen.findByRole("dialog");

      expect(within(dialog).queryByLabelText(/^slug/i)).not.toBeInTheDocument();
      await user.type(within(dialog).getByLabelText(/business name/i), businessName);
      await user.type(within(dialog).getByLabelText(/owner name/i), "Live Test Owner");
      await user.type(within(dialog).getByLabelText(/owner email/i), `livetest+${suffix}@example.com`);
      await user.click(within(dialog).getByRole("button", { name: "Add Tenant" }));

      const resultHeading = await screen.findByRole("heading", { name: "Tenant provisioned" }, { timeout: 10000 });
      const resultDialog = resultHeading.closest('[role="dialog"]') as HTMLElement;
      await within(resultDialog).findByText(businessName, { exact: false });
      const username = within(resultDialog).getByTestId("created-tenant-owner-username").textContent;
      const tempPassword = within(resultDialog).getByTestId("created-tenant-temp-password").textContent;
      expect(username).toBeTruthy();
      expect(tempPassword).toBeTruthy();

      await user.click(within(resultDialog).getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByText(businessName)).toBeInTheDocument());

      // Independently confirm the row landed for real (not just the UI's own claim), and that
      // the server derived a slug matching the business name.
      const list = await apiRequest<{ data: PlatformTenantDto[] }>("/platform/tenants?page=1&pageSize=100", token);
      const created = list.data.find((t) => t.name === businessName);
      expect(created).toBeTruthy();
      expect(created?.slug).toMatch(/^live-test-tenant-co-\d+$/);

      // The real, load-bearing assertion: the generated credentials actually authenticate,
      // against the server-derived slug (never typed anywhere in this test).
      const loginRes = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: created?.slug, username, password: tempPassword }),
      });
      expect(loginRes.status).toBe(200);
      const loginBody = (await loginRes.json()) as { data: { token: string } };
      expect(loginBody.data.token).toBeTruthy();
    },
    20000
  );

  it(
    "creating a second tenant with the exact same business name is idempotent rather than erroring or duplicating",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const businessName = `Live Test Duplicate Name Co ${suffix}`;
      createdBusinessNames.push(businessName);

      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("heading", { name: "Tenants" });

      async function submitCreate(ownerEmail: string) {
        await user.click(screen.getByRole("button", { name: "Add Tenant" }));
        const dialog = await screen.findByRole("dialog");
        await user.type(within(dialog).getByLabelText(/business name/i), businessName);
        await user.type(within(dialog).getByLabelText(/owner name/i), "Live Test Owner");
        await user.type(within(dialog).getByLabelText(/owner email/i), ownerEmail);
        await user.click(within(dialog).getByRole("button", { name: "Add Tenant" }));
        const resultHeading = await screen.findByRole("heading", { name: "Tenant provisioned" }, { timeout: 10000 });
        const resultDialog = resultHeading.closest('[role="dialog"]') as HTMLElement;
        await user.click(within(resultDialog).getByRole("button", { name: "Close" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      }

      await submitCreate(`duplicate-first+${suffix}@example.com`);
      await submitCreate(`duplicate-second+${suffix}@example.com`);

      // Same business name twice resolves to the one tenant, not two rows with suffixed slugs.
      const list = await apiRequest<{ data: PlatformTenantDto[] }>("/platform/tenants?page=1&pageSize=100", token);
      const matches = list.data.filter((t) => t.name === businessName);
      expect(matches).toHaveLength(1);
    },
    25000
  );

  it(
    "edits an existing tenant's address through the Edit dialog and persists it against the real backend",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const businessName = `Live Test Edit Target ${suffix}`;
      createdBusinessNames.push(businessName);

      await apiRequest("/platform/tenants", token, {
        method: "POST",
        body: JSON.stringify({
          businessName,
          ownerName: "Live Test Owner",
          ownerEmail: `edittarget+${suffix}@example.com`,
        }),
      });

      const user = userEvent.setup();
      renderPage();

      await screen.findByText(businessName);
      await user.click(screen.getByRole("button", { name: `Edit ${businessName}` }));
      const dialog = await screen.findByRole("dialog");

      expect(within(dialog).queryByLabelText(/^slug/i)).not.toBeInTheDocument();
      const newAddress = `123 Live Test Street, Suite ${suffix}`;
      const addressField = within(dialog).getByLabelText(/business address/i);
      await user.clear(addressField);
      await user.type(addressField, newAddress);
      await user.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const list = await apiRequest<{ data: PlatformTenantDto[] }>("/platform/tenants?page=1&pageSize=100", token);
      const edited = list.data.find((t) => t.name === businessName);
      expect(edited?.address).toBe(newAddress);
    },
    20000
  );

  it(
    "toggles a tenant's active state via the switch, unchanged from before this change",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const businessName = `Live Test Toggle Target ${suffix}`;
      createdBusinessNames.push(businessName);

      await apiRequest("/platform/tenants", token, {
        method: "POST",
        body: JSON.stringify({
          businessName,
          ownerName: "Live Test Owner",
          ownerEmail: `toggletarget+${suffix}@example.com`,
        }),
      });

      const user = userEvent.setup();
      renderPage();

      await screen.findByText(businessName);
      const toggle = screen.getByLabelText(`Toggle ${businessName} active`);
      expect(toggle).toBeChecked();

      await user.click(toggle);
      await waitFor(() => expect(toggle).not.toBeChecked());

      const list = await apiRequest<{ data: PlatformTenantDto[] }>("/platform/tenants?page=1&pageSize=100", token);
      expect(list.data.find((t) => t.name === businessName)?.isActive).toBe(false);
    },
    20000
  );
});
