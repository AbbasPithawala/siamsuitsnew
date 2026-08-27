import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { createRetailerLinkedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { GroupOrderDetailPage } from "./GroupOrderDetailPage";
import { GroupOrdersPage } from "./GroupOrdersPage";
import { NewGroupOrderPage } from "./NewGroupOrderPage";
import { countOrderGroupsByIds, countOrdersByIds, hardDeleteOrderGroups, hardDeleteOrders } from "./testSupport/orderDbCleanup";

/**
 * Integration tests against a real, running `siam/server` (not mocked).
 *
 * This file was rewritten (PHASE work: "Group Orders create flow — data
 * model correction") after the first version of `NewGroupOrderPage.tsx`
 * shipped with the wrong model — N fully independent carts, one per customer
 * — confirmed wrong against real legacy source and the actual user directly.
 * The real model: products/quantities/per-unit styling are chosen exactly
 * ONCE for the whole group (a shared cart); each added customer only fills
 * in their own measurement values against that identical shared cart. See
 * `NewGroupOrderPage.tsx`'s own top doc comment for the full rationale.
 *
 * The primary test below is this file's real acceptance bar: build a shared
 * cart with 2 line items (one — "Vest" — with 2 units carrying deliberately
 * DIFFERENT per-unit styling, proving per-unit styling survives; the other —
 * "Shirt" — with 1 unit), add 2 customers with different measurement values,
 * place the group, then fetch it back via `GET /order-groups/:id` and prove
 * both child orders end up with byte-identical items/styling (same
 * `superProductId` per position, same `styleId` set per component) but
 * distinct measurement values — not just "a group order gets created".
 *
 * `admin` (Owner) holds `orders.group.create` directly (`server/src/db/seed/index.ts`'s
 * `ownerExcludedPermissionKeys` doesn't list it), so, unlike
 * `OrderBuilderPage.live.test.tsx`, no separate fixture-user token swap is
 * needed for the one real "Place Group Order" click.
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

interface RetailerFixture {
  id: string;
  name: string;
  code: string;
}

async function createRetailerFixture(token: string): Promise<RetailerFixture> {
  const suffix = uniqueSuffix();
  const name = `Live Group Order Retailer ${suffix}`;
  const code = `LGO-${suffix}`.toUpperCase();
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
  const firstName = `LiveGroupOrderCust-${suffix}`;
  const created = await apiRequest<{ data: { id: string } }>("/customers", token, {
    method: "POST",
    body: JSON.stringify({ retailerId, firstName }),
  });
  return { id: created.data.id, firstName };
}

/** Real seeded catalog products (`OrderBuilderPage.live.test.tsx` established this same lookup pattern). */
async function fetchRealProductIdByName(token: string, name: string): Promise<string> {
  const list = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
  const found = list.data.find((product) => product.name === name);
  if (!found) throw new Error(`Expected the real seeded catalog to include a "${name}" product`);
  return found.id;
}

interface SuperProductFixture {
  id: string;
  name: string;
  components: { id: string; slotLabel: string; productId: string }[];
}

async function createSuperProductFixture(
  token: string,
  name: string,
  components: { productId: string; slotLabel: string }[]
): Promise<SuperProductFixture> {
  const created = await apiRequest<{ data: { id: string; components: { id: string; slotLabel: string; productId: string }[] } }>(
    "/super-products",
    token,
    { method: "POST", body: JSON.stringify({ name, components }) }
  );
  return { id: created.data.id, name, components: created.data.components };
}

interface GroupOrderApiFixture {
  id: string;
  orderNumber: string;
  orders: {
    id: string;
    orderNumber: string;
    customerId: string;
    items: {
      superProductId: string;
      components: {
        slotLabel: string;
        measurements: { measurementDefinitionId: string; value: string | null }[];
        features: { featureId: string; styleId: string | null }[];
      }[];
    }[];
  }[];
}

async function placeGroupOrderFixture(
  token: string,
  retailerId: string,
  customerIds: string[],
  superProductId: string,
  componentId: string
): Promise<GroupOrderApiFixture> {
  const created = await apiRequest<{ data: GroupOrderApiFixture }>("/order-groups", token, {
    method: "POST",
    body: JSON.stringify({
      retailerId,
      orders: customerIds.map((customerId) => ({
        customerId,
        items: [{ superProductId, components: [{ superProductComponentId: componentId }] }],
      })),
    }),
  });
  return created.data;
}

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

function ChildOrderStub() {
  const { id } = useParams<{ id: string }>();
  return <div>Navigated to order detail {id}</div>;
}

function renderNewGroupOrder(store: EnhancedStore) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/group-orders/new"]}>
        <NewGroupOrderPage />
      </MemoryRouter>
    </Provider>
  );
}

