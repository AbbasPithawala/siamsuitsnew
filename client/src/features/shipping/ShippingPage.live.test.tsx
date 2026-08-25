import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { ShippingPage } from "./ShippingPage";

/**
 * Integration test against a real, running `siam/server` (not mocked),
 * mirroring `JobAssignmentPage.live.test.tsx`'s fixture-building pattern.
 * This is PHASE_6_TASKS.md Group 10's headline acceptance test — the last
 * group of Phase 6: create a real shipping box for a real retailer, pack a
 * real order item component whose manufacturing IS complete, attempt to
 * pack one whose manufacturing ISN'T complete and confirm the real
 * `MANUFACTURING_INCOMPLETE` rejection is surfaced as a clear message (not
 * silently allowed, not a raw failure dump), then close the box — entirely
 * through the UI.
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

async function fetchSeedToken(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SEED_CREDENTIALS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { token: string } };
    return body.data.token;
  } catch {
    return null;
  }
}

const seededToken = await fetchSeedToken();

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

function renderPage() {
  return render(
    <Provider store={buildTestStore()}>
      <ShippingPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdBoxIds: string[] = [];
const createdOrderIds: string[] = [];
const createdComponentIds: string[] = [];
const createdSuperProductIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdRetailerIds: string[] = [];
const createdProductIds: string[] = [];
const createdProcessIds: string[] = [];
const createdTailorIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

  const { hardDeleteShippingBoxes, countShippingBoxesByIds } = await import("./testSupport/shippingDbCleanup");
  const { deleteJobsAndExtraPayments } = await import("../manufacturing/testSupport/manufacturingDbCleanup");
  const { hardDeleteOrders, countOrdersByIds } = await import("../orders/testSupport/orderDbCleanup");

  await hardDeleteShippingBoxes(createdBoxIds).catch((err) => console.error("Failed to hard-delete shipping box fixtures:", err));
  await deleteJobsAndExtraPayments(createdComponentIds).catch((err) => console.error("Failed to delete job fixtures:", err));
  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));

  for (const id of createdTailorIds) {
    await apiRequest(`/tailors/${id}`, token, { method: "DELETE" }).catch((err) => console.error(`Failed to soft-delete tailor fixture ${id}:`, err));
  }
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
    await apiRequest(`/products/${id}`, token, { method: "DELETE" }).catch((err) => console.error(`Failed to soft-delete product fixture ${id}:`, err));
  }
  for (const id of createdProcessIds) {
    await apiRequest(`/processes/${id}`, token, { method: "DELETE" }).catch((err) => console.error(`Failed to soft-delete process fixture ${id}:`, err));
  }

  expect(await countShippingBoxesByIds(createdBoxIds)).toBe(0);
  expect(await countOrdersByIds(createdOrderIds)).toBe(0);
});

describe.skipIf(!seededToken)("ShippingPage (live siam/server integration)", () => {
  it(
    "creates a shipping box, packs a fully-manufactured component, rejects an incomplete one with a clear message, then closes the box",
    async () => {
      const token = seededToken as string;
      const suffix = uniqueSuffix();
      const user = userEvent.setup();

      const processName = `Live Ship Process ${suffix}`;
      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processName, price: "50.00" }),
      });
      createdProcessIds.push(process.data.id);

      const productName = `Live Ship Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);
      await apiRequest(`/products/${product.data.id}/processes`, token, {
        method: "PUT",
        body: JSON.stringify({ processIds: [process.data.id] }),
      });

      const completeSlotLabel = `Complete Piece ${suffix}`;
      const incompleteSlotLabel = `Incomplete Piece ${suffix}`;
      const superProduct = await apiRequest<{ data: { id: string; components: { id: string; slotLabel: string }[] } }>(
        "/super-products",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            name: `Live Ship Super Product ${suffix}`,
            components: [
              { productId: product.data.id, slotLabel: completeSlotLabel },
              { productId: product.data.id, slotLabel: incompleteSlotLabel },
            ],
          }),
        }
      );
      createdSuperProductIds.push(superProduct.data.id);

      const retailerName = `Live Ship Retailer ${suffix}`;
      const retailerCode = `SHP-${suffix}`.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: retailerName, code: retailerCode }),
      });
      createdRetailerIds.push(retailer.data.id);

      const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
        method: "POST",
        body: JSON.stringify({ retailerId: retailer.data.id, firstName: `LiveShipCust-${suffix}` }),
      });
      createdCustomerIds.push(customer.data.id);

      const order = await apiRequest<{ data: { id: string } }>("/orders", token, {
        method: "POST",
        body: JSON.stringify({
          retailerId: retailer.data.id,
          customerId: customer.data.id,
          items: [
            {
              superProductId: superProduct.data.id,
              components: superProduct.data.components.map((c) => ({ superProductComponentId: c.id })),
            },
          ],
        }),
      });
      createdOrderIds.push(order.data.id);

      const orderDetail = await apiRequest<{ data: { items: { components: { id: string; slotLabel: string }[] }[] } }>(
        `/orders/${order.data.id}`,
        token
      );
      const allComponents = orderDetail.data.items.flatMap((item) => item.components);
      const completeComponentId = allComponents.find((c) => c.slotLabel === completeSlotLabel)!.id;
      const incompleteComponentId = allComponents.find((c) => c.slotLabel === incompleteSlotLabel)!.id;
      createdComponentIds.push(completeComponentId, incompleteComponentId);

      const tailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Ship Tailor ${suffix}`, username: `live-ship-tailor-${suffix}`, password: "TestPassword123!" }),
      });
      createdTailorIds.push(tailor.data.id);
      await apiRequest(`/tailors/${tailor.data.id}/processes`, token, {
        method: "POST",
        body: JSON.stringify({ processId: process.data.id }),
      });

      // Finish manufacturing for the "complete" component only, directly via
      // the API — this test is about the shipping UI, not re-proving the
      // assign/complete flow already covered by JobAssignmentPage's tests.
      const assignResult = await apiRequest<{ data: { job: { id: string } } }>(
        `/manufacturing/components/${completeComponentId}/assign`,
        token,
        { method: "POST", body: JSON.stringify({ tailorId: tailor.data.id }) }
      );
      await apiRequest(`/manufacturing/jobs/${assignResult.data.job.id}/complete`, token, { method: "POST" });

      renderPage();

      await screen.findByRole("heading", { name: "Shipping" });

      await user.click(screen.getByRole("button", { name: "Create Shipping Box" }));
      const createDialog = await screen.findByRole("dialog");
      await user.click(within(createDialog).getByLabelText(/^Retailer/));
      const retailerListbox = await screen.findByRole("listbox");
      await user.click(within(retailerListbox).getByRole("option", { name: retailerName }));
      await user.click(within(createDialog).getByRole("button", { name: "Create" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const boxList = await apiRequest<{ data: { id: string; trackingCode: string }[] }>(
        `/shipping-boxes?retailerId=${retailer.data.id}`,
        token
      );
      const createdBox = boxList.data[0]!;
      createdBoxIds.push(createdBox.id);
      const trackingCode = createdBox.trackingCode;

      const panel = await screen.findByTestId("shipping-box-detail-panel", {}, NETWORK_WAIT);
      await within(panel).findByRole("heading", { name: trackingCode }, NETWORK_WAIT);
      await within(panel).findByText("Packed components (0)", {}, NETWORK_WAIT);

      // Pack the fully-manufactured component: preview proactively confirms
      // it's ready, then the add succeeds.
      await user.type(screen.getByLabelText("Order item component ID"), completeComponentId);
      await user.click(screen.getByRole("button", { name: "Look up" }));

      await screen.findByText(new RegExp(`${completeSlotLabel} — ${productName}`), {}, NETWORK_WAIT);
      await screen.findByText(`${processName}: complete`, {}, NETWORK_WAIT);
      await screen.findByText("Manufacturing complete — ready to pack.", {}, NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: "Add to box" }));
      await screen.findByText(new RegExp(`Added "${completeSlotLabel}" to the box`), {}, NETWORK_WAIT);
      await screen.findByText("Packed components (1)", {}, NETWORK_WAIT);
      const packedRow = (await screen.findByText(completeComponentId, {}, NETWORK_WAIT)).closest("tr") as HTMLElement;
      await within(packedRow).findByText(completeSlotLabel);

      // Attempt the incomplete component: preview proactively warns, and the
      // real server rejection is surfaced clearly (not silently allowed, not
      // a raw failure dump) when "Add to box" is clicked anyway.
      await user.type(screen.getByLabelText("Order item component ID"), incompleteComponentId);
      await user.click(screen.getByRole("button", { name: "Look up" }));

      await screen.findByText(new RegExp(`${incompleteSlotLabel} — ${productName}`), {}, NETWORK_WAIT);
      await screen.findByText(`${processName}: pending`, {}, NETWORK_WAIT);
      await screen.findByText(/Manufacturing isn't complete for this component yet \(1 step\(s\) pending\)/, {}, NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: "Add to box" }));
      await screen.findByText(
        new RegExp(`cannot be shipped .{1,3} manufacturing step\\(s\\) not complete: ${processName} \\(pending\\)`),
        {},
        NETWORK_WAIT
      );
      // Still just the one packed item — the rejected component was not added.
      await screen.findByText("Packed components (1)", {}, NETWORK_WAIT);
      expect(screen.queryByText(incompleteComponentId)).not.toBeInTheDocument();

      // Close the box. (The list row's own status chip also flips to
      // "Closed" once the mutation invalidates the list query, so this
      // assertion is scoped to the detail panel specifically — otherwise
      // "Closed" now matches two elements on the page.)
      await user.click(screen.getByRole("button", { name: "Close box" }));
      await within(panel).findByText("Closed", {}, NETWORK_WAIT);
      expect(screen.queryByRole("button", { name: "Close box" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Order item component ID")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Remove .* from box/ })).not.toBeInTheDocument();

      const afterClose = await apiRequest<{ data: { isClosed: boolean; items: { orderItemComponentId: string }[] } }>(
        `/shipping-boxes/${createdBox.id}`,
        token
      );
      expect(afterClose.data.isClosed).toBe(true);
      expect(afterClose.data.items).toHaveLength(1);
      expect(afterClose.data.items[0]!.orderItemComponentId).toBe(completeComponentId);
    },
    60000
  );
});
