import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { OrderBuilderPage } from "./OrderBuilderPage";
import { OrderDetailPage } from "./OrderDetailPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `OrderBuilderPage.live.test.tsx`'s pattern. Covers
 * PHASE_6_TASKS.md Group 6's order detail screen: the full nested structure
 * (items -> components -> measurements/features/manufacturing steps),
 * "Generate PDF" (Group 3's real `POST /orders/:id/pdf`, which returns a
 * server-local file path, not a URL — see `ordersApi.ts`'s
 * `GenerateOrderPdfResult` doc comment), and "Repeat this order" (proving
 * `OrderBuilderPage.tsx` actually receives and pre-fills from
 * `?repeatOfOrderId=`, closing the gap Phase 5 Group 7 flagged).
 *
 * Fixtures include a throwaway process+product (linked via
 * `PUT /products/:id/processes`) and a throwaway measurement definition
 * (linked via `PUT /products/:id/measurements`) rather than reusing the real
 * shared jacket/pant/vest/shirt catalog — this test needs a *known*,
 * deterministic manufacturing-step count and a measurement field that
 * actually renders in the wizard's `<MeasurementForm>` on repeat, and
 * mutating the shared catalog's real process/measurement links would risk
 * other live test files that depend on their current (empty) state.
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
 * `orders.create`, so the one real `POST /orders` call below (fixture setup
 * for this file's own order-detail assertions) needs a token that does.
 * Minted once, in the same `siam-suits` tenant as every other fixture in
 * this file (not a fresh tenant — see `createLimitedUserInTenant`'s own doc
 * comment on why: the order references this file's own admin-created
 * retailer/customer/super-product, which a token scoped to an unrelated
 * tenant could never see). Every other setup call, and the page render
 * itself (`renderAt`, still `admin`'s token via `buildTestStore`), is
 * unaffected — `admin` still holds `orders.view`, which is all the rest of
 * this test needs.
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

function renderAt(orderId: string) {
  return render(
    <Provider store={buildTestStore()}>
      <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/orders/new" element={<OrderBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };
const PDF_WAIT = { timeout: 30000 };

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
    await orderCreatorFixture.cleanup().catch((err: unknown) =>
      console.error("Failed to clean up the orders.create fixture user:", err)
    );
  }

  const { hardDeleteOrders, countOrdersByIds } = await import("./testSupport/orderDbCleanup");
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

describe.skipIf(!seededToken)("OrderDetailPage (live siam/server integration)", () => {
  it(
    "renders a real order's full nested structure, generates a PDF, and repeats the order into a pre-filled wizard",
    async () => {
      const token = seededToken as string;
      const suffix = uniqueSuffix();
      const user = userEvent.setup();

      const processName = `Live Order Detail Process ${suffix}`;
      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processName }),
      });
      createdProcessIds.push(process.data.id);

      const productName = `Live Order Detail Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);

      await apiRequest(`/products/${product.data.id}/processes`, token, {
        method: "PUT",
        body: JSON.stringify({ processIds: [process.data.id] }),
      });

      const measurementDefName = `Live Order Detail Measurement ${suffix}`;
      const measurementDef = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: measurementDefName, slug: `live-order-detail-${suffix}` }),
      });
      createdMeasurementDefinitionIds.push(measurementDef.data.id);

      await apiRequest(`/products/${product.data.id}/measurements`, token, {
        method: "PUT",
        body: JSON.stringify({ measurementDefinitionIds: [measurementDef.data.id] }),
      });

      const superProductName = `Live Order Detail Super Product ${suffix}`;
      const superProduct = await apiRequest<{ data: { id: string; components: { id: string; slotLabel: string }[] } }>(
        "/super-products",
        token,
        { method: "POST", body: JSON.stringify({ name: superProductName, components: [{ productId: product.data.id, slotLabel: "Piece" }] }) }
      );
      createdSuperProductIds.push(superProduct.data.id);
      const component = superProduct.data.components[0]!;

      const retailerName = `Live Order Detail Retailer ${suffix}`;
      const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: retailerName, code: `LOD-${suffix}`.toUpperCase() }),
      });
      createdRetailerIds.push(retailer.data.id);

      const customerFirstName = `LiveOrderDetailCust-${suffix}`;
      const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
        method: "POST",
        body: JSON.stringify({ retailerId: retailer.data.id, firstName: customerFirstName }),
      });
      createdCustomerIds.push(customer.data.id);

      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await apiRequest<{ data: { id: string; orderNumber: string } }>("/orders", orderCreatorToken, {
        method: "POST",
        body: JSON.stringify({
          retailerId: retailer.data.id,
          customerId: customer.data.id,
          items: [
            {
              superProductId: superProduct.data.id,
              components: [
                {
                  superProductComponentId: component.id,
                  measurements: [{ measurementDefinitionId: measurementDef.data.id, value: "40" }],
                },
              ],
            },
          ],
        }),
      });
      createdOrderIds.push(order.data.id);

      renderAt(order.data.id);

      await screen.findByRole("heading", { name: `Order ${order.data.orderNumber}` }, NETWORK_WAIT);
      // `findByText`, not `getByText`: the retailer/customer names come from
      // `useListRetailersQuery`/`useListCustomersQuery`, independent queries
      // from the one gating the heading above (`useGetOrderQuery`) — they can
      // still be in flight (rendering "—") the instant the heading appears,
      // so asserting on them synchronously races those queries' resolution.
      await screen.findByText(new RegExp(`Retailer: ${retailerName}`), {}, NETWORK_WAIT);
      await screen.findByText(new RegExp(`Customer: ${customerFirstName}`), {}, NETWORK_WAIT);
      expect(screen.getByText("New Order")).toBeInTheDocument();

      // Scope to this fixture's own component section, not a bare
      // `screen.getByText` — the exact "N of M steps complete" and process
      // chip text this fixture produces is deterministic (one throwaway
      // process, one component) precisely so this assertion isn't fragile
      // against other tests' fixtures, but still scope defensively.
      const componentHeading = await screen.findByText(new RegExp(`^Piece \\(${productName}\\)$`));
      // `.closest("div")` would stop at the inner header `<Stack>`'s div,
      // which doesn't contain the steps/measurements/features siblings below
      // it — climb to the actual per-component `<Paper>` via its MUI class.
      const componentSection = componentHeading.closest(".MuiPaper-root") as HTMLElement;
      expect(within(componentSection).getByText("0 of 1 steps complete")).toBeInTheDocument();
      // `findByText`, not `getByText`, for the process/measurement-definition
      // names below: each comes from its own independent list query
      // (`useListProcessesQuery`/`useListMeasurementDefinitionsQuery`), not
      // the same one gating `componentHeading` (`useListProductsQuery`), so
      // they can still be in flight the instant the heading appears.
      await within(componentSection).findByText(`${processName}: pending`, {}, NETWORK_WAIT);
      const measurementDefText = await within(componentSection).findByText(measurementDefName, {}, NETWORK_WAIT);
      const measurementRow = measurementDefText.closest("tr") as HTMLElement;
      expect(Number(within(measurementRow).getAllByRole("cell")[1]?.textContent)).toBe(40);
      expect(within(componentSection).getByText("No features selected.")).toBeInTheDocument();

      // Generate PDF: real Puppeteer rendering (Group 3), confirm success
      // and that the response's real (server-local, non-URL) path shape is
      // surfaced honestly rather than a fabricated download link.
      await user.click(screen.getByRole("button", { name: "Generate PDF" }));
      const pdfAlert = await screen.findByText(/PDF generated and stored on the server at:/, {}, PDF_WAIT);
      expect(pdfAlert.textContent).toContain(`${order.data.orderNumber}.pdf`);

      // Repeat this order: navigates the real OrderBuilderPage with
      // `?repeatOfOrderId=`, which must fetch the source order and pre-fill
      // retailer/customer/super product/measurements from it.
      await user.click(screen.getByRole("button", { name: "Repeat this order" }));
      await screen.findByRole("heading", { name: "New Order" }, NETWORK_WAIT);
      await screen.findByText(new RegExp(`Repeating order ${order.data.orderNumber}`), {}, NETWORK_WAIT);

      // Retailer step's "Next" is already enabled because retailerId
      // pre-filled — advancing immediately (no manual retailer click) is
      // itself proof the prefill took effect.
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText(new RegExp(`Pick a customer for ${retailerName}`), {}, NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: "Next" }));

      // PHASE_9_TASKS.md Group 7: the Products step is now a real cart — the
      // repeat source's one order_item (one superProductId, quantity 1)
      // groups into one pre-filled line item row, not a blank product picker.
      await screen.findByRole("combobox", { name: "Product" }, NETWORK_WAIT);
      const row = await screen.findByTestId(`line-item-row-${superProduct.data.id}`, {}, NETWORK_WAIT);
      expect(within(row).getByText(superProductName.toUpperCase())).toBeInTheDocument();

      await user.click(within(row).getByTestId("measurement-status"));
      await screen.findByRole("heading", { name: new RegExp(`^Piece \\(${productName}\\)$`) }, NETWORK_WAIT);
      const valueInput = (await screen.findByLabelText(
        new RegExp(`^${measurementDefName} value`),
        {},
        NETWORK_WAIT
      )) as HTMLInputElement;
      expect(Number(valueInput.value)).toBe(40);
    },
    60000
  );
});
