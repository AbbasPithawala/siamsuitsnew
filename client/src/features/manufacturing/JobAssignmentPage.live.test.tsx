import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { JobAssignmentPage } from "./JobAssignmentPage";

/**
 * Integration test against a real, running `siam/server` (not mocked),
 * mirroring `OrderDetailPage.live.test.tsx`'s fixture-building pattern. This
 * is PHASE_6_TASKS.md Group 7's headline acceptance test: assign a real
 * manufacturing step to a real certified tailor, attach a real extra payment
 * from a real category, and complete the step — entirely through the UI,
 * for the first time since Phase 3 built `assignNextStep`/`completeStep`
 * with no UI at all.
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
 * `orders.create`, so the real `POST /orders` fixture calls below need a
 * token that does. Minted once, in the same `siam-suits` tenant as every
 * other fixture here (not a fresh tenant — see `createLimitedUserInTenant`'s
 * own doc comment). Rendering `JobAssignmentPage` itself (`renderPage`, still
 * `admin`'s token via `buildTestStore`) and every other setup call is
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
      <JobAssignmentPage />
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

  const { deleteJobsAndExtraPayments } = await import("./testSupport/manufacturingDbCleanup");
  const { hardDeleteOrders, countOrdersByIds } = await import("../orders/testSupport/orderDbCleanup");

  await deleteJobsAndExtraPayments(createdComponentIds).catch((err) => console.error("Failed to delete job/extra-payment fixtures:", err));
  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));

  for (const id of createdCategoryIds) {
    await apiRequest(`/extra-payment-categories/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete extra payment category fixture ${id}:`, err)
    );
  }
  for (const id of createdStyleIds) {
    await apiRequest(`/styles/${id}`, token, { method: "DELETE" }).catch((err) => console.error(`Failed to soft-delete style fixture ${id}:`, err));
  }
  for (const id of createdFeatureIds) {
    await apiRequest(`/features/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete feature fixture ${id}:`, err)
    );
  }
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

describe.skipIf(!seededToken)("JobAssignmentPage (live siam/server integration)", () => {
  it(
    "assigns a real step to a real certified tailor, attaches a real extra payment, and completes the job entirely through the UI",
    async () => {
      const token = seededToken as string;
      const suffix = uniqueSuffix();
      const user = userEvent.setup();

      const processName = `Live Assign Process ${suffix}`;
      const process = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processName, price: "100.00" }),
      });
      createdProcessIds.push(process.data.id);

      const productName = `Live Assign Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);
      await apiRequest(`/products/${product.data.id}/processes`, token, {
        method: "PUT",
        body: JSON.stringify({ processIds: [process.data.id] }),
      });

      const featureName = `Live Assign Feature ${suffix}`;
      const feature = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: featureName, type: "choice", processId: process.data.id, productIds: [product.data.id] }),
      });
      createdFeatureIds.push(feature.data.id);

      const style = await apiRequest<{ data: { id: string } }>(`/features/${feature.data.id}/styles`, token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Assign Style ${suffix}`, workerPrice: "20.00" }),
      });
      createdStyleIds.push(style.data.id);

      const superProductName = `Live Assign Super Product ${suffix}`;
      const superProduct = await apiRequest<{ data: { id: string; components: { id: string }[] } }>("/super-products", token, {
        method: "POST",
        body: JSON.stringify({ name: superProductName, components: [{ productId: product.data.id, slotLabel: "Piece" }] }),
      });
      createdSuperProductIds.push(superProduct.data.id);
      const superProductComponent = superProduct.data.components[0]!;

      const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Assign Retailer ${suffix}`, code: `LAR-${suffix}`.toUpperCase() }),
      });
      createdRetailerIds.push(retailer.data.id);

      const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
        method: "POST",
        body: JSON.stringify({ retailerId: retailer.data.id, firstName: `LiveAssignCust-${suffix}` }),
      });
      createdCustomerIds.push(customer.data.id);

      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await apiRequest<{ data: { id: string } }>("/orders", orderCreatorToken, {
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

      const certifiedTailorName = `Live Assign Certified Tailor ${suffix}`;
      const certifiedTailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: certifiedTailorName, username: `live-assign-cert-${suffix}`, password: "TestPassword123!" }),
      });
      createdTailorIds.push(certifiedTailor.data.id);
      await apiRequest(`/tailors/${certifiedTailor.data.id}/processes`, token, {
        method: "POST",
        body: JSON.stringify({ processId: process.data.id }),
      });

      const uncertifiedTailorName = `Live Assign Uncertified Tailor ${suffix}`;
      const uncertifiedTailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: uncertifiedTailorName, username: `live-assign-uncert-${suffix}`, password: "TestPassword123!" }),
      });
      createdTailorIds.push(uncertifiedTailor.data.id);

      const categoryName = `Live Assign Extra Payment ${suffix}`;
      const category = await apiRequest<{ data: { id: string } }>("/extra-payment-categories", token, {
        method: "POST",
        body: JSON.stringify({
          productId: product.data.id,
          processId: process.data.id,
          featureId: feature.data.id,
          styleId: style.data.id,
          name: categoryName,
          cost: "20.00",
        }),
      });
      createdCategoryIds.push(category.data.id);

      renderPage();

      await screen.findByRole("heading", { name: "Assign / Complete Manufacturing Job" });
      await user.type(screen.getByLabelText("Order item component ID"), componentId);
      await user.click(screen.getByRole("button", { name: "Look up" }));

      await screen.findByRole("heading", { name: "Piece" }, NETWORK_WAIT);
      await screen.findByText(new RegExp(`Product: ${productName}`), {}, NETWORK_WAIT);
      await screen.findByText(`${processName}: pending`, {}, NETWORK_WAIT);
      await screen.findByText(new RegExp(`Next step: ${processName}`), {}, NETWORK_WAIT);

      // Certified-tailor filtering: only the certified tailor is offered.
      // `CertifiedTailorSelect` disables itself (`stillLoading`) until every
      // active tailor's own `GET /tailors/:id` certification probe resolves —
      // with a real tenant's full active-tailor list (not just this test's
      // own two fixtures) that's a real, variable number of network round
      // trips, so wait for it to finish before clicking rather than racing it.
      await screen.findByText(new RegExp(`Showing tailors certified for "${processName}"`), {}, NETWORK_WAIT);
      await user.click(screen.getByLabelText("Tailor"));
      const listbox = await screen.findByRole("listbox");
      await within(listbox).findByRole("option", { name: certifiedTailorName });
      expect(within(listbox).queryByRole("option", { name: uncertifiedTailorName })).not.toBeInTheDocument();
      await user.click(within(listbox).getByRole("option", { name: certifiedTailorName }));

      await user.click(screen.getByRole("button", { name: "Assign" }));

      await screen.findByText(new RegExp(`Job assigned — process ${processName}`), {}, NETWORK_WAIT);
      await screen.findByText(/Cost: THB 100\.00 \(process fee\) \+ THB 20\.00 \(styling\) = THB 120\.00/, {}, NETWORK_WAIT);

      // Attach the real extra payment category via the "Attach extra payment"
      // dialog before completing — each category is added immediately through
      // its own real `POST /jobs/:id/extra-payments` call (not batched until
      // "Complete job"), per `JobAssignmentPage.tsx`'s own doc comment on why
      // `activeJob`/`attachedPayments` are derived straight from a refetched
      // `componentDetail` rather than mirrored into local-only state.
      await user.click(screen.getByRole("button", { name: "Attach extra payment" }));
      const extraPaymentDialog = await screen.findByRole("dialog");
      await within(extraPaymentDialog).findByText(new RegExp(categoryName));
      await user.click(within(extraPaymentDialog).getByRole("button", { name: "Add" }));
      await within(extraPaymentDialog).findByRole("button", { name: "Remove" }, NETWORK_WAIT);
      await user.click(within(extraPaymentDialog).getByRole("button", { name: "Close" }));
      // MUI's Dialog exit transition leaves the rest of the page `aria-hidden`
      // until it finishes unmounting — wait it out before querying by role
      // again, or "Complete job" behind it is invisible to accessibility queries.
      await waitForElementToBeRemoved(() => screen.queryByRole("dialog"), NETWORK_WAIT);

      await screen.findByText("1 extra payment(s) attached.", {}, NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: "Complete job" }));

      await screen.findByText(/Job completed with 1 extra payment\(s\)\. Total pay: THB 140\.00\./, {}, NETWORK_WAIT);

      // The only step on this component is now complete — a fresh read of
      // the same component id proactively reports nothing left to assign.
      await screen.findByText(/Every manufacturing step on this component is already complete/, {}, NETWORK_WAIT);

      const afterComplete = await apiRequest<{ data: { items: { components: { manufacturingSteps: { status: string }[] }[] }[] } }>(
        `/orders/${order.data.id}`,
        token
      );
      expect(afterComplete.data.items[0]!.components[0]!.manufacturingSteps[0]!.status).toBe("complete");

      const { findExtraPaymentsForCategory } = await import("./testSupport/manufacturingDbCleanup");
      const extraPayments = await findExtraPaymentsForCategory(category.data.id);
      expect(extraPayments).toHaveLength(1);
      expect(extraPayments[0]).toMatchObject({ cost: "20.00", approved: false });
    },
    60000
  );

  it(
    "recovers the in-progress job (with the assigned tailor's name) on a fresh lookup by a different operator, rather than only a STEP_LOCKED blocked message",
    async () => {
      const token = seededToken as string;
      const suffix = uniqueSuffix();
      const user = userEvent.setup();

      const processAName = `Live Locked Process A ${suffix}`;
      const processA = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processAName, price: "40.00" }),
      });
      createdProcessIds.push(processA.data.id);

      const processBName = `Live Locked Process B ${suffix}`;
      const processB = await apiRequest<{ data: { id: string } }>("/processes", token, {
        method: "POST",
        body: JSON.stringify({ name: processBName, price: "60.00" }),
      });
      createdProcessIds.push(processB.data.id);

      const productName = `Live Locked Product ${suffix}`;
      const product = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName }),
      });
      createdProductIds.push(product.data.id);
      await apiRequest(`/products/${product.data.id}/processes`, token, {
        method: "PUT",
        body: JSON.stringify({ processIds: [processA.data.id, processB.data.id] }),
      });

      const superProduct = await apiRequest<{ data: { id: string; components: { id: string }[] } }>("/super-products", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Locked Super Product ${suffix}`, components: [{ productId: product.data.id, slotLabel: "Piece" }] }),
      });
      createdSuperProductIds.push(superProduct.data.id);
      const superProductComponent = superProduct.data.components[0]!;

      const retailer = await apiRequest<{ data: { id: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Locked Retailer ${suffix}`, code: `LLR-${suffix}`.toUpperCase() }),
      });
      createdRetailerIds.push(retailer.data.id);

      const customer = await apiRequest<{ data: { id: string } }>("/customers", token, {
        method: "POST",
        body: JSON.stringify({ retailerId: retailer.data.id, firstName: `LiveLockedCust-${suffix}` }),
      });
      createdCustomerIds.push(customer.data.id);

      if (!orderCreatorToken) {
        throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
      }
      const order = await apiRequest<{ data: { id: string } }>("/orders", orderCreatorToken, {
        method: "POST",
        body: JSON.stringify({
          retailerId: retailer.data.id,
          customerId: customer.data.id,
          items: [{ superProductId: superProduct.data.id, components: [{ superProductComponentId: superProductComponent.id }] }],
        }),
      });
      createdOrderIds.push(order.data.id);

      const orderDetail = await apiRequest<{ data: { items: { components: { id: string }[] }[] } }>(`/orders/${order.data.id}`, token);
      const componentId = orderDetail.data.items[0]!.components[0]!.id;
      createdComponentIds.push(componentId);

      const tailorName = `Live Locked Tailor ${suffix}`;
      const tailor = await apiRequest<{ data: { id: string } }>("/tailors", token, {
        method: "POST",
        body: JSON.stringify({ name: tailorName, username: `live-locked-tailor-${suffix}`, password: "TestPassword123!" }),
      });
      createdTailorIds.push(tailor.data.id);
      await apiRequest(`/tailors/${tailor.data.id}/processes`, token, {
        method: "POST",
        body: JSON.stringify({ processId: processA.data.id }),
      });

      // Assign step 1 (process A) directly via the API — this test is about
      // what a *different* operator sees on a fresh lookup afterward, not
      // about re-proving the assign flow (already covered above).
      await apiRequest(`/manufacturing/components/${componentId}/assign`, token, {
        method: "POST",
        body: JSON.stringify({ tailorId: tailor.data.id }),
      });

      renderPage();
      await screen.findByRole("heading", { name: "Assign / Complete Manufacturing Job" });
      await user.type(screen.getByLabelText("Order item component ID"), componentId);
      await user.click(screen.getByRole("button", { name: "Look up" }));

      await screen.findByText(`${processAName}: assigned`, {}, NETWORK_WAIT);
      await screen.findByText(`${processBName}: pending`, {}, NETWORK_WAIT);

      // The backend still computes `blockedReason: "STEP_LOCKED"` for process
      // B (confirmed directly against a real `GET /manufacturing/components/:id`
      // response), but `getComponentDetail`'s `activeJob` recovery (this file's
      // sibling test's doc comment, and `JobAssignmentPage.tsx`'s own) takes
      // priority in the UI: since process A's step is `assigned` (not
      // `complete`), there's always a real in-progress job to recover, so a
      // fresh lookup — even by a different operator/session — shows the
      // "Job assigned" completion panel for process A rather than a passive
      // blocked-message dead end. The raw `STEP_LOCKED` copy in
      // `manufacturingErrors.ts` is only ever reachable from `assignNextStep`'s
      // own failure response now (`getManufacturingErrorMessage`), not from a
      // proactive `getComponentDetail` read, because every state that would
      // produce that `blockedReason` also always has an `activeJob` to recover
      // (a step can only ever become non-`pending` via `assignNextStep`, which
      // atomically creates its `jobs` row in the same transaction).
      await screen.findByText(new RegExp(`Job assigned — process ${processAName}`), {}, NETWORK_WAIT);
      await screen.findByText(new RegExp(`Currently assigned to ${tailorName}`), {}, NETWORK_WAIT);
      await screen.findByText(/Cost: THB 40\.00 \(process fee\) \+ THB 0\.00 \(styling\) = THB 40\.00/, {}, NETWORK_WAIT);

      // No assign form (no next step is reachable — process B is still
      // locked behind process A), but the recovered job *can* be completed
      // from here, by anyone holding `factory.jobs.complete` (admin, here),
      // regardless of which session originally assigned it.
      expect(screen.queryByLabelText("Tailor")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Complete job" })).toBeInTheDocument();
    },
    45000
  );
});