function renderGroupOrdersListAndDetail(store: EnhancedStore) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/group-orders"]}>
        <Routes>
          <Route path="/group-orders" element={<GroupOrdersPage />} />
          <Route path="/group-orders/:id" element={<GroupOrderDetailPage />} />
          <Route path="/orders/:id" element={<ChildOrderStub />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

async function selectInCombobox(labelText: string, optionName: string) {
  const combobox = await screen.findByLabelText(new RegExp(`^${labelText}`, "i"), {}, NETWORK_WAIT);
  await userEvent.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: optionName }));
  await waitForNoOpenListbox();
}

function getLineItemRow(superProductId: string): HTMLElement {
  return screen.getByTestId(`line-item-row-${superProductId}`);
}

/** `unit-<index>-content` id per `StylingAccordion.tsx` — stays mounted (though visually collapsed) regardless of which unit's accordion is expanded, per `StylingAccordion.live.test.tsx`'s own established pattern. */
function getUnitContent(index: number): HTMLElement {
  return document.getElementById(`unit-${index}-content`) as HTMLElement;
}

/**
 * Picks the FIRST available style tile on every required "Normal styles" tab
 * within `section`. Waits for the tab bar itself (`findAllByRole`, not the
 * synchronous `queryAllByRole`) — the underlying `useProductFeaturesQuery`
 * isn't necessarily resolved yet the instant this line item's styling panel
 * first mounts (confirmed live: querying synchronously here silently found
 * zero tabs and skipped the whole loop for the second line item styled in a
 * row, leaving it permanently "Missing" with no thrown error at all).
 */
/**
 * A style with no sub-options renders as an image-card button (`aria-pressed`); a style WITH
 * sub-options renders as a plain radio instead (PHASE_10_TASKS.md follow-up — legacy
 * `Options.jsx`'s real shape, `ChoiceFeatureField.tsx`'s own doc comment) — so picking "the
 * first/last unselected style in this tab" has to try both kinds, since a tab can be made up
 * entirely of either depending on the real catalog data.
 *
 * Scoped to the active tab's own real `role="tabpanel"` (`ChoiceTabBar`'s own doc comment),
 * NOT the whole component `section` — `section` also contains sibling inline features (e.g.
 * Monogram Position/Font Style) that render their own real `role="radio"` elements
 * unconditionally, which would otherwise be indistinguishable from this tab's actual style
 * choices and get picked by mistake.
 */
function unselectedStyleElements(section: HTMLElement): HTMLElement[] {
  const panel = within(section).getByRole("tabpanel");
  const buttons = within(panel).queryAllByRole("button", { pressed: false });
  if (buttons.length > 0) return buttons;
  return within(panel).queryAllByRole("radio", { checked: false });
}

async function completeAllStyleTabsFirst(user: ReturnType<typeof userEvent.setup>, section: HTMLElement) {
  const tabs = await within(section).findAllByRole("tab", {}, NETWORK_WAIT);
  for (const tab of tabs) {
    await user.click(tab);
    const unselected = unselectedStyleElements(section);
    if (unselected.length > 0) {
      await user.click(unselected[0] as HTMLElement);
    }
  }
}

/** Picks the LAST available style tile on every required tab — deliberately different from `completeAllStyleTabsFirst`, to prove distinct per-unit styling actually round-trips. */
async function completeAllStyleTabsLast(user: ReturnType<typeof userEvent.setup>, section: HTMLElement) {
  const tabs = await within(section).findAllByRole("tab", {}, NETWORK_WAIT);
  for (const tab of tabs) {
    await user.click(tab);
    const unselected = unselectedStyleElements(section);
    if (unselected.length > 0) {
      await user.click(unselected[unselected.length - 1] as HTMLElement);
    }
  }
}

