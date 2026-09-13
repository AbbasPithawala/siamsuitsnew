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
 * the verification notes accompanying this change) — every tenant this file creates is tagged
 * with a `live-test-` slug prefix specifically so it's unambiguous which rows are throwaway.
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
 * Every slug this file creates carries this prefix — the out-of-band cleanup step run after
 * this suite finishes targets exactly this prefix, never touching `siam-suits`/`sawasdee-suits`.
 */
function liveTestSlug(suffix: number | string): string {
  return `live-test-tenant-${suffix}`;
}

// Recorded purely for this file's own reporting/debugging — actual deletion happens out-of-band
// (see this file's doc comment), not here, since there's no delete endpoint to call.
const createdSlugs: string[] = [];

afterAll(() => {
  if (createdSlugs.length > 0) {
    console.log("Live-test tenants created this run (clean up out-of-band):", createdSlugs);
  }
});

describe.skipIf(!seededToken)("TenantsPage (live siam/server integration, platform admin)", () => {
  it(
    "creates a tenant through the Add Tenant dialog, and the returned temp password lets the new owner log in",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const slug = liveTestSlug(suffix);
      const businessName = `Live Test Tenant Co ${suffix}`;
      createdSlugs.push(slug);

      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("heading", { name: "Tenants" });
      await user.click(screen.getByRole("button", { name: "Add Tenant" }));
      const dialog = await screen.findByRole("dialog");

      await user.type(within(dialog).getByLabelText(/business name/i), businessName);
      await user.type(within(dialog).getByLabelText(/^slug/i), slug);
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

      // Independently confirm the row landed for real (not just the UI's own claim).
      const list = await apiRequest<{ data: PlatformTenantDto[] }>("/platform/tenants?page=1&pageSize=100", token);
      const created = list.data.find((t) => t.slug === slug);
      expect(created).toBeTruthy();

      // The real, load-bearing assertion: the generated credentials actually authenticate.
      const loginRes = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: slug, username, password: tempPassword }),
      });
      expect(loginRes.status).toBe(200);
      const loginBody = (await loginRes.json()) as { data: { token: string } };
      expect(loginBody.data.token).toBeTruthy();
    },
    20000
  );

  it(
    "surfaces a real backend 409 as an inline Slug field error when creating with an already-taken slug",
    async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("heading", { name: "Tenants" });
      await user.click(screen.getByRole("button", { name: "Add Tenant" }));
      const dialog = await screen.findByRole("dialog");

      await user.type(within(dialog).getByLabelText(/business name/i), `Collision Test ${Date.now()}`);
      await user.type(within(dialog).getByLabelText(/^slug/i), "siam-suits");
      await user.type(within(dialog).getByLabelText(/owner name/i), "Collision Owner");
      await user.type(within(dialog).getByLabelText(/owner email/i), `collision+${Date.now()}@example.com`);
      await user.click(within(dialog).getByRole("button", { name: "Add Tenant" }));

      await within(dialog).findByText(/already taken/i);
      // Still the create dialog, not the result dialog — the failed request never provisioned anything.
      expect(within(dialog).queryByTestId("created-tenant-temp-password")).not.toBeInTheDocument();
    },
    15000
  );

  it(
    "edits an existing tenant's address through the Edit dialog and persists it against the real backend",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const slug = liveTestSlug(suffix);
      const businessName = `Live Test Edit Target ${suffix}`;
      createdSlugs.push(slug);

      await apiRequest("/platform/tenants", token, {
        method: "POST",
        body: JSON.stringify({
          businessName,
          slug,
          ownerName: "Live Test Owner",
          ownerEmail: `edittarget+${suffix}@example.com`,
        }),
      });

      const user = userEvent.setup();
      renderPage();

      await screen.findByText(businessName);
      await user.click(screen.getByRole("button", { name: `Edit ${businessName}` }));
      const dialog = await screen.findByRole("dialog");

      const newAddress = `123 Live Test Street, Suite ${suffix}`;
      const addressField = within(dialog).getByLabelText(/business address/i);
      await user.clear(addressField);
      await user.type(addressField, newAddress);
      await user.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const list = await apiRequest<{ data: PlatformTenantDto[] }>("/platform/tenants?page=1&pageSize=100", token);
      const edited = list.data.find((t) => t.slug === slug);
      expect(edited?.address).toBe(newAddress);
    },
    20000
  );

  it(
    "toggles a tenant's active state via the switch, unchanged from before this change",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const slug = liveTestSlug(suffix);
      const businessName = `Live Test Toggle Target ${suffix}`;
      createdSlugs.push(slug);

      await apiRequest("/platform/tenants", token, {
        method: "POST",
        body: JSON.stringify({
          businessName,
          slug,
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
      expect(list.data.find((t) => t.slug === slug)?.isActive).toBe(false);
    },
    20000
  );
});
