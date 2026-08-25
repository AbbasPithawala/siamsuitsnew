import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { OrderListPage } from "./OrderListPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `CustomersPage.live.test.tsx`'s/`OrderBuilderPage.live.test.tsx`'s
 * pattern. Covers PHASE_6_TASKS.md Group 6's order list: filterable by
 * retailer/customer/status, showing the manufacturing progress rollup
 * (`manufacturingStepsTotal`/`manufacturingStepsComplete`, a small additive
 * aggregate query Group 6 added to `listOrders`), and row-click navigation
 * to the detail route.
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

function DetailStub() {
  const { id } = useParams<{ id: string }>();
  return <div>Navigated to order detail {id}</div>;
}

function renderOrderList() {
  return render(
    <Provider store={buildTestStore()}>
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
    "lists a real order filterable by retailer, showing customer/retailer/status and the manufacturing progress rollup, and navigates to its detail on click",
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
      expect(within(row).getByText(retailer.name)).toBeInTheDocument();
      expect(within(row).getByText("New Order")).toBeInTheDocument();
      expect(within(row).getByText(/steps complete|No manufacturing steps/)).toBeInTheDocument();

      // Status filter: an unmatched status hides the fixture's row.
      const statusField = screen.getByLabelText("Filter by status");
      await user.type(statusField, "Nonexistent Status XYZ");
      await waitFor(() => expect(screen.queryByText(order.orderNumber)).not.toBeInTheDocument(), NETWORK_WAIT);
      await user.clear(statusField);
      await screen.findByText(order.orderNumber, {}, NETWORK_WAIT);

      await user.click(screen.getByText(order.orderNumber));
      await screen.findByText(`Navigated to order detail ${order.id}`);
    },
    30000
  );
});
