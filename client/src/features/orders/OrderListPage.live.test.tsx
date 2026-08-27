import { configureStore } from "@reduxjs/toolkit";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createLimitedUserInTenant, createRetailerLinkedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { OrderListPage } from "./OrderListPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `CustomersPage.live.test.tsx`'s/`OrderBuilderPage.live.test.tsx`'s
 * pattern. Covers PHASE_6_TASKS.md Group 6's order list: filterable by
 * retailer/customer/status, and row-click navigation to the detail route.
 *
 * The order fixture is placed via a direct `POST /orders` call rather than
 * through the wizard UI — `OrderBuilderPage.live.test.tsx` already proves
 * the wizard's own placement flow end to end; this file's job is the list
 * screen, so the fastest reliable way to get a real order row is the API
 * `OrderBuilderPage.tsx` itself calls.
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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

/**
 * PHASE_10_TASKS.md Workstream E Group 5: `admin` (Owner) no longer holds
 * `orders.create`, so `placeOrderFixture`'s one real `POST /orders` call
 * below needs a token that does. Minted once, in the same `siam-suits`
 * tenant as every other fixture here (not a fresh tenant — see
 * `createLimitedUserInTenant`'s own doc comment). Rendering `OrderListPage`
 * itself (`renderOrderList`, still `admin`'s token via `buildTestStore`) and
 * every other setup call is unaffected — `admin` still holds `orders.view`.
 */
const orderCreatorFixture = seededToken ? await createLimitedUserInTenant("siam-suits", ["orders.create"]) : null;
const orderCreatorToken = orderCreatorFixture ? await fetchToken(orderCreatorFixture) : null;

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

async function fetchShirtProductId(token: string): Promise<string> {
  const list = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
  const shirt = list.data.find((p) => p.name === "shirt");
  if (!shirt) throw new Error('Expected the real seeded catalog to include a "shirt" product');
  return shirt.id;
}

interface RetailerFixture {
  id: string;
  name: string;
  code: string;
}

async function createRetailerFixture(token: string): Promise<RetailerFixture> {
  const suffix = uniqueSuffix();
  const name = `Live Order List Retailer ${suffix}`;
  const code = `LOL-${suffix}`.toUpperCase();
  const created = await apiRequest<{ data: { id: string } }>("/retailers", token, {
    method: "POST",
    body: JSON.stringify({ name, code }),
  });
  return { id: created.data.id, name, code };
}

interface CustomerFixture {
  id: string;
  firstName: string;
}

async function createCustomerFixture(token: string, retailerId: string): Promise<CustomerFixture> {
  const suffix = uniqueSuffix();
  const firstName = `LiveOrderListCust-${suffix}`;
  const created = await apiRequest<{ data: { id: string } }>("/customers", token, {
    method: "POST",
    body: JSON.stringify({ retailerId, firstName }),
  });
  return { id: created.data.id, firstName };
}

interface SuperProductFixture {
  id: string;
  name: string;
  components: { id: string; slotLabel: string }[];
}

async function createSuperProductFixture(token: string, productId: string): Promise<SuperProductFixture> {
  const suffix = uniqueSuffix();
  const name = `Live Order List Product ${suffix}`;
  const created = await apiRequest<{ data: { id: string; components: { id: string; slotLabel: string }[] } }>(
    "/super-products",
    token,
    { method: "POST", body: JSON.stringify({ name, components: [{ productId, slotLabel: "Shirt" }] }) }
  );
  return { id: created.data.id, name, components: created.data.components };
}

interface OrderFixture {
  id: string;
  orderNumber: string;
}

async function placeOrderFixture(
  token: string,
  retailerId: string,
  customerId: string,
  superProductId: string,
  componentId: string
): Promise<OrderFixture> {
  const created = await apiRequest<{ data: { id: string; orderNumber: string } }>("/orders", token, {
    method: "POST",
    body: JSON.stringify({
      retailerId,
      customerId,
      items: [{ superProductId, components: [{ superProductComponentId: componentId }] }],
    }),
  });
  return created.data;
}

function buildTestStore(token: string | null = seededToken) {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token }) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function DetailStub() {
  const { id } = useParams<{ id: string }>();
  return <div>Navigated to order detail {id}</div>;
}

function renderOrderList(token: string | null = seededToken) {
  return render(
    <Provider store={buildTestStore(token)}>
      <MemoryRouter initialEntries={["/orders"]}>
        <Routes>
          <Route path="/orders" element={<OrderListPage />} />
          <Route path="/orders/:id" element={<DetailStub />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

async function selectInCombobox(labelText: string, optionName: string) {
  const combobox = screen.getByLabelText(new RegExp(`^${labelText}`, "i"));
  await userEvent.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: optionName }));
  await waitForNoOpenListbox();
}

const NETWORK_WAIT = { timeout: 10000 };

