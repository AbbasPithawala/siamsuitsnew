import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { OrderBuilderPage } from "./OrderBuilderPage";
import { OrderDetailPage } from "./OrderDetailPage";
import { hardDeleteOrders, countOrdersByIds } from "./testSupport/orderDbCleanup";

/**
 * `html-to-image`'s `toPng` pipeline (clone the DOM node to an SVG
 * `<foreignObject>`, decode it via a real `Image`, draw it onto a `<canvas>`)
 * depends on browser APIs jsdom does not implement (`SVGImageElement`, a real
 * 2D canvas context) — confirmed empirically: an unmocked call throws
 * `ReferenceError: SVGImageElement is not defined` in this exact test
 * environment (`vite.config.ts`'s `environment: "jsdom"`, no `canvas` npm
 * polyfill in `package.json`). Mocking only this one function keeps
 * everything downstream of it real: the mocked data URL is converted to a
 * real `Blob`/`File` (via this environment's real `fetch`, which does
 * support `data:` URLs) and uploaded through the real, running
 * `POST /api/uploads`, so this test still proves the actual upload
 * integration end to end — only the purely-cosmetic client-side compositing
 * step (real Canvas 2D rendering, not this codebase's logic) is stubbed.
 */
const FIXED_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
vi.mock("html-to-image", () => ({ toPng: vi.fn(async () => FIXED_PNG_DATA_URL) }));

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `OrderBuilderPage.live.test.tsx`'s/`OrderDetailPage.live.test.tsx`'s
 * pattern. Covers PHASE_10_TASKS.md Workstream E Group 6.3/6.4: the admin
 * edit-wizard (`OrderBuilderPage.tsx`'s `isEditMode`), the Manual Size
 * annotation editor's real rasterize-(mocked)-and-upload-(real) flow, and
 * `OrderDetailPage.tsx`'s edit-surface entry points being permission-gated.
 *
 * Fixtures: a throwaway product (with `measurementDiagramImage` set, so the
 * Manual Size editor has something to render), process, measurement
 * definition, a 1-component super product, a throwaway retailer/customer —
 * all created via raw `fetch` against the real API and torn down in
 * `afterAll`. The initial order (2 physical units sharing one line item, per
 * Decision 3) is created via a fixture token holding only `orders.create`
 * (Workstream E Group 5: the seeded `admin`/Owner account no longer holds
 * it) — the edit itself, and every `OrderDetailPage` action this file
 * exercises, runs under `admin`'s own token, which DOES hold `orders.edit`
 * (Group 5's whole point: Owner keeps everything except `orders.create`).
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function fetchToken(credentials: { tenant: string; username: string; password: string }): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { token: string } };
    return body.data.token;
  } catch {
    return null;
  }
}

const seededToken = await fetchToken(SEED_CREDENTIALS);

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

const orderCreatorFixture = seededToken ? await createLimitedUserInTenant("siam-suits", ["orders.create"]) : null;
const orderCreatorToken = orderCreatorFixture ? await fetchToken(orderCreatorFixture) : null;

/** PHASE_10_TASKS.md Workstream E Group 6.3d — a real session holding `orders.view` but not `orders.edit`, for the "no edit entry point rendered" assertion. */
const viewOnlyFixture = seededToken ? await createLimitedUserInTenant("siam-suits", ["orders.view"]) : null;
const viewOnlyToken = viewOnlyFixture ? await fetchToken(viewOnlyFixture) : null;

