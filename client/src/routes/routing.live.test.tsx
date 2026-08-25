import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { baseApi } from "../api/baseApi";
import authReducer, { AUTH_TOKEN_STORAGE_KEY, readStoredToken } from "../features/auth/authSlice";
import { AuthSessionProvider } from "../app/AuthSessionProvider";
import { AppRoutes } from "./AppRoutes";
import { createTenantWithLimitedUser, isDatabaseReachable } from "./testSupport/permissionFixtures";

/**
 * Integration tests against a real, running `siam/server` (+ a real
 * Postgres it talks to, for the permission-gating fixtures), mirroring the
 * pattern established by `src/api/baseApi.live.test.ts` and
 * `src/features/auth/auth.live.test.tsx`: exercise the real routing/guard
 * wiring end to end rather than mocking the API. Skips itself (rather than
 * failing `npm test`) if the server or database isn't reachable.
 */

const SEED_ADMIN = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

/**
 * The real seeded Retailer role's exact 7-key permission bundle
 * (`server/src/db/seed/index.ts`'s `retailerPermissionKeys`, Workstream E
 * Group 3) — module-scoped so both the Group 4 catalog-lockdown tests and
 * the Group 6 edit-wizard-route test below share the identical bundle,
 * rather than each hand-picking its own list that could silently drift out
 * of sync with the real seed.
 */
const RETAILER_PERMISSION_KEYS = [
  "customers.manage",
  "orders.create",
  "orders.view",
  "orders.repeat",
  "orders.group.create",
  "invoices.view",
  "shipping.view",
];

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

async function fetchAdminToken(): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SEED_ADMIN),
  });
  const body = (await res.json()) as { data: { token: string } };
  return body.data.token;
}

/**
 * Mirrors `src/app/store.ts`'s real `preloadedState` wiring (read
 * `localStorage` synchronously at store-creation time, not in a mount
 * effect) — see `authSlice.ts`'s `readStoredToken` doc comment. Without
 * this, these tests wouldn't reproduce the deep-link race the "restores a
 * persisted session" test below guards against.
 */
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
  const rendered = renderAppAt("/dashboard", store);
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

  rendered.unmount();
  return store;
}

afterEach(() => {
  window.localStorage.clear();
});