/**
 * Types `value` into EVERY "* value" input for the given component's
 * measurement section (not just the first) — same shape
 * `OrderBuilderPage.live.test.tsx`'s `fillMeasurementValues` already
 * established, and for the same reason: it guarantees `measurements[0].value`
 * on the eventual server response equals `value` regardless of which real
 * measurement definition happens to sort first, without this test needing to
 * know or care about that ordering.
 */
async function fillMeasurementValueForSlot(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  slotLabel: string,
  value: string
) {
  const heading = await within(container).findByRole("heading", { name: new RegExp(`^${slotLabel}\\b`) }, NETWORK_WAIT);
  const section = heading.closest("div") as HTMLElement;
  const valueInputs = (await within(section).findAllByRole("textbox", {}, NETWORK_WAIT)).filter((input) =>
    (input.getAttribute("aria-label") ?? "").endsWith(" value")
  );
  for (const input of valueInputs) {
    await user.type(input, value);
  }
}

const NETWORK_WAIT = { timeout: 15000 };

const createdOrderIds: string[] = [];
const createdOrderGroupIds: string[] = [];
const createdSuperProductIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdRetailerIds: string[] = [];
const retailerLinkedFixtures: { cleanup: () => Promise<void> }[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

  for (const fixture of retailerLinkedFixtures) {
    await fixture.cleanup().catch((err: unknown) => console.error("Failed to clean up a retailer-linked fixture user:", err));
  }

  // Group rows reference their child orders' real `orders.group_id` — the child orders
  // must be hard-deleted first (see `orderDbCleanup.ts`'s `hardDeleteOrderGroups` doc
  // comment on this exact FK ordering requirement).
  await hardDeleteOrders(createdOrderIds).catch((err) => console.error("Failed to hard-delete order fixtures:", err));
  const remainingOrders = await countOrdersByIds(createdOrderIds);
  expect(remainingOrders).toBe(0);

  await hardDeleteOrderGroups(createdOrderGroupIds).catch((err) => console.error("Failed to hard-delete order group fixtures:", err));
  const remainingGroups = await countOrderGroupsByIds(createdOrderGroupIds);
  expect(remainingGroups).toBe(0);

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
});