function buildTestStore(token: string | null): EnhancedStore {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token }) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function renderEditWizard(orderId: string, token: string | null) {
  const store = buildTestStore(token);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/orders/${orderId}/edit`]}>
        <Routes>
          <Route path="/orders/:id/edit" element={<OrderBuilderPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

function renderDetail(orderId: string, token: string | null) {
  return render(
    <Provider store={buildTestStore(token)}>
      <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdOrderIds: string[] = [];
const createdSuperProductIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdRetailerIds: string[] = [];
const createdProductIds: string[] = [];
const createdProcessIds: string[] = [];
const createdMeasurementDefinitionIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

  if (orderCreatorFixture) {
    await orderCreatorFixture.cleanup().catch((err: unknown) => console.error("Failed to clean up the orders.create fixture user:", err));
  }
  if (viewOnlyFixture) {
    await viewOnlyFixture.cleanup().catch((err: unknown) => console.error("Failed to clean up the orders.view-only fixture user:", err));
  }

  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));

  for (const id of createdSuperProductIds) {
    await apiRequest(`/super-products/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete super product fixture ${id}:`, err)
    );
  }
  for (const id of createdCustomerIds) {
    await apiRequest(`/customers/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete customer fixture ${id}:`, err)
    );
  }
  for (const id of createdRetailerIds) {
    await apiRequest(`/retailers/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete retailer fixture ${id}:`, err)
    );
  }
  for (const id of createdProductIds) {
    await apiRequest(`/products/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete product fixture ${id}:`, err)
    );
  }
  for (const id of createdProcessIds) {
    await apiRequest(`/processes/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete process fixture ${id}:`, err)
    );
  }
  for (const id of createdMeasurementDefinitionIds) {
    await apiRequest(`/measurement-definitions/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete measurement definition fixture ${id}:`, err)
    );
  }

  const remaining = await countOrdersByIds(createdOrderIds);
  expect(remaining).toBe(0);
});

interface OrderApiComponent {
  id: string;
  slotLabel: string;
  stylingNote: string | null;
  manualSizeImage: string | null;
  measurements: { measurementDefinitionId: string; totalValue: string }[];
}
interface OrderApiItem {
  id: string;
  components: OrderApiComponent[];
}
interface OrderApiDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  items: OrderApiItem[];
}

describe.skipIf(!seededToken)("Order edit wizard + Manual Size (live siam/server integration)", () => {
  it(
    "an admin edits a real order's shared measurements, one unit's styling, adds a new unit, and sets a Manual Size annotation — all changes land, siblings share the denormalized fields, and the customer's measurement profile reflects the edit",
    async () => {
      const token = seededToken as string;
      if (!orderCreatorToken) throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Edit Wizard Process ${suffix}` }),
      });
      createdProcessIds.push(process.data.id);

      const productName = `Live Edit Wizard Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName, measurementDiagramImage: "https://example.com/diagram.png" }),
      });
      createdProductIds.push(product.data.id);
      await apiRequest(`/products/${product.data.id}/processes`, token, {
        method: "PUT",
        body: JSON.stringify({ processIds: [process.data.id] }),
      });

      const measurementDefName = `Live Edit Wizard Measurement ${suffix}`;
      const measurementDef = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: measurementDefName, slug: `live-edit-wizard-${suffix}` }),
      });
      createdMeasurementDefinitionIds.push(measurementDef.data.id);
      await apiRequest(`/products/${product.data.id}/measurements`, token, {
        method: "PUT",
        body: JSON.stringify({ measurementDefinitionIds: [measurementDef.data.id] }),
      });

      const superProductName = `Live Edit Wizard Super Product ${suffix}`;
      const superProduct = await apiRequest<{ data: { id: string; components: { id: string; slotLabel: string }[] } }>(
        "/super-products",
        token,
        { method: "POST", body: JSON.stringify({ name: superProductName, components: [{ productId: product.data.id, slotLabel: "Piece" }] }) }
      );
      createdSuperProductIds.push(superProduct.data.id);
      const component = superProduct.data.components[0]!;

      const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Edit Wizard Retailer ${suffix}`, code: `LEW-${suffix}`.toUpperCase() }),
      });
      createdRetailerIds.push(retailer.data.id);

      const customerFirstName = `LiveEditWizardCust-${suffix}`;
      const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
        method: "POST",
        body: JSON.stringify({ retailerId: retailer.data.id, firstName: customerFirstName }),
      });
      createdCustomerIds.push(customer.data.id);

      const order = await apiRequest<{ data: OrderApiDetail }>("/orders", orderCreatorToken, {
        method: "POST",
        body: JSON.stringify({
          retailerId: retailer.data.id,
          customerId: customer.data.id,
          items: [
            {
              superProductId: superProduct.data.id,
              components: [
                { superProductComponentId: component.id, measurements: [{ measurementDefinitionId: measurementDef.data.id, value: "36" }], stylingNote: "unit 1 original" },
              ],
            },
            {
              superProductId: superProduct.data.id,
              components: [
                { superProductComponentId: component.id, measurements: [{ measurementDefinitionId: measurementDef.data.id, value: "36" }], stylingNote: "unit 2 original" },
              ],
            },
          ],
        }),
      });
      createdOrderIds.push(order.data.id);
      expect(order.data.items).toHaveLength(2);
      const originalItemIds = order.data.items.map((item) => item.id).sort();

      const user = userEvent.setup();
      renderEditWizard(order.data.id, token);

      await screen.findByRole("heading", { name: `Edit Order ${order.data.orderNumber}` }, NETWORK_WAIT);

      const row = await screen.findByTestId(`line-item-row-${superProduct.data.id}`, {}, NETWORK_WAIT);
      expect(within(row).getByText(superProductName.toUpperCase())).toBeInTheDocument();

      // Edit the shared measurement value — Decision 3 means this applies to
      // every sibling unit's component at submit time, not just one.
      await user.click(within(row).getByTestId("measurement-status"));
      const valueInput = (await screen.findByLabelText(new RegExp(`^${measurementDefName} value`), {}, NETWORK_WAIT)) as HTMLInputElement;
      await user.clear(valueInput);
      await user.type(valueInput, "42");
      await screen.findByDisplayValue("42", {}, NETWORK_WAIT);

      // Manual Size is deliberately NOT exercised in this comprehensive
      // flow — see the dedicated "Manual Size" test below and its doc
      // comment on the real, disclosed `POST /api/uploads` permission gap
      // (`orders.create`-gated) that blocks it for this exact session
      // (`admin`/Owner, who holds `orders.edit` but not `orders.create`
      // post-Group-5). Covering it here under the real `admin` token would
      // just reproduce that 403, not prove this flow's other steps.

      // Edit unit 2's own (per-unit, non-shared) styling note.
      await user.click(within(row).getByTestId("styling-status"));
      await screen.findByRole("button", { name: /Item 2/ }, NETWORK_WAIT);
      const noteFields = await screen.findAllByPlaceholderText("Special note (if any)", {}, NETWORK_WAIT);
      expect(noteFields).toHaveLength(2);
      await user.clear(noteFields[1]!);
      await user.type(noteFields[1]!, "unit 2 edited");

      // Add a brand-new third unit to this same line item.
      await user.click(within(row).getByRole("button", { name: "+" }));
      expect(within(row).getByText("3")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await screen.findByRole("heading", { name: `Order ${order.data.orderNumber}` }, NETWORK_WAIT);

      const refetched = await apiRequest<{ data: OrderApiDetail }>(`/orders/${order.data.id}`, token);
      expect(refetched.data.items).toHaveLength(3);

      const refetchedItemIds = refetched.data.items.map((item) => item.id).sort();
      for (const originalId of originalItemIds) {
        expect(refetchedItemIds).toContain(originalId);
      }

      const components = refetched.data.items.map((item) => item.components[0]!);
      expect(components).toHaveLength(3);
      // Shared measurement — every sibling, including the brand-new unit, reflects the edit.
      expect(components.every((c) => c.measurements[0]?.totalValue === "42.00" || c.measurements[0]?.totalValue === "42")).toBe(true);

      // Per-unit styling notes: unit 1 unchanged, unit 2 edited, unit 3 (new) blank.
      const stylingNotes = components.map((c) => c.stylingNote).sort();
      expect(stylingNotes).toEqual([null, "unit 1 original", "unit 2 edited"].sort());

      const profile = await apiRequest<{ data: { values: { measurementDefinitionId: string; value: string }[] } }>(
        `/customers/${customer.data.id}/measurement-profiles/${product.data.id}`,
        token
      );
      expect(profile.data.values.find((v) => v.measurementDefinitionId === measurementDef.data.id)?.value).toBe("42.00");
    },
    60000
  );

  /**
   * A real backend gap was found while originally writing this test: `POST
   * /api/uploads` (`server/src/routes/uploads.routes.ts`) was gated on
   * `orders.create` alone — a Phase 9 assumption ("matching the only real
   * caller this phase has", per that route's own doc comment) left stale by
   * Phase 10 Workstream E Group 5's redesign, where the seeded Retailer role
   * holds `orders.create` but Owner/Admin holds `orders.edit` instead. Any
   * upload triggered from the edit wizard by an `orders.edit`-only session —
   * this Manual Size editor, or `StylingAccordion`'s reference-image upload,
   * whenever either is reached via `/orders/:id/edit` — 403'd with "Missing
   * required permission: orders.create". **Fixed** (`uploadsRouter.post("/uploads", ...)`
   * now accepts `["orders.create", "orders.edit"]`) — the real admin session
   * below (holding only `orders.edit`, no `orders.create`) completes the
   * Manual Size flow end-to-end against the real upload endpoint with no
   * workaround needed.
   */
  it("Manual Size: the real admin (orders.edit-only) session completes the flow end-to-end against the real upload endpoint", async () => {
    const token = seededToken as string;
    if (!orderCreatorToken) throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const productName = `Live Manual Size Product ${suffix}`;
    const product = await apiRequest<{ data: { id: string } }>("/products", token, {
      method: "POST",
      body: JSON.stringify({ name: productName, measurementDiagramImage: "https://example.com/diagram.png" }),
    });
    createdProductIds.push(product.data.id);

    const superProductName = `Live Manual Size Super Product ${suffix}`;
    const superProduct = await apiRequest<{ data: { id: string; components: { id: string }[] } }>("/super-products", token, {
      method: "POST",
      body: JSON.stringify({ name: superProductName, components: [{ productId: product.data.id, slotLabel: "Piece" }] }),
    });
    createdSuperProductIds.push(superProduct.data.id);

    const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
      method: "POST",
      body: JSON.stringify({ name: `Live Manual Size Retailer ${suffix}`, code: `LMS-${suffix}`.toUpperCase() }),
    });
    createdRetailerIds.push(retailer.data.id);
    const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
      method: "POST",
      body: JSON.stringify({ retailerId: retailer.data.id, firstName: `LiveManualSizeCust-${suffix}` }),
    });
    createdCustomerIds.push(customer.data.id);

    const order = await apiRequest<{ data: OrderApiDetail }>("/orders", orderCreatorToken, {
      method: "POST",
      body: JSON.stringify({
        retailerId: retailer.data.id,
        customerId: customer.data.id,
        items: [{ superProductId: superProduct.data.id, components: [{ superProductComponentId: superProduct.data.components[0]!.id }] }],
      }),
    });
    createdOrderIds.push(order.data.id);

    async function openManualSizeAndSave(user: ReturnType<typeof userEvent.setup>) {
      const row = await screen.findByTestId(`line-item-row-${superProduct.data.id}`, {}, NETWORK_WAIT);
      await user.click(within(row).getByTestId("measurement-status"));
      await user.click(await screen.findByRole("button", { name: "Add Manual Size" }, NETWORK_WAIT));
      const labelInput = await screen.findByLabelText("Add label (number or text)", {}, NETWORK_WAIT);
      await user.type(labelInput, "40");
      await user.click(screen.getByRole("button", { name: "Add" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
    }

    // The real admin session (orders.edit, not orders.create) — proves the
    // upload gate's `orders.edit` alternate actually covers this real caller.
    const adminUser = userEvent.setup();
    renderEditWizard(order.data.id, token);
    await screen.findByRole("heading", { name: `Edit Order ${order.data.orderNumber}` }, NETWORK_WAIT);
    await openManualSizeAndSave(adminUser);
    await screen.findByRole("button", { name: "Edit Manual Size" }, NETWORK_WAIT);

    await adminUser.click(screen.getByRole("button", { name: "Next" }));
    await adminUser.click(screen.getByRole("button", { name: "Save Changes" }));
    await screen.findByRole("heading", { name: `Order ${order.data.orderNumber}` }, NETWORK_WAIT);

    const refetched = await apiRequest<{ data: OrderApiDetail }>(`/orders/${order.data.id}`, token);
    const manualSizeImage = refetched.data.items[0]!.components[0]!.manualSizeImage;
    expect(manualSizeImage).toBeTruthy();
  }, 60000);

  it("OrderDetailPage exposes the edit surface only to a session holding orders.edit, not a orders.view-only session", async () => {
    const token = seededToken as string;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
      method: "POST",
      body: JSON.stringify({ name: `Live Edit Gate Retailer ${suffix}`, code: `LEG-${suffix}`.toUpperCase() }),
    });
    createdRetailerIds.push(retailer.data.id);

    const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
      method: "POST",
      body: JSON.stringify({ retailerId: retailer.data.id, firstName: `LiveEditGateCust-${suffix}` }),
    });
    createdCustomerIds.push(customer.data.id);

    const superProductName = `Live Edit Gate Super Product ${suffix}`;
    const listRes = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
    const anyProduct = listRes.data[0];
    if (!anyProduct) throw new Error("Expected at least one real product to exist for this fixture");
    const superProduct = await apiRequest<{ data: { id: string; components: { id: string }[] } }>("/super-products", token, {
      method: "POST",
      body: JSON.stringify({ name: superProductName, components: [{ productId: anyProduct.id, slotLabel: "Piece" }] }),
    });
    createdSuperProductIds.push(superProduct.data.id);

    if (!orderCreatorToken) throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
    const order = await apiRequest<{ data: OrderApiDetail }>("/orders", orderCreatorToken, {
      method: "POST",
      body: JSON.stringify({
        retailerId: retailer.data.id,
        customerId: customer.data.id,
        items: [{ superProductId: superProduct.data.id, components: [{ superProductComponentId: superProduct.data.components[0]!.id }] }],
      }),
    });
    createdOrderIds.push(order.data.id);

    const adminRender = renderDetail(order.data.id, token);
    await screen.findByRole("heading", { name: `Order ${order.data.orderNumber}` }, NETWORK_WAIT);
    expect(screen.getByRole("button", { name: "Edit Order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Modified" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reassign Retailer" })).toBeInTheDocument();
    adminRender.unmount();

    if (!viewOnlyToken) throw new Error("Expected an orders.view-only fixture token to have been minted for this file");
    renderDetail(order.data.id, viewOnlyToken);
    await screen.findByRole("heading", { name: `Order ${order.data.orderNumber}` }, NETWORK_WAIT);
    expect(screen.queryByRole("button", { name: "Edit Order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Modified" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reassign Retailer" })).not.toBeInTheDocument();
  });
});
