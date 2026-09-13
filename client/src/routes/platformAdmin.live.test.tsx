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

/**
 * Integration tests against a real, running `siam/server` (+ Postgres),
 * mirroring `routing.live.test.tsx`'s established pattern — exercises the
 * real platform-admin auth shell (PHASE_11_TASKS.md Workstream F Group 0)
 * and public request-access page (Workstream E Group 0) end to end rather
 * than mocking the API. Skips itself if the server isn't reachable.
 */

const SEED_ADMIN = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const PLATFORM_ADMIN = {
  username: "platform-admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...SEED_ADMIN, password: "definitely-wrong-password" }),
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

async function loginAsStaff(credentials: { tenant: string; username: string; password: string }) {
  const store = buildTestStore();
  const rendered = renderAppAt("/dashboard", store);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/tenant/i), credentials.tenant);
  await user.type(screen.getByLabelText(/^username/i), credentials.username);
  await user.type(screen.getByLabelText(/^password/i), credentials.password);
  await user.click(screen.getByRole("button", { name: /login/i }));

  await waitFor(() => expect(store.getState().auth.token).toBeTruthy());
  rendered.unmount();
  return store;
}

async function loginAsPlatformAdmin() {
  const store = buildTestStore();
  const rendered = renderAppAt("/platform/login", store);
  const user = userEvent.setup();

  await screen.findByRole("heading", { name: /platform admin login/i });
  await user.type(screen.getByLabelText(/^username/i), PLATFORM_ADMIN.username);
  await user.type(screen.getByLabelText(/^password/i), PLATFORM_ADMIN.password);
  await user.click(screen.getByRole("button", { name: /login/i }));

  await waitFor(() => expect(store.getState().auth.token).toBeTruthy());
  // Scoped to the header's `body2` name element specifically
  // (`PlatformAdminShell.tsx`'s `<Typography variant="body2">{me.name}</Typography>`)
  // — the shell's own title ("Siam Suits — Platform Admin") also matches
  // /platform admin/i as plain text, so an unscoped lookup is ambiguous
  // (`me.name` is literally "Platform Admin" for the seeded dev account).
  await waitFor(() => {
    const header = screen.getByRole("banner");
    const nameEl = header.querySelector(".MuiTypography-body2");
    expect(nameEl?.textContent).toMatch(/platform admin/i);
  });

  rendered.unmount();
  return store;
}

afterEach(() => {
  window.localStorage.clear();
});

describe.skipIf(!serverUp)("Platform admin panel & public request-access page (live siam/server integration)", () => {
  it("submits the public request-access form and shows the on-page confirmation, with no token required", async () => {
    renderAppAt("/request-access", buildTestStore());
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /request access/i });

    const uniqueSlug = `live-test-${Date.now()}`;
    await user.type(screen.getByLabelText(/business name/i), "Live Test Tailors");
    await user.type(screen.getByLabelText(/contact name/i), "Live Test Contact");
    await user.type(screen.getByLabelText(/contact email/i), "livetest@example.com");
    await user.type(screen.getByLabelText(/contact phone/i), "555-0100");
    await user.type(screen.getByLabelText(/desired slug/i), uniqueSlug);
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await screen.findByRole("heading", { name: /request received/i });

    // Independently confirm a real row landed in the DB via a real
    // platform-admin-authenticated request, not just the UI's own claim.
    const loginRes = await fetch(`${apiBaseUrl}/platform/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PLATFORM_ADMIN),
    });
    const { data: loginData } = (await loginRes.json()) as { data: { token: string } };
    const listRes = await fetch(`${apiBaseUrl}/platform/tenant-requests?page=1&pageSize=50`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const { data: requests } = (await listRes.json()) as {
      data: Array<{ requestedSlug: string; status: string }>;
    };
    expect(requests.some((r) => r.requestedSlug === uniqueSlug && r.status === "pending")).toBe(true);
  });

  it("logs a platform admin in, lands on the tenant-requests shell, and logs out back to /platform/login", async () => {
    const store = await loginAsPlatformAdmin();

    renderAppAt("/platform/tenant-requests", store);

    await screen.findByRole("heading", { name: /tenant requests/i });
    const header = screen.getByRole("banner");
    expect(header.querySelector(".MuiTypography-body2")?.textContent).toMatch(/platform admin/i);
    const tenantRequestsLink = screen.getByRole("link", { name: /tenant requests/i });
    const tenantsLink = screen.getByRole("link", { name: /^tenants$/i });
    expect(tenantRequestsLink).toBeInTheDocument();
    expect(tenantsLink).toBeInTheDocument();
    expect(tenantRequestsLink.className).toMatch(/activeList/);
    expect(tenantsLink.className).not.toMatch(/activeList/);

    const user = userEvent.setup();
    await user.click(tenantsLink);
    await screen.findByRole("heading", { name: /^tenants$/i });
    expect(tenantsLink.className).toMatch(/activeList/);
    expect(tenantRequestsLink.className).not.toMatch(/activeList/);

    await user.click(within(header).getByLabelText(/logout/i));

    await screen.findByRole("heading", { name: /platform admin login/i });
    expect(store.getState().auth.token).toBeNull();
  });

  it("redirects an already-authenticated platform-admin visit to /platform/login away from the login form", async () => {
    const store = await loginAsPlatformAdmin();

    renderAppAt("/platform/login", store);

    await screen.findByRole("heading", { name: /tenant requests/i });
    expect(screen.queryByRole("heading", { name: /platform admin login/i })).not.toBeInTheDocument();
  });

  it("redirects a staff (user) session visiting /platform/tenant-requests to /dashboard", async () => {
    const store = await loginAsStaff(SEED_ADMIN);

    renderAppAt("/platform/tenant-requests", store);

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(screen.queryByRole("heading", { name: /tenant requests/i })).not.toBeInTheDocument();
  });

  it("redirects a platform-admin session visiting a staff route (/orders) to the platform panel, not into the staff app", async () => {
    const store = await loginAsPlatformAdmin();

    renderAppAt("/orders", store);

    await screen.findByRole("heading", { name: /tenant requests/i });
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
  });

  it("redirects a platform-admin session visiting the tailor portal to the platform panel, not into the tailor portal", async () => {
    const store = await loginAsPlatformAdmin();

    renderAppAt("/tailor/jobs", store);

    await screen.findByRole("heading", { name: /tenant requests/i });
  });
});