describe.skipIf(!seededToken)("Group Orders (live siam/server integration)", () => {
  it(
    "builds one shared cart (2 line items, distinct per-unit styling on one), adds 2 customers with distinct measurements, and both child orders end up with identical items/styling but distinct measurement values",
    async () => {
      const token = seededToken as string;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const customer1 = await createCustomerFixture(token, retailer.id);
      createdCustomerIds.push(customer1.id);
      const customer2 = await createCustomerFixture(token, retailer.id);
      createdCustomerIds.push(customer2.id);

      const vestProductId = await fetchRealProductIdByName(token, "vest");
      const shirtProductId = await fetchRealProductIdByName(token, "shirt");
      const vestSuperProduct = await createSuperProductFixture(token, `Live Group Order Vest ${uniqueSuffix()}`, [
        { productId: vestProductId, slotLabel: "Vest" },
      ]);
      createdSuperProductIds.push(vestSuperProduct.id);
      const shirtSuperProduct = await createSuperProductFixture(token, `Live Group Order Shirt ${uniqueSuffix()}`, [
        { productId: shirtProductId, slotLabel: "Shirt" },
      ]);
      createdSuperProductIds.push(shirtSuperProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore(token);
      const createRender = renderNewGroupOrder(store);

      await screen.findByRole("heading", { name: "New Group Order" });
      await selectInCombobox("Retailer", retailer.name);

      // Shared cart step: both products added ONCE, shared by the whole group — not per customer.
      await screen.findByText(new RegExp(`Build the shared cart for ${retailer.name}`));
      const productSelect1 = await screen.findByRole("combobox", { name: "Product" }, NETWORK_WAIT);
      await user.selectOptions(productSelect1, vestSuperProduct.name);
      await screen.findByTestId(`line-item-row-${vestSuperProduct.id}`);
      const productSelect2 = await screen.findByRole("combobox", { name: "Product" }, NETWORK_WAIT);
      await user.selectOptions(productSelect2, shirtSuperProduct.name);
      await screen.findByTestId(`line-item-row-${shirtSuperProduct.id}`);

      // No Measurement column at all at this step — no customer exists yet.
      expect(screen.queryByTestId("measurement-status")).not.toBeInTheDocument();

      // Vest gets 2 units, with deliberately DIFFERENT styling per unit.
      const vestRow = getLineItemRow(vestSuperProduct.id);
      await user.click(within(vestRow).getByRole("button", { name: "+" }));

      await user.click(within(vestRow).getByTestId("styling-status"));
      await screen.findByText(`${vestSuperProduct.name} — Fabric & Styling`);
      await completeAllStyleTabsFirst(user, getUnitContent(0));
      await user.click(screen.getByRole("button", { name: /Item 2/ }));
      await completeAllStyleTabsLast(user, getUnitContent(1));

      // Shirt gets 1 unit. `OrderCartStep`'s single `focused` state re-renders
      // (never remounts, no `key`) the SAME `<StylingAccordion>` element
      // position when the user switches which line item's styling panel is
      // open — so its internal `expandedUnit` local state (left at `1` from
      // clicking "Item 2" for vest above) carries over unchanged even though
      // shirt only has 1 real unit, leaving shirt's own (only) unit collapsed
      // by default rather than freshly-mounted-and-expanded. A real user
      // would just click it open, same as vest's own unit 2 above — do the
      // same here rather than relying on a fresh-mount default that doesn't
      // hold across a same-page line-item switch (confirmed live: skipping
      // this click left every one of shirt's real tabs outside the
      // accessibility tree, `role="tab"` unfindable, despite their text
      // genuinely being present in the DOM).
      const shirtRow = getLineItemRow(shirtSuperProduct.id);
      await user.click(within(shirtRow).getByTestId("styling-status"));
      await screen.findByText(`${shirtSuperProduct.name} — Fabric & Styling`);
      await user.click(screen.getByRole("button", { name: /Item 1/ }));
      await completeAllStyleTabsFirst(user, getUnitContent(0));

      await waitFor(() => expect(within(vestRow).getByTestId("styling-status").textContent).toBe("Complete"), NETWORK_WAIT);
      await waitFor(() => expect(within(shirtRow).getByTestId("styling-status").textContent).toBe("Complete"), NETWORK_WAIT);

      const nextButton = screen.getByRole("button", { name: "Next: Add Customers" });
      await waitFor(() => expect(nextButton).toBeEnabled(), NETWORK_WAIT);
      await user.click(nextButton);

      // Customers step: each customer only enters their OWN measurements against the identical shared cart above.
      await screen.findByText(new RegExp(`Customers in this group for ${retailer.name}`));

      await user.click(screen.getByRole("button", { name: "Add Customer" }));
      const card0 = await screen.findByTestId("group-customer-card-0", {}, NETWORK_WAIT);
      await user.type(within(card0).getByLabelText("Search customers"), customer1.firstName);
      // MUI `Autocomplete` renders its option list via a React Portal to
      // `document.body` by default — `within(card0)` can never see it, so this has to
      // query unscoped (`screen`), by the real `option` role, not `within(card0)`/`getByText`.
      await user.click(await screen.findByRole("option", { name: customer1.firstName }, NETWORK_WAIT));
      const card0AfterCustomer = screen.getByTestId("group-customer-card-0");
      await fillMeasurementValueForSlot(user, card0AfterCustomer, "Vest", "40");
      await fillMeasurementValueForSlot(user, card0AfterCustomer, "Shirt", "16");
      await waitFor(
        () => expect(within(card0AfterCustomer).getByTestId("group-customer-status").textContent).toBe("Complete"),
        NETWORK_WAIT
      );

      await user.click(screen.getByRole("button", { name: "Add Customer" }));
      const card1 = await screen.findByTestId("group-customer-card-1", {}, NETWORK_WAIT);
      await user.type(within(card1).getByLabelText("Search customers"), customer2.firstName);
      await user.click(await screen.findByRole("option", { name: customer2.firstName }, NETWORK_WAIT));
      const card1AfterCustomer = screen.getByTestId("group-customer-card-1");
      await fillMeasurementValueForSlot(user, card1AfterCustomer, "Vest", "42");
      await fillMeasurementValueForSlot(user, card1AfterCustomer, "Shirt", "17");
      await waitFor(
        () => expect(within(card1AfterCustomer).getByTestId("group-customer-status").textContent).toBe("Complete"),
        NETWORK_WAIT
      );

      const placeButton = screen.getByRole("button", { name: "Place Group Order" });
      await waitFor(() => expect(placeButton).toBeEnabled(), NETWORK_WAIT);
      await user.click(placeButton);

      await screen.findByRole("heading", { name: "Group Order Placed" }, NETWORK_WAIT);
      const groupOrderNumberElement = await screen.findByText(new RegExp(`^${retailer.code}-G-\\d{4}$`));
      const groupOrderNumber = groupOrderNumberElement.textContent as string;

      const groupsForRetailer = await apiRequest<{ data: { id: string; orderNumber: string }[] }>(
        `/order-groups?retailerId=${retailer.id}`,
        token
      );
      const createdGroupRef = groupsForRetailer.data.find((group) => group.orderNumber === groupOrderNumber);
      expect(createdGroupRef).toBeDefined();
      createdOrderGroupIds.push(createdGroupRef!.id);

      const groupDetail = await apiRequest<{ data: GroupOrderApiFixture }>(`/order-groups/${createdGroupRef!.id}`, token);
      const group = groupDetail.data;
      expect(group.orders).toHaveLength(2);
      for (const order of group.orders) createdOrderIds.push(order.id);

      const order1 = group.orders.find((order) => order.customerId === customer1.id)!;
      const order2 = group.orders.find((order) => order.customerId === customer2.id)!;
      expect(order1).toBeDefined();
      expect(order2).toBeDefined();

      // Both child orders have the exact same 3 physical units, in the exact same order:
      // vest unit 1, vest unit 2, shirt unit 1 — one `CreateOrderItemInput` per unit
      // (Decision 1: never a `quantity` field), built from the identical shared cart.
      expect(order1.items).toHaveLength(3);
      expect(order2.items).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(order1.items[i]!.superProductId).toBe(order2.items[i]!.superProductId);
        const styleIds1 = order1.items[i]!.components[0]!.features.map((f) => f.styleId).sort();
        const styleIds2 = order2.items[i]!.components[0]!.features.map((f) => f.styleId).sort();
        expect(styleIds1).toEqual(styleIds2);
      }

      // The fixture itself is a genuine "distinct per-unit styling" case: vest unit 1's
      // and unit 2's real style picks differ (not an accidental tie from too-few options).
      const vestUnit1StyleIds = order1.items[0]!.components[0]!.features.map((f) => f.styleId).sort();
      const vestUnit2StyleIds = order1.items[1]!.components[0]!.features.map((f) => f.styleId).sort();
      expect(vestUnit1StyleIds).not.toEqual(vestUnit2StyleIds);

      // Measurement VALUES, by contrast, are the one thing that differs per customer.
      for (let i = 0; i < 3; i++) {
        const measurements1 = order1.items[i]!.components[0]!.measurements;
        const measurements2 = order2.items[i]!.components[0]!.measurements;
        expect(Number(measurements1[0]!.value)).not.toBe(Number(measurements2[0]!.value));
      }
      const vestComponent1 = order1.items[0]!.components[0]!;
      const shirtComponent1 = order1.items[2]!.components[0]!;
      expect(Number(vestComponent1.measurements[0]!.value)).toBe(40);
      expect(Number(shirtComponent1.measurements[0]!.value)).toBe(16);
      const vestComponent2 = order2.items[0]!.components[0]!;
      const shirtComponent2 = order2.items[2]!.components[0]!;
      expect(Number(vestComponent2.measurements[0]!.value)).toBe(42);
      expect(Number(shirtComponent2.measurements[0]!.value)).toBe(17);

      createRender.unmount();

      // List + detail pages: fresh render, same real store/token — unaffected by the
      // create-flow's own model (`GroupOrdersPage.tsx`/`GroupOrderDetailPage.tsx` only
      // ever read already-created groups).
      const listRender = renderGroupOrdersListAndDetail(store);

      await screen.findByRole("heading", { name: "Group Orders" });
      await selectInCombobox("Filter by retailer", retailer.name);

      const groupRowCell = await screen.findByText(groupOrderNumber, {}, NETWORK_WAIT);
      const groupRow = groupRowCell.closest("tr") as HTMLElement;
      expect(within(groupRow).getByText(retailer.name)).toBeInTheDocument();

      await user.click(groupRowCell);
      await screen.findByRole("heading", { name: `Group Order ${groupOrderNumber}` }, NETWORK_WAIT);
      await screen.findByText(new RegExp(`Retailer: ${retailer.name}`), {}, NETWORK_WAIT);

      const customer1Cell = await screen.findByText(customer1.firstName, {}, NETWORK_WAIT);
      const customer2Cell = await screen.findByText(customer2.firstName, {}, NETWORK_WAIT);
      const childRow1 = customer1Cell.closest("tr") as HTMLElement;
      const childRow2 = customer2Cell.closest("tr") as HTMLElement;
      expect(childRow1).not.toBe(childRow2);

      await user.click(within(childRow1).getByText(order1.orderNumber));
      await screen.findByText(`Navigated to order detail ${order1.id}`, {}, NETWORK_WAIT);

      listRender.unmount();
    },
    120000
  );

  it(
    "a retailer-linked session only sees its own retailer's groups on the group orders list",
    async () => {
      const token = seededToken as string;

      const retailerA = await createRetailerFixture(token);
      createdRetailerIds.push(retailerA.id);
      const retailerB = await createRetailerFixture(token);
      createdRetailerIds.push(retailerB.id);
      const customerA = await createCustomerFixture(token, retailerA.id);
      createdCustomerIds.push(customerA.id);
      const customerB = await createCustomerFixture(token, retailerB.id);
      createdCustomerIds.push(customerB.id);
      const shirtProductId = await fetchRealProductIdByName(token, "shirt");
      const superProduct = await createSuperProductFixture(token, `Live Group Order Isolation ${uniqueSuffix()}`, [
        { productId: shirtProductId, slotLabel: "Shirt" },
      ]);
      createdSuperProductIds.push(superProduct.id);
      const componentId = superProduct.components[0]!.id;

      const groupA = await placeGroupOrderFixture(token, retailerA.id, [customerA.id], superProduct.id, componentId);
      createdOrderGroupIds.push(groupA.id);
      for (const order of groupA.orders) createdOrderIds.push(order.id);

      const groupB = await placeGroupOrderFixture(token, retailerB.id, [customerB.id], superProduct.id, componentId);
      createdOrderGroupIds.push(groupB.id);
      for (const order of groupB.orders) createdOrderIds.push(order.id);

      const retailerLinkedFixture = await createRetailerLinkedUserInTenant("siam-suits", retailerA.id, ["orders.view"]);
      retailerLinkedFixtures.push(retailerLinkedFixture);
      const retailerLinkedToken = await fetchToken(retailerLinkedFixture);
      if (!retailerLinkedToken) {
        throw new Error("Expected to be able to log in as the retailer-linked fixture user");
      }

      const store = buildTestStore(retailerLinkedToken);
      const listRender = render(
        <Provider store={store}>
          <MemoryRouter initialEntries={["/group-orders"]}>
            <GroupOrdersPage />
          </MemoryRouter>
        </Provider>
      );

      await screen.findByRole("heading", { name: "Group Orders" });
      await screen.findByText(groupA.orderNumber, {}, NETWORK_WAIT);
      expect(screen.queryByText(groupB.orderNumber)).not.toBeInTheDocument();

      listRender.unmount();
    },
    30000
  );
});