const createdOrderIds: string[] = [];
const createdSuperProductIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdRetailerIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

  if (orderCreatorFixture) {
    await orderCreatorFixture.cleanup().catch((err: unknown) =>
      console.error("Failed to clean up the orders.create fixture user:", err)
    );
  }

  // There is no order DELETE endpoint (see `testSupport/orderDbCleanup.ts`'s
  // doc comment); soft-delete every other fixture through its real DELETE.
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

  const { hardDeleteOrders, countOrdersByIds } = await import("./testSupport/orderDbCleanup");
  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));
  const remaining = await countOrdersByIds(createdOrderIds);
  expect(remaining).toBe(0);
});

describe.skipIf(!seededToken)("OrderListPage (live siam/server integration)", () => {
  it(
    "lists a real order filterable by retailer, showing customer/status/quantity, and navigates to its detail on click",
    async () => {
      const token = seededToken as string;

      const shirtProductId = await fetchShirtProductId(token);
      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const customer = await createCustomerFixture(token, retailer.id);
      createdCustomerIds.push(customer.id);
      const superProduct = await createSuperProductFixture(token, shirtProductId);
      createdSuperProductIds.push(superProduct.id);
      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await placeOrderFixture(
        orderCreatorToken,
        retailer.id,
        customer.id,
        superProduct.id,
        superProduct.components[0]!.id
      );
      createdOrderIds.push(order.id);

      const user = userEvent.setup();
      renderOrderList();

      await screen.findByRole("heading", { name: "Orders" });

      // Scope to this fixture's retailer so the row we assert on isn't
      // ambiguous against other orders/tests sharing the same tenant.
      await selectInCombobox("Filter by retailer", retailer.name);

      const orderNumberCell = await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);
      const row = orderNumberCell.closest("tr") as HTMLElement;
      expect(row).not.toBeNull();
      // `findByText`, not `getByText`: the customer name comes from
      // `useListCustomersQuery`, a separate query that only starts once the
      // retailer filter is selected above — it can still be in flight the
      // instant the order row itself (from `useListOrdersQuery`) appears.
      await within(row).findByText(customer.firstName, {}, NETWORK_WAIT);
      expect(within(row).getByText("New Order")).toBeInTheDocument();
      // Quantity column: real physical units (order_item_components), not products —
      // this fixture's one super product has exactly one component, so itemCount is 1.
      expect(within(row).getByRole("cell", { name: "1" })).toBeInTheDocument();

      // Status tabs (PHASE_10_TASKS.md follow-up, legacy parity): a fresh order is "New Order",
      // so the "Modified" tab hides it and the "New Order" tab (or "All Orders") shows it again.
      await user.click(screen.getByRole("tab", { name: /^Modified/ }));
      await waitFor(() => expect(screen.queryByText(order.orderNumber)).not.toBeInTheDocument(), NETWORK_WAIT);
      await user.click(screen.getByRole("tab", { name: /^New Order/ }));
      await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);

      await user.click(screen.getByText(order.orderNumber));
      await screen.findByText(`Navigated to order detail ${order.id}`);
    },
    30000
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "View shows an error toast when no PDF exists yet, and a real Generate produces a fetchable PDF URL View can open",
    async () => {
      const token = seededToken as string;
      const shirtProductId = await fetchShirtProductId(token);
      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const customer = await createCustomerFixture(token, retailer.id);
      createdCustomerIds.push(customer.id);
      const superProduct = await createSuperProductFixture(token, shirtProductId);
      createdSuperProductIds.push(superProduct.id);
      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await placeOrderFixture(
        orderCreatorToken,
        retailer.id,
        customer.id,
        superProduct.id,
        superProduct.components[0]!.id
      );
      createdOrderIds.push(order.id);

      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const user = userEvent.setup();
      renderOrderList();

      await screen.findByRole("heading", { name: "Orders" });
      await selectInCombobox("Filter by retailer", retailer.name);

      const orderNumberCell = await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);
      const row = orderNumberCell.closest("tr") as HTMLElement;

      // No PDF generated yet — View must not silently no-op, it must surface a real error.
      await user.click(within(row).getByRole("button", { name: "View" }));
      await screen.findByText(/pdf doesn't exist yet.*please generate/i);
      expect(openSpy).not.toHaveBeenCalled();

      await user.click(within(row).getByRole("button", { name: "Generate" }));
      await waitFor(
        () => expect(within(row).getByRole("button", { name: "Generate" })).not.toBeDisabled(),
        { timeout: 20000 }
      );

      await user.click(within(row).getByRole("button", { name: "View" }));
      await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
      const [openedUrl] = openSpy.mock.calls[0] as [string];
      expect(openedUrl).toMatch(/\/uploads\/order-pdfs\/.+\.pdf$/);
    },
    30000
  );

  it(
    "an admin (orders.edit) session can change an order's status inline, moving it off the currently-selected status tab and updating both tab counts",
    async () => {
      const token = seededToken as string;
      const shirtProductId = await fetchShirtProductId(token);
      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const customer = await createCustomerFixture(token, retailer.id);
      createdCustomerIds.push(customer.id);
      const superProduct = await createSuperProductFixture(token, shirtProductId);
      createdSuperProductIds.push(superProduct.id);
      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await placeOrderFixture(
        orderCreatorToken,
        retailer.id,
        customer.id,
        superProduct.id,
        superProduct.components[0]!.id
      );
      createdOrderIds.push(order.id);

      const user = userEvent.setup();
      renderOrderList();

      await screen.findByRole("heading", { name: "Orders" });
      await selectInCombobox("Filter by retailer", retailer.name);

      // Pin the view to the "New Order" tab so a status change away from it is actually
      // observable as the row disappearing, not just its own cell value updating.
      await user.click(screen.getByRole("tab", { name: /^New Order/ }));
      await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);

      const beforeNewOrderTab = await screen.findByRole("tab", { name: /^New Order \(\d+\)/ });
      const beforeModifiedTab = await screen.findByRole("tab", { name: /^Modified \(\d+\)/ });
      const beforeNewOrderCount = Number(beforeNewOrderTab.textContent?.match(/\((\d+)\)/)?.[1]);
      const beforeModifiedCount = Number(beforeModifiedTab.textContent?.match(/\((\d+)\)/)?.[1]);

      const orderNumberCell = await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);
      const row = orderNumberCell.closest("tr") as HTMLElement;
      // No `InputLabel` on the per-row status `Select` (matching legacy's own bare
      // `<select>`), so it's found by role within the row rather than by label text.
      await user.click(within(row).getByRole("combobox"));
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: "Modified" }));
      await waitForNoOpenListbox();

      // Row moves out of the "New Order" tab it was pinned to.
      await waitFor(() => expect(screen.queryByText(order.orderNumber)).not.toBeInTheDocument(), NETWORK_WAIT);

      const afterNewOrderTab = await screen.findByRole("tab", { name: /^New Order \(\d+\)/ });
      const afterModifiedTab = await screen.findByRole("tab", { name: /^Modified \(\d+\)/ });
      expect(Number(afterNewOrderTab.textContent?.match(/\((\d+)\)/)?.[1])).toBe(beforeNewOrderCount - 1);
      expect(Number(afterModifiedTab.textContent?.match(/\((\d+)\)/)?.[1])).toBe(beforeModifiedCount + 1);

      // Row reappears under the "Modified" tab it was just moved to.
      await user.click(afterModifiedTab);
      await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);
    },
    30000
  );

  it(
    "a retailer-linked session (Retailer role, no orders.edit) hides the Retailer filter and the Status column stays a read-only chip, not an editable select",
    async () => {
      const token = seededToken as string;
      const shirtProductId = await fetchShirtProductId(token);
      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const customer = await createCustomerFixture(token, retailer.id);
      createdCustomerIds.push(customer.id);
      const superProduct = await createSuperProductFixture(token, shirtProductId);
      createdSuperProductIds.push(superProduct.id);
      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await placeOrderFixture(
        orderCreatorToken,
        retailer.id,
        customer.id,
        superProduct.id,
        superProduct.components[0]!.id
      );
      createdOrderIds.push(order.id);

      // Real Retailer-role identity: linked via `retailer_users` to this fixture's own
      // retailer, holding `orders.view` but deliberately not `orders.edit` (Retailer never
      // holds it — PHASE_10_TASKS.md Workstream E Group 5).
      const retailerUser = await createRetailerLinkedUserInTenant("siam-suits", retailer.id, ["orders.view"]);
      const retailerToken = await fetchToken({ tenant: "siam-suits", username: retailerUser.username, password: retailerUser.password });
      if (!retailerToken) throw new Error("Expected the retailer-linked fixture user to log in successfully");

      try {
        renderOrderList(retailerToken);

        await screen.findByRole("heading", { name: "Orders" });

        // This session's own order, auto-scoped server-side regardless of what the UI shows —
        // waiting for it also guarantees `useMeQuery` has resolved by the time the retailer
        // filter's absence is checked below (it renders unconditionally until `me` loads).
        const orderNumberCell = await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);
        const row = orderNumberCell.closest("tr") as HTMLElement;
        await waitFor(() => expect(screen.queryByLabelText(/^Filter by retailer/i)).not.toBeInTheDocument());
        expect(within(row).queryByText(retailer.name)).not.toBeInTheDocument();
        // Read-only chip, not a `<select>`/combobox — this session can't edit order status.
        expect(within(row).getByText("New Order")).toBeInTheDocument();
        expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
        // View/Generate/Quantity still apply to the retailer role exactly as they do for admin.
        expect(within(row).getByRole("button", { name: "View" })).toBeInTheDocument();
        expect(within(row).getByRole("button", { name: "Generate" })).toBeInTheDocument();
      } finally {
        await retailerUser.cleanup();
      }
    },
    30000
  );
});
