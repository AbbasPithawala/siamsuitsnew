import { useState } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import {
  LineItemMeasurementsPanel,
  createEmptyLineItemMeasurementsDraft,
  useLineItemMeasurementsCompleteness,
} from "./LineItemMeasurementsPanel";
import type { LineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import type { SuperProductComponent } from "../catalog/superProductsApi";
import { hardDeleteOrders, countOrdersByIds } from "./testSupport/orderDbCleanup";
import { hardDeleteCustomerMeasurementProfiles } from "../measurements/testSupport/measurementProfileDbCleanup";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";

/**
 * Standalone live-integration test harness for PHASE_9_TASKS.md Group 6's
 * `<LineItemMeasurementsPanel>` — mounts the panel directly (not via
 * `OrderBuilderPage`/the real wizard, per this group's own scope boundary:
 * Group 7 owns wiring this into the wizard). Mirrors the
 * `OrderBuilderPage.live.test.tsx`/`MeasurementForm.live.test.tsx` pattern:
 * a real, running `siam/server`, real fixtures created/torn down via raw
 * `fetch`, skips itself if the server isn't reachable.
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

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

/**
 * PHASE_10_TASKS.md Workstream E Group 5: the seeded admin (Owner) lost `orders.create`,
 * so the real order-submission step in the test below can no longer run under
 * `seededToken` — mints a real, throwaway `orders.create`-holding user in the same
 * `siam-suits` tenant (every other fixture here — retailer/product/measurement-definition —
 * still needs the real admin token) and logs in as it via the real login endpoint, same
 * pattern established for `OrderBuilderPage.live.test.tsx`/`OrderDetailPage.live.test.tsx`.
 */
async function withOrderCreatorToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const fixture = await createLimitedUserInTenant("siam-suits", ["orders.create"]);
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixture),
    });
    if (!res.ok) {
      throw new Error(`Failed to log in as order-creator fixture: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { data: { token: string } };
    return await fn(body.data.token);
  } finally {
    await fixture.cleanup();
  }
}

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

function Harness({ components, customerId }: { components: SuperProductComponent[]; customerId: string | null }) {
  const [draft, setDraft] = useState<LineItemMeasurementsDraft>(() => createEmptyLineItemMeasurementsDraft(components));
  const complete = useLineItemMeasurementsCompleteness(components, draft);
  return (
    <>
      <LineItemMeasurementsPanel
        components={components}
        draft={draft}
        customerId={customerId}
        onChange={(componentId, next) => setDraft((current) => ({ ...current, [componentId]: next }))}
      />
      <pre data-testid="current-draft">{JSON.stringify(draft)}</pre>
      <pre data-testid="hook-complete">{String(complete)}</pre>
    </>
  );
}

const createdSuperProductIds: string[] = [];
const createdProductIds: string[] = [];
const createdRetailerIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdOrderIds: string[] = [];

interface RetailerFixture {
  id: string;
}

async function createRetailerFixture(token: string): Promise<RetailerFixture> {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const created = await apiRequest<{ data: { id: string } }>("/retailers", token, {
    method: "POST",
    body: JSON.stringify({ name: `Profile Prefill Retailer ${suffix}`, code: `PPR${suffix}`.toUpperCase() }),
  });
  createdRetailerIds.push(created.data.id);
  return { id: created.data.id };
}

async function createCustomerFixture(token: string, retailerId: string, label: string): Promise<string> {
  const created = await apiRequest<{ data: { id: string } }>("/customers", token, {
    method: "POST",
    body: JSON.stringify({ retailerId, firstName: `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }),
  });
  createdCustomerIds.push(created.data.id);
  return created.data.id;
}

/** Mirrors `server/test/measurementProfiles.orderWritePath.test.ts`'s own real-order fixture approach — a real profile only ever comes from a real order submission through the write-path hook, there is no way to seed one directly. */
async function submitOrderFixture(
  token: string,
  retailerId: string,
  customerId: string,
  superProductId: string,
  superProductComponentId: string,
  measurements: { measurementDefinitionId: string; value: string }[]
): Promise<string> {
  const created = await apiRequest<{ data: { id: string } }>("/orders", token, {
    method: "POST",
    body: JSON.stringify({
      retailerId,
      customerId,
      items: [{ superProductId, components: [{ superProductComponentId, measurements }] }],
    }),
  });
  createdOrderIds.push(created.data.id);
  return created.data.id;
}