describe.skipIf(!serverUp)("Routing & permission guards (live siam/server integration)", () => {
  it("redirects an unauthenticated visit to a protected route to /login", async () => {
    renderAppAt("/dashboard", buildTestStore());
    await screen.findByRole("heading", { name: /login/i });
  });

  it("deep-links straight to a permission-gated route on a restored session, without bouncing through /dashboard", async () => {
    const token = await fetchAdminToken();
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);

    renderAppAt("/retailers", buildTestStore());

    await screen.findByRole("heading", { name: "Retailers" });
  });

  it("lets an authenticated user reach the RequireAuth-only placeholder", async () => {
    const store = await loginAs(SEED_ADMIN);
    expect(store.getState().auth.token).toBeTruthy();
  });

  it("redirects an already-authenticated visit to /login away from the login form", async () => {
    const store = await loginAs(SEED_ADMIN);

    renderAppAt("/login", store);

    await waitFor(() => {
      // Scoped to the header — see `loginAs`'s identical comment above on why an unscoped
      // lookup now collides with the sidebar's "Admin" nav-group label.
      const header = screen.getByRole("banner");
      expect(within(header).getByText(new RegExp(SEED_ADMIN.username, "i"))).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /login/i })).not.toBeInTheDocument();
  });

  it("lets the seeded admin (all 28 permissions) reach the Retailers admin screen", async () => {
    const store = await loginAs(SEED_ADMIN);

    renderAppAt("/retailers", store);

    await screen.findByRole("heading", { name: "Retailers" });
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
  });

  describe.skipIf(!dbUp)("permission gating for a limited-permission user", () => {
    it(
      "blocks a user without the required permission from the Retailers admin screen",
      async () => {
        const fixture = await createTenantWithLimitedUser(["orders.view"]);
        try {
          const store = await loginAs(fixture);

          renderAppAt("/retailers", store);

          await screen.findByText(/do not have permission/i);
          expect(screen.queryByRole("heading", { name: "Retailers" })).not.toBeInTheDocument();
        } finally {
          await fixture.cleanup();
        }
      },
      15000
    );
  });

  /**
   * PHASE_10_TASKS.md Workstream E Group 4: catalog admin route lockdown.
   * Uses the real seeded "Retailer" role's exact 7-key permission bundle
   * (`server/src/db/seed/index.ts`'s `retailerPermissionKeys`, Workstream E
   * Group 3) rather than a hand-picked list, so this test fails if that
   * bundle ever drifts to accidentally include a `catalog.*.manage`/
   * `factory.*.manage` key. Confirms both halves of Decision 4: a
   * retailer-scoped session is denied every catalog/factory admin route
   * (even though the underlying GET endpoints themselves stay open
   * server-side, see AppRoutes.tsx's doc comments on each route below), AND
   * that same session's actual job — building an order — still works
   * end-to-end through the identical underlying product/feature reads.
   */
  describe.skipIf(!dbUp)("Workstream E Group 4: catalog admin route lockdown for a Retailer-role session", () => {
    const LOCKED_ROUTES = [
      "/catalog/products",
      "/catalog/processes",
      "/catalog/measurements",
      "/catalog/super-products",
      "/catalog/features",
      "/factory/tailors",
      "/factory/extra-payment-categories",
      "/factory/payroll",
    ];

    it.each(LOCKED_ROUTES)(
      "blocks a Retailer-role session from %s",
      async (path) => {
        const fixture = await createTenantWithLimitedUser(RETAILER_PERMISSION_KEYS);
        try {
          const store = await loginAs(fixture);

          renderAppAt(path, store);

          await screen.findByText(/do not have permission/i);
        } finally {
          await fixture.cleanup();
        }
      },
      15000
    );

    it(
      "still lets that same Retailer-role session load the order builder, reading the identical underlying product/feature data",
      async () => {
        const fixture = await createTenantWithLimitedUser(RETAILER_PERMISSION_KEYS);
        try {
          const store = await loginAs(fixture);

          renderAppAt("/orders/new", store);

          // Scoped to the heading role — the sidebar's own "New Order" nav
          // link renders the identical text, so an unscoped lookup collides.
          await screen.findByRole("heading", { name: "New Order" });
          expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
        } finally {
          await fixture.cleanup();
        }
      },
      15000
    );
  });

  /**
   * PHASE_10_TASKS.md Workstream E Group 5: `admin` (Owner) no longer holds
   * `orders.create` (`server/src/db/seed/index.ts`'s `ownerExcludedPermissionKeys`)
   * — Owner can still view/list orders, but only a Retailer-role (or any
   * role explicitly granted `orders.create`) session can reach the
   * order-builder wizard. Confirms both halves against the real seeded
   * `admin` account and a real fixture, not just the route config in
   * isolation.
   */
  describe.skipIf(!dbUp)("Workstream E Group 5: order creation moved to retailer-only", () => {
    it("blocks the seeded admin (Owner) session from /orders/new", async () => {
      const store = await loginAs(SEED_ADMIN);

      renderAppAt("/orders/new", store);

      await screen.findByText(/do not have permission/i);
      expect(screen.queryByRole("heading", { name: "New Order" })).not.toBeInTheDocument();
    });

    it(
      "lets a fixture session holding orders.create reach /orders/new",
      async () => {
        const fixture = await createTenantWithLimitedUser(["orders.create"]);
        try {
          const store = await loginAs(fixture);

          renderAppAt("/orders/new", store);

          await screen.findByRole("heading", { name: "New Order" });
          expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
        } finally {
          await fixture.cleanup();
        }
      },
      15000
    );
  });

  /**
   * PHASE_10_TASKS.md Workstream E Group 6.3d — the edit-wizard route
   * (`/orders/:id/edit`, `OrderBuilderPage.tsx` re-hosted in edit mode) is
   * gated on `orders.edit`, not `orders.view`/`orders.create` — same
   * `RequirePermission` mechanism as every other route in this file, checked
   * before `OrderBuilderPage` even mounts (so it never actually needs a real
   * order id to prove the gate itself; a syntactically-valid but nonexistent
   * uuid is enough — `OrderBuilderPage`'s own `GET /orders/:id` failing
   * afterward, for the positive case, is a separate, already-covered concern,
   * see `orders.edit.routes.test.ts`/`OrderEditWizard.live.test.tsx`).
   */
  describe.skipIf(!dbUp)("Workstream E Group 6: order edit-wizard route gated on orders.edit", () => {
    const NONEXISTENT_ORDER_ID = "00000000-0000-4000-8000-000000000000";

    it("blocks a Retailer-role session from /orders/:id/edit", async () => {
      const fixture = await createTenantWithLimitedUser(RETAILER_PERMISSION_KEYS);
      try {
        const store = await loginAs(fixture);

        renderAppAt(`/orders/${NONEXISTENT_ORDER_ID}/edit`, store);

        await screen.findByText(/do not have permission/i);
      } finally {
        await fixture.cleanup();
      }
    });

    it("lets the seeded admin (Owner, who holds orders.edit post-Group-5) reach /orders/:id/edit", async () => {
      const store = await loginAs(SEED_ADMIN);

      renderAppAt(`/orders/${NONEXISTENT_ORDER_ID}/edit`, store);

      // Not blocked by RequirePermission — the route itself is granted; the
      // nonexistent order id then surfaces as this page's own load error
      // (the server's real "Order ... not found" message, relayed via
      // `getApiErrorMessage`), not a permission warning.
      await screen.findByText(/Edit Order|not found/i);
      expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
    });
  });
});
