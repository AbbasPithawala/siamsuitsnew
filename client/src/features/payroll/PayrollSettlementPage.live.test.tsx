import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { PayrollSettlementPage } from "./PayrollSettlementPage";

/**
 * Integration test against a real, running `siam/server` (not mocked),
 * mirroring `JobAssignmentPage.live.test.tsx`'s fixture-building pattern.
 * This is PHASE_6_TASKS.md Group 8's headline acceptance test: settle a real
 * completed job against a real certified tailor, deduct a real cash advance,
 * and confirm every amount shown (subTotal/deductedAdvance/rent/manualBill/
 * totalPay) is exactly what the server computed — plus that the resulting
 * `worker_advance_payments.cleared`/`extra_payments.paid` flags (made live in
 * Phase 3, never visible in any UI until this group) actually show up on the
 * settlement confirmation screen.
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
 * `orders.create`, so the real `POST /orders` fixture call below needs a
 * token that does. Minted once, in the same `siam-suits` tenant as every
 * other fixture here (not a fresh tenant — see `createLimitedUserInTenant`'s
 * own doc comment). Rendering `PayrollSettlementPage` itself (`renderPage`,
 * still `admin`'s token via `buildTestStore`) and every other setup call is
 * unaffected — `admin` still holds everything else this file needs.
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

function renderPage() {
  return render(
    <Provider store={buildTestStore()}>
      <PayrollSettlementPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdOrderIds: string[] = [];
const createdComponentIds: string[] = [];
const createdSuperProductIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdRetailerIds: string[] = [];
const createdProductIds: string[] = [];
const createdProcessIds: string[] = [];
const createdFeatureIds: string[] = [];
const createdStyleIds: string[] = [];
const createdTailorIds: string[] = [];
const createdCategoryIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

  if (orderCreatorFixture) {
    await orderCreatorFixture.cleanup().catch((err: unknown) =>
      console.error("Failed to clean up the orders.create fixture user:", err)
    );
  }

  const { deleteSettlementFixtures } = await import("./testSupport/payrollDbCleanup");
  const { hardDeleteOrders, countOrdersByIds } = await import("../orders/testSupport/orderDbCleanup");

  for (const tailorId of createdTailorIds) {
    await deleteSettlementFixtures(createdComponentIds, tailorId).catch((err) =>
      console.error(`Failed to delete settlement fixtures for tailor ${tailorId}:`, err)
    );
  }
  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));

  for (const id of createdCategoryIds) {
    await apiRequest(`/extra-payment-categories/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete extra payment category fixture ${id}:`, err)
    );
  }
  for (const id of createdTailorIds) {
    await apiRequest(`/tailors/${id}`, token, { method: "DELETE" }).catch((err) => console.error(`Failed to soft-delete tailor fixture ${id}:`, err));
  }
  for (const id of createdStyleIds) {
    await apiRequest(`/styles/${id}`, token, { method: "DELETE" }).catch((err) => console.error(`Failed to soft-delete style fixture ${id}:`, err));
  }
  for (const id of createdFeatureIds) {
    await apiRequest(`/features/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete feature fixture ${id}:`, err)
    );
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
    await apiRequest(`/products/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete product fixture ${id}:`, err)
    );
  }
  for (const id of createdProcessIds) {
    await apiRequest(`/processes/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete process fixture ${id}:`, err)
    );
  }

  const remaining = await countOrdersByIds(createdOrderIds);
  expect(remaining).toBe(0);
});

describe.skipIf(!seededToken)("PayrollSettlementPage (live siam/server integration)", () => {
  it(
    "settles a real completed job with a real advance deduction, showing the server-computed breakdown and the cleared advance / paid extra payment",
    async () => {
      const token = seededToken as string;
      const suffix = uniqueSuffix();
      const user = userEvent.setup();

      const processName = `Live Settle Process ${suffix}`;
      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processName, price: "100.00" }),
      });
      createdProcessIds.push(process.data.id);

      const productName = `Live Settle Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);
      await apiRequest(`/products/${product.data.id}/processes`, token, {
        method: "PUT",
        body: JSON.stringify({ processIds: [process.data.id] }),
      });

      const feature = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({
          name: `Live Settle Feature ${suffix}`,
          type: "choice",
          processId: process.data.id,
          productIds: [product.data.id],
        }),
      });
      createdFeatureIds.push(feature.data.id);

      const style = await apiRequest<{ data: { id: string } }>(`/features/${feature.data.id}/styles`, token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Settle Style ${suffix}`, workerPrice: "20.00" }),
      });
      createdStyleIds.push(style.data.id);

      const superProduct = await apiRequest<{ data: { id: string; components: { id: string }[] } }>("/super-products", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Settle Super Product ${suffix}`, components: [{ productId: product.data.id, slotLabel: "Piece" }] }),
      });
      createdSuperProductIds.push(superProduct.data.id);
      const superProductComponent = superProduct.data.components[0]!;

      const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Settle Retailer ${suffix}`, code: `LST-${suffix}`.toUpperCase() }),
      });
      createdRetailerIds.push(retailer.data.id);

      const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
        method: "POST",
        body: JSON.stringify({ retailerId: retailer.data.id, firstName: `LiveSettleCust-${suffix}` }),
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
              components: [{ superProductComponentId: superProductComponent.id, features: [{ featureId: feature.data.id, styleId: style.data.id }] }],
            },
          ],
        }),
      });
      createdOrderIds.push(order.data.id);

      const orderDetail = await apiRequest<{ data: { items: { components: { id: string }[] }[] } }>(`/orders/${order.data.id}`, token);
      const componentId = orderDetail.data.items[0]!.components[0]!.id;
      createdComponentIds.push(componentId);

      const tailorName = `Live Settle Tailor ${suffix}`;
      const tailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: tailorName, username: `live-settle-tailor-${suffix}`, password: "TestPassword123!" }),
      });
      createdTailorIds.push(tailor.data.id);
      await apiRequest(`/tailors/${tailor.data.id}/processes`, token, {
        method: "POST",
        body: JSON.stringify({ processId: process.data.id }),
      });

      const categoryName = `Live Settle Extra Payment ${suffix}`;
      const category = await apiRequest<{ data: { id: string } }>("/extra-payment-categories", token, {
        method: "POST",
        body: JSON.stringify({
          productId: product.data.id,
          processId: process.data.id,
          featureId: feature.data.id,
          styleId: style.data.id,
          name: categoryName,
          cost: "15.00",
        }),
      });
      createdCategoryIds.push(category.data.id);

      const assignResult = await apiRequest<{ data: { job: { id: string } } }>(`/manufacturing/components/${componentId}/assign`, token, {
        method: "POST",
        body: JSON.stringify({ tailorId: tailor.data.id }),
      });
      const jobId = assignResult.data.job.id;

      const extraPayment = await apiRequest<{ data: { id: string } }>(`/jobs/${jobId}/extra-payments`, token, {
        method: "POST",
        body: JSON.stringify({ categoryId: category.data.id }),
      });
      await apiRequest(`/extra-payments/${extraPayment.data.id}/approve`, token, { method: "PATCH" });

      await apiRequest(`/manufacturing/jobs/${jobId}/complete`, token, { method: "POST" });

      await apiRequest(`/tailors/${tailor.data.id}/advances`, token, {
        method: "POST",
        body: JSON.stringify({ amount: 50 }),
      });

      renderPage();

      await screen.findByRole("heading", { name: "Payroll Settlement" });
      await user.click(screen.getByLabelText("Tailor"));
      const tailorListbox = await screen.findByRole("listbox");
      await user.click(within(tailorListbox).getByRole("option", { name: tailorName }));

      await screen.findByText(new RegExp(`Outstanding advance balance: THB 50\\.00`), {}, NETWORK_WAIT);

      const jobRow = (await screen.findByText(new RegExp(`${productName} \\(Piece\\)`), {}, NETWORK_WAIT)).closest("tr");
      expect(jobRow).not.toBeNull();
      // `PayrollSettlementPage.tsx`'s unpaid-jobs table mirrors legacy
      // `ManageJobs.jsx`'s own column layout (Group 8 follow-up) — a single
      // combined "Cost" column (`jobDisplayTotal`: process fee + styling +
      // approved-and-unpaid extra payments = 100 + 20 + 15 = 135.00) and a
      // "Type" column ("Extra"/"Normal"), not separate Cost/Styling/Pending-
      // extra-payment columns. Never asserted against the settlement
      // confirmation's own server-computed `subTotal` below — that's a
      // narrower, lower-stakes per-row display sum, not the real total.
      await within(jobRow as HTMLElement).findByText("THB 135.00", {}, NETWORK_WAIT);
      await within(jobRow as HTMLElement).findByText("Extra", {}, NETWORK_WAIT);
      await user.click(within(jobRow as HTMLElement).getByRole("checkbox"));

      await user.type(screen.getByLabelText("Rent"), "10");
      await user.type(screen.getByLabelText("Manual bill"), "5");
      await user.type(screen.getByLabelText("Deducted advance"), "50");

      await user.click(screen.getByRole("button", { name: /Create Settlement \(1 job\(s\)\)/ }));

      await screen.findByRole("heading", { name: "Settlement confirmed" }, NETWORK_WAIT);

      // subTotal = 100 (process fee) + 20 (styling) + 15 (approved extra payment) = 135.
      // totalPay = 135 + 10 (rent) + 5 (manual bill) - 50 (deducted advance) = 100.
      await screen.findByText("THB 135.00", {}, NETWORK_WAIT);
      await screen.findByText("THB 50.00", {}, NETWORK_WAIT);
      await screen.findByText("THB 10.00", {}, NETWORK_WAIT);
      await screen.findByText("THB 5.00", {}, NETWORK_WAIT);
      await screen.findByText("THB 100.00", {}, NETWORK_WAIT);
      // The old generic "N job(s) settled and marked paid." summary line was
      // replaced by a real per-job breakdown table (Group 8 follow-up, same
      // commit that reshaped the unpaid-jobs table above) — order number,
      // item, and this job's own cost+styling amount (100 + 20 = 120.00; the
      // settled-job table doesn't fold in the extra payment, unlike the
      // unpaid-jobs table's combined `jobDisplayTotal` column above).
      const settledJobRow = (await screen.findByRole("cell", { name: order.data.orderNumber }, NETWORK_WAIT)).closest("tr") as HTMLElement;
      await within(settledJobRow).findByText(new RegExp(`${productName} \\(Piece\\)`));
      await within(settledJobRow).findByText("THB 120.00");

      // The previously-dead flags, now visibly reflected. The paid-extra-payment
      // line is no longer a bare "THB 15.00" chip (Group 8 follow-up reshaped it
      // into a sentence naming the category too) — the cleared-advance chip is
      // still exactly the original bare-amount `Chip` format.
      await screen.findByText(new RegExp(`THB 15\\.00 added for ${categoryName}`), {}, NETWORK_WAIT);
      await screen.findByText("THB 50.00 — Cleared", {}, NETWORK_WAIT); // cleared advance chip

      // The settled job dropped out of the unpaid-jobs list — a fresh read
      // of the same tailor proactively shows nothing left to settle.
      await screen.findByText("This tailor has no unpaid completed jobs right now.", {}, NETWORK_WAIT);

      const afterSettlement = await apiRequest<{ data: { advanceBalance: string } }>(`/tailors/${tailor.data.id}`, token);
      expect(afterSettlement.data.advanceBalance).toBe("0.00");
    },
    60000
  );
});