afterAll(async () => {
  if (!seededToken) return;
  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));
  await hardDeleteCustomerMeasurementProfiles(createdCustomerIds).catch((err) =>
    console.error("Failed to hard-delete customer measurement profile fixtures:", err)
  );
  for (const id of createdCustomerIds) {
    await apiRequest(`/customers/${id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete customer fixture ${id}:`, err)
    );
  }
  for (const id of createdSuperProductIds) {
    await apiRequest(`/super-products/${id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete super product fixture ${id}:`, err)
    );
  }
  for (const id of createdProductIds) {
    await apiRequest(`/products/${id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to delete product fixture ${id}:`, err)
    );
  }
  for (const id of createdRetailerIds) {
    await apiRequest(`/retailers/${id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete retailer fixture ${id}:`, err)
    );
  }

  const remainingOrders = await countOrdersByIds(createdOrderIds);
  expect(remainingOrders).toBe(0);
});

describe.skipIf(!seededToken)("LineItemMeasurementsPanel (live siam/server integration, PHASE_9_TASKS.md Group 6)", () => {
  it(
    "renders exactly one MeasurementForm per real component (not per unit), and Manual Fit + Shoulder Type both still work inside the composition",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();

      // A fresh product with its own measurement definition + a real Manual
      // Fit fitting (PHASE_8_TASKS.md Group 6.4), composed alongside the real
      // seeded jacket (which carries the real Shoulder Type render-slot
      // feature, PHASE_9_TASKS.md Group 0) — proves both Group 3 behaviors
      // survive being hosted inside this panel, not just in isolation.
      const fitProduct = await apiRequest<{ data: { id: string } }>("/products", token, {
        method: "POST",
        body: JSON.stringify({ name: `Panel Manual Fit Product ${suffix}` }),
      });
      const fitProductId = fitProduct.data.id;
      createdProductIds.push(fitProductId);

      const chest = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
        method: "POST",
        body: JSON.stringify({ name: `Panel Chest ${suffix}`, slug: `panel-chest-${suffix}` }),
      });
      await apiRequest(`/products/${fitProductId}/measurements`, token, {
        method: "PUT",
        body: JSON.stringify({ measurementDefinitionIds: [chest.data.id] }),
      });
      const fitting = await apiRequest<{ data: { id: string } }>(`/products/${fitProductId}/fittings`, token, {
        method: "POST",
        body: JSON.stringify({ name: `Panel Slim ${suffix}` }),
      });
      await apiRequest(`/fittings/${fitting.data.id}/values`, token, {
        method: "PUT",
        body: JSON.stringify({ values: [{ measurementDefinitionId: chest.data.id, value: "3.00" }] }),
      });

      const productList = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
      const jacket = productList.data.find((p) => p.name.toLowerCase() === "jacket");
      if (!jacket) throw new Error("Expected a real seeded 'jacket' product");

      const created = await apiRequest<{
        data: { id: string; components: { id: string; slotLabel: string; productId: string }[] };
      }>("/super-products", token, {
        method: "POST",
        body: JSON.stringify({
          name: `Panel Fixture ${suffix}`,
          components: [
            { productId: fitProductId, slotLabel: "Custom" },
            { productId: jacket.id, slotLabel: "Jacket" },
          ],
        }),
      });
      createdSuperProductIds.push(created.data.id);

      const detail = await apiRequest<{ data: { components: SuperProductComponent[] } }>(
        `/super-products/${created.data.id}`,
        token
      );
      const components = detail.data.components;
      expect(components).toHaveLength(2);

      const user = userEvent.setup();
      render(
        <Provider store={buildTestStore()}>
          <Harness components={components} customerId={null} />
        </Provider>
      );

      // Exactly one measurement form per component: one "Custom" heading and
      // one "Jacket" heading, no unit-indexed duplicates.
      const customHeading = await screen.findByRole("heading", { name: /^Custom\b/ });
      const jacketHeading = await screen.findByRole("heading", { name: /^Jacket\b/ });
      expect(screen.getAllByRole("heading", { name: /^Custom\b/ })).toHaveLength(1);
      expect(screen.getAllByRole("heading", { name: /^Jacket\b/ })).toHaveLength(1);

      const customSection = customHeading.closest("div") as HTMLElement;
      const jacketSection = jacketHeading.closest("div") as HTMLElement;

      // Starts Missing (nothing filled in yet on either component).
      expect(screen.getByText("Missing")).toBeInTheDocument();
      expect(screen.getByTestId("hook-complete").textContent).toBe("false");

      // Manual Fit still works inside this composition (Group 3 behavior, re-hosted here).
      const manualFitSelect = await within(customSection).findByLabelText("Manual Fit");
      await user.selectOptions(manualFitSelect, `Panel Slim ${suffix}`);
      await waitFor(() => {
        const draft = JSON.parse(screen.getByTestId("current-draft").textContent ?? "{}") as Record<
          string,
          { measurements: { adjustmentValue?: string }[] }
        >;
        const fitComponentId = components.find((c) => c.slotLabel === "Custom")!.id;
        expect(draft[fitComponentId]?.measurements[0]?.adjustmentValue).toBe("3.00");
      });
      // The body "value" (not just the fitting's adjustment) still has to be entered for
      // this component's measurement to count as filled (matches legacy's real
      // `total_value > 0` rule — an adjustment alone, with no body value, isn't "filled").
      const customValueInput = within(customSection).getByRole("textbox", {
        name: `Panel Chest ${suffix} value`,
      });
      await user.type(customValueInput, "40");

      // Shoulder Type still works inside this composition (Group 3 behavior, re-hosted here).
      const featuresRes = await apiRequest<{ data: { id: string; renderSlot: string | null; styles?: { id: string; name: string }[] }[] }>(
        `/features?productId=${jacket.id}`,
        token
      );
      const shoulderTypeFeature = featuresRes.data.find((f) => f.renderSlot === "shoulder_type");
      if (!shoulderTypeFeature) throw new Error("Expected the real seeded Shoulder Type feature on jacket");
      const firstStyle = shoulderTypeFeature.styles![0]!;
      const shoulderRadio = within(jacketSection).getByRole("radio", { name: firstStyle.name.trim() });
      await user.click(shoulderRadio);
      await waitFor(() => expect(shoulderRadio).toBeChecked());

      // Fill every one of the jacket's real measurement "value" fields (the real seeded
      // jacket has more than one) so the whole panel can become Complete — every
      // component's every measurement needs a real total, not just one field.
      const jacketTextboxes = within(jacketSection).getAllByRole("textbox");
      for (const input of jacketTextboxes) {
        if ((input.getAttribute("aria-label") ?? "").endsWith(" value")) {
          await user.type(input, "42");
        }
      }

      // Now Complete, once every component's every measurement has a real total.
      await screen.findByText("Complete");
      expect(screen.queryByText("Missing")).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId("hook-complete").textContent).toBe("true"));

      const finalDraft = JSON.parse(screen.getByTestId("current-draft").textContent ?? "{}") as Record<
        string,
        { features: { featureId: string; styleId: string }[] }
      >;
      const jacketComponentId = components.find((c) => c.slotLabel === "Jacket")!.id;
      expect(finalDraft[jacketComponentId]?.features).toEqual([
        { featureId: shoulderTypeFeature.id, styleId: firstStyle.id },
      ]);
    },
    30000
  );
});

