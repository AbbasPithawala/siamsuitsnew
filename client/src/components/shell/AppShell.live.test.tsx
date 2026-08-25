import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import authReducer, { AUTH_TOKEN_STORAGE_KEY, readStoredToken } from "../../features/auth/authSlice";
import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { AppRoutes } from "../../routes/AppRoutes";
import { createTenantWithLimitedUser, isDatabaseReachable } from "../../routes/testSupport/permissionFixtures";

/**
 * Integration tests against a real, running `siam/server` (+ Postgres for
 * the permission fixture), mirroring `src/routes/routing.live.test.tsx`'s
 * pattern: exercise the real shell (header + sidebar + outlet) end to end
 * rather than mocking `me`. Skips itself if the server/database isn't up.
 */

const SEED_ADMIN = {
  tenant: "siam-suits",
  username: "admin",
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

const [serverUp, dbUp] = await Promise.all([isServerReachable(), isDatabaseReachable()]);

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

async function loginAs(credentials: { tenant: string; username: string; password: string }) {
  const store = buildTestStore();
  renderAppAt("/dashboard", store);
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/tenant/i), credentials.tenant);
  await user.type(screen.getByLabelText(/username/i), credentials.username);
  await user.type(screen.getByLabelText(/password/i), credentials.password);
  await user.click(screen.getByRole("button", { name: /login/i }));

  await waitFor(() => expect(store.getState().auth.token).toBeTruthy());
  await waitFor(() => {
    // Scoped to the header, not a bare `screen.getByText` — PHASE_8_TASKS.md's sidebar
    // regrouping introduced a real "Admin" nav-group label, which now collides with the
    // seeded admin user's own displayed name ("Admin (admin)") for an unscoped lookup.
    const header = screen.getByRole("banner");
    expect(within(header).getByText(new RegExp(credentials.username, "i"))).toBeInTheDocument();
  });

  return { store, user };
}

/**
 * A nav entry's `<a>`, found by its real `href` rather than by accessible
 * name/role — MUI's Collapse hides a non-expanded accordion's content in a
 * way that makes its descendants' *computed accessible name* come back empty
 * (confirmed via a live failure: `getByRole("link", { name, hidden: true })`
 * finds the element but reports `Name ""`), even though the element itself
 * is genuinely present in the DOM. `href` doesn't depend on that computation.
 */
function getNavLinkByHref(container: HTMLElement, href: string): HTMLAnchorElement {
  const link = container.querySelector(`a[href="${href}"]`);
  if (!link) throw new Error(`No nav link found for href="${href}"`);
  return link as HTMLAnchorElement;
}

afterEach(() => {
  window.localStorage.clear();
});

describe.skipIf(!serverUp)("AppShell (live siam/server integration)", () => {
  it("shows both nav entries for the seeded admin (all 28 permissions)", async () => {
    await loginAs(SEED_ADMIN);

    const nav = screen.getByRole("navigation");
    expect(getNavLinkByHref(nav, "/dashboard")).toBeInTheDocument();
    expect(getNavLinkByHref(nav, "/retailers")).toBeInTheDocument();
  });

  it("marks the current route's nav entry active and updates on navigation", async () => {
    const { user } = await loginAs(SEED_ADMIN);
    const nav = screen.getByRole("navigation");

    // Login now lands on /orders (not /dashboard) — that group's accordion is
    // the one auto-expanded, so "Orders" is the real initially-active entry.
    // "Retailers" lives in the still-collapsed "Admin" group, so its own
    // accordion header needs a real click to expand before its link is
    // interactable — MUI's Collapse genuinely isn't clickable at height 0.
    const ordersLink = getNavLinkByHref(nav, "/orders");
    expect(ordersLink).toHaveAttribute("aria-current", "page");
    expect(getNavLinkByHref(nav, "/retailers")).not.toHaveAttribute("aria-current");

    await user.click(within(nav).getByRole("button", { name: "Admin" }));
    await user.click(getNavLinkByHref(nav, "/retailers"));

    await screen.findByRole("heading", { name: "Retailers" });
    expect(getNavLinkByHref(nav, "/retailers")).toHaveAttribute("aria-current", "page");
    expect(getNavLinkByHref(nav, "/orders")).not.toHaveAttribute("aria-current");
  });

  it("logs out from the header's real logout button, clearing the session and redirecting to /login", async () => {
    const { store, user } = await loginAs(SEED_ADMIN);

    await user.click(screen.getByRole("button", { name: /logout/i }));

    await screen.findByRole("heading", { name: /login/i });
    expect(store.getState().auth.token).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  describe.skipIf(!dbUp)("permission-driven nav filtering", () => {
    it(
      "hides a nav entry the logged-in user's permissions don't grant",
      async () => {
        const fixture = await createTenantWithLimitedUser(["orders.view"]);
        try {
          await loginAs(fixture);

          const nav = screen.getByRole("navigation");
          expect(getNavLinkByHref(nav, "/dashboard")).toBeInTheDocument();
          expect(nav.querySelector('a[href="/retailers"]')).not.toBeInTheDocument();
        } finally {
          await fixture.cleanup();
        }
      },
      15000
    );
  });
});