describe.skipIf(!seededToken)(
  "LineItemMeasurementsPanel — customer measurement profile pre-fill (live siam/server integration, PHASE_10_TASKS.md Workstream D Group 3)",
  () => {
    it(
      "a customer with a saved profile: real, editable, pre-populated values; a customer with no profile: unchanged empty-form behavior; Manual Fit afterward only touches adjustmentValue",
      async () => {
        const token = seededToken as string;
        const suffix = Date.now();

        const retailer = await createRetailerFixture(token);

        // One product, two measurement definitions, and a real Manual Fit
        // fitting (PHASE_8_TASKS.md Group 6.4) on top — this same product is
        // reused for all three scenarios below, so the fitting is available
        // for the third scenario without a second fixture setup pass.
        const product = await apiRequest<{ data: { id: string } }>("/products", token, {
          method: "POST",
          body: JSON.stringify({ name: `Profile Prefill Product ${suffix}` }),
        });
        const productId = product.data.id;
        createdProductIds.push(productId);

        const chest = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
          method: "POST",
          body: JSON.stringify({ name: `Profile Chest ${suffix}`, slug: `profile-chest-${suffix}` }),
        });
        const waist = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
          method: "POST",
          body: JSON.stringify({ name: `Profile Waist ${suffix}`, slug: `profile-waist-${suffix}` }),
        });
        await apiRequest(`/products/${productId}/measurements`, token, {
          method: "PUT",
          body: JSON.stringify({ measurementDefinitionIds: [chest.data.id, waist.data.id] }),
        });

        const fitting = await apiRequest<{ data: { id: string } }>(`/products/${productId}/fittings`, token, {
          method: "POST",
          body: JSON.stringify({ name: `Profile Slim ${suffix}` }),
        });
        await apiRequest(`/fittings/${fitting.data.id}/values`, token, {
          method: "PUT",
          body: JSON.stringify({ values: [{ measurementDefinitionId: chest.data.id, value: "3.00" }] }),
        });

        const superProduct = await apiRequest<{
          data: { id: string; components: { id: string; slotLabel: string; productId: string }[] };
        }>("/super-products", token, {
          method: "POST",
          body: JSON.stringify({ name: `Profile Prefill Super Product ${suffix}`, components: [{ productId, slotLabel: "Custom" }] }),
        });
        createdSuperProductIds.push(superProduct.data.id);
        const detail = await apiRequest<{ data: { components: SuperProductComponent[] } }>(
          `/super-products/${superProduct.data.id}`,
          token
        );
        const components = detail.data.components;
        expect(components).toHaveLength(1);
        const componentId = components[0]!.id;

        // Customer A gets a real order (the only real way a profile is ever
        // created, PHASE_10_TASKS.md Workstream D Decision 2's write-path
        // hook — there is no way to seed the profile table directly).
        const customerWithProfile = await createCustomerFixture(token, retailer.id, "Profiled Customer");
        await withOrderCreatorToken((orderCreatorToken) =>
          submitOrderFixture(orderCreatorToken, retailer.id, customerWithProfile, superProduct.data.id, componentId, [
            { measurementDefinitionId: chest.data.id, value: "40.00" },
            { measurementDefinitionId: waist.data.id, value: "32.00" },
          ])
        );

        // Customer B never had an order placed for this product — no profile exists.
        const customerWithoutProfile = await createCustomerFixture(token, retailer.id, "Unprofiled Customer");

        // --- Scenario 1: real, editable, pre-populated values ---
        const user = userEvent.setup();
        const { unmount: unmountProfiled } = render(
          <Provider store={buildTestStore()}>
            <Harness components={components} customerId={customerWithProfile} />
          </Provider>
        );

        const chestValueInput = await screen.findByRole("textbox", { name: `Profile Chest ${suffix} value` });
        const waistValueInput = screen.getByRole("textbox", { name: `Profile Waist ${suffix} value` });
        await waitFor(() => {
          expect(chestValueInput).toHaveValue("40.00");
          expect(waistValueInput).toHaveValue("32.00");
        });

        // Real and editable: the draft itself carries the seeded values (not
        // just the display), and typing further edits them like any other
        // measurement field.
        await waitFor(() => {
          const draft = JSON.parse(screen.getByTestId("current-draft").textContent ?? "{}") as Record<
            string,
            { measurements: { measurementDefinitionId: string; value?: string }[] }
          >;
          const seeded = draft[componentId]?.measurements ?? [];
          expect(seeded.find((m) => m.measurementDefinitionId === chest.data.id)?.value).toBe("40.00");
          expect(seeded.find((m) => m.measurementDefinitionId === waist.data.id)?.value).toBe("32.00");
        });
        await user.clear(chestValueInput);
        await user.type(chestValueInput, "41");
        await waitFor(() => expect(chestValueInput).toHaveValue("41"));

        // --- Scenario 3 (same profiled customer, same render): Manual Fit only ever touches adjustmentValue ---
        const manualFitSelect = await screen.findByLabelText("Manual Fit");
        await user.selectOptions(manualFitSelect, `Profile Slim ${suffix}`);
        await waitFor(() => {
          const draft = JSON.parse(screen.getByTestId("current-draft").textContent ?? "{}") as Record<
            string,
            { measurements: { measurementDefinitionId: string; value?: string; adjustmentValue?: string }[] }
          >;
          const chestEntry = draft[componentId]?.measurements.find((m) => m.measurementDefinitionId === chest.data.id);
          // Manual Fit wrote the fitting's preset adjustment...
          expect(chestEntry?.adjustmentValue).toBe("3.00");
          // ...and left the profile-sourced (then user-edited to "41") value field completely untouched.
          expect(chestEntry?.value).toBe("41");
        });
        // Same proof visible in the rendered form itself, not just the draft.
        const chestAdjustmentInput = screen.getByRole("textbox", { name: `Profile Chest ${suffix} adjustment` });
        await waitFor(() => expect(chestAdjustmentInput).toHaveValue("3.00"));
        expect(chestValueInput).toHaveValue("41");

        unmountProfiled();

        // --- Scenario 2: no profile yet — today's empty-form behavior, completely unchanged ---
        render(
          <Provider store={buildTestStore()}>
            <Harness components={components} customerId={customerWithoutProfile} />
          </Provider>
        );
        const emptyChestInput = await screen.findByRole("textbox", { name: `Profile Chest ${suffix} value` });
        const emptyWaistInput = screen.getByRole("textbox", { name: `Profile Waist ${suffix} value` });
        expect(emptyChestInput).toHaveValue("");
        expect(emptyWaistInput).toHaveValue("");
        const emptyDraft = JSON.parse(screen.getByTestId("current-draft").textContent ?? "{}") as Record<
          string,
          { measurements: unknown[] }
        >;
        expect(emptyDraft[componentId]?.measurements ?? []).toHaveLength(0);
      },
      30000
    );
  }
);
