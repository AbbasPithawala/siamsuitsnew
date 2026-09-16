import { configureStore } from "@reduxjs/toolkit";
import type { EnhancedStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import authReducer, { setToken } from "../auth/authSlice";
import { createLimitedUserInTenant } from "../../routes/testSupport/permissionFixtures";
import { OrderBuilderPage } from "./OrderBuilderPage";
import { countOrdersByIds, hardDeleteOrders } from "./testSupport/orderDbCleanup";
import { countActiveCustomersByIds } from "../customers/testSupport/customerDbCheck";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `SuperProductsPage.live.test.tsx`'s pattern. Covers
 * `PHASE_9_TASKS.md` Group 7's rebuild: the Super Product step is now a real
 * multi-line-item cart (`OrderCartStep`), composing Group 6's
 * `<LineItemMeasurementsPanel>` (opened via a line item's Measurement cell)
 * and Group 5's `<StylingAccordion>` (opened via its Fabric & Styling cell)
 * as two genuinely separate inline entry points per line item, plus a real
 * qty stepper.
 *
 * Fixtures: a throwaway retailer, a 3-component super product (real
 * jacket/pant/vest products) and a 1-component one (real shirt), created via
 * raw `fetch` against the real API and torn down in `afterAll` — retailer
 * and super products via their real `DELETE` endpoints (soft-delete, same
 * as every other live test's cleanup), orders via `testSupport/orderDbCleanup.ts`
 * (there is no order `DELETE` endpoint at all, see that file's doc comment).
 *
 * PHASE_10_TASKS.md Workstream E Group 5: `admin` (Owner) no longer holds
 * `orders.create`, so all setup above (retailer/super-product/customer, via
 * `admin`'s own token) still runs as `admin`, but the one real "Place Order"
 * click per test — the only thing that actually needs `orders.create` — runs
 * under a separate fixture user's token instead, swapped into the wizard's
 * own Redux store (`setToken`) right before the click via `clickPlaceOrder`.
 * That fixture user is minted once for the whole file via
 * `createLimitedUserInTenant("siam-suits", ["orders.create"])` (not a fresh
 * tenant per test — see that helper's own doc comment on why a fresh,
 * unrelated tenant can't be used here: the order being placed references
 * this file's own `admin`-created retailer/customer/super-product, all in
 * `siam-suits`) — `orders.create` alone, since none of these tests submit
 * `isRush`/`repeatOfOrderId` (which would additionally need `orders.rush`/
 * `orders.repeat`, checked separately server-side).
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

interface RealProductIds {
  jacket: string;
  pant: string;
  vest: string;
  shirt: string;
}

async function fetchRealProductIds(token: string): Promise<RealProductIds> {
  const list = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
  const byName = new Map(list.data.map((product) => [product.name, product.id]));
  const required: (keyof RealProductIds)[] = ["jacket", "pant", "vest", "shirt"];
  for (const name of required) {
    if (!byName.has(name)) {
      throw new Error(`Expected the real seeded catalog to include a "${name}" product`);
    }
  }
  return {
    jacket: byName.get("jacket")!,
    pant: byName.get("pant")!,
    vest: byName.get("vest")!,
    shirt: byName.get("shirt")!,
  };
}

const realProducts = seededToken ? await fetchRealProductIds(seededToken) : null;

/**
 * Minted once for the whole file (not per-test) — see the file-level doc
 * comment above. `null` when the server/db isn't reachable, matching every
 * other top-level fixture here's `skipIf`-friendly shape.
 */
const orderCreatorFixture = seededToken ? await createLimitedUserInTenant("siam-suits", ["orders.create"]) : null;
const orderCreatorToken = orderCreatorFixture ? await fetchToken(orderCreatorFixture) : null;

function buildTestStore(): EnhancedStore {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState: { auth: { token: seededToken } },
  });
}

/**
 * Wrapped in a `MemoryRouter` (PHASE_6_TASKS.md Group 6): `OrderBuilderPage`
 * now reads `?repeatOfOrderId=` via `useSearchParams`, which throws outside
 * a Router context. Plain `/orders/new` with no query string reproduces the
 * page's default (non-repeat) behavior these tests exercise. Takes the store
 * as a param (rather than building its own internally, as before) so each
 * test can hold a reference to dispatch `setToken` on it before the one real
 * "Place Order" click — see `clickPlaceOrder` below.
 */
function renderWizard(store: EnhancedStore) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/orders/new"]}>
        <OrderBuilderPage />
      </MemoryRouter>
    </Provider>
  );
}

/**
 * The one real order-creation action per test: swaps the wizard's own store
 * over to the `orders.create`-holding fixture token (minted once, above)
 * immediately before clicking, so this — and only this — request runs under
 * a session that can actually create an order, matching PHASE_10_TASKS.md
 * Workstream E Group 5's real permission split. Every other action in these
 * tests (retailer/customer/super-product setup, catalog reads, quick-create
 * customer) keeps running under `admin`'s own token, untouched.
 */
async function clickPlaceOrder(user: ReturnType<typeof userEvent.setup>, store: EnhancedStore) {
  if (!orderCreatorToken) {
    throw new Error("Expected an orders.create-holding fixture token to have been minted for this file");
  }
  store.dispatch(setToken(orderCreatorToken));
  await user.click(screen.getByRole("button", { name: "Place Order" }));
}

interface RetailerFixture {
  id: string;
  name: string;
  code: string;
}

async function createRetailerFixture(token: string): Promise<RetailerFixture> {
  const suffix = Date.now().toString(36);
  const created = await apiRequest<{ data: { id: string } }>("/retailers", token, {
    method: "POST",
    body: JSON.stringify({ name: `Live Order Retailer ${suffix}`, code: `LOR${suffix}`.toUpperCase() }),
  });
  return { id: created.data.id, name: `Live Order Retailer ${suffix}`, code: `LOR${suffix}`.toUpperCase() };
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

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

/**
 * `labelText` is `^`-anchored, not exact — MUI appends a rendered `" *"`
 * asterisk to a required field's accessible name, same reasoning as
 * `CustomersPage.live.test.tsx`'s identically-named helper (duplicated here
 * rather than shared, given the small scope).
 */
async function selectInCombobox(container: HTMLElement, labelText: string, optionName: string) {
  const combobox = within(container).getByLabelText(new RegExp(`^${labelText}`, "i"));
  await userEvent.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: optionName }));
  await waitForNoOpenListbox();
}

/**
 * Advances past the wizard's Retailer + Customer steps via a fresh
 * quick-created customer, leaving the (now cart-based) Products step active.
 * Returns the created customer's id (looked up by its unique generated name
 * via the same `GET /customers?retailerId=` endpoint `customersApi.ts`'s
 * `listCustomersByRetailer` uses) so callers can track it for cleanup —
 * this wizard's quick-create dialog has no other way to surface the id it
 * was assigned.
 */
async function advancePastRetailerAndCustomer(
  user: ReturnType<typeof userEvent.setup>,
  retailerName: string,
  retailerId: string,
  token: string
): Promise<string> {
  await screen.findByRole("heading", { name: "New Order" });
  await user.click(await screen.findByText(retailerName));
  await user.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByText(new RegExp(`Pick a customer for ${retailerName}`));
  await user.click(screen.getByRole("button", { name: "New Customer" }));
  const dialog = await screen.findByRole("dialog");
  const customerFirstName = `Live Customer ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await user.type(within(dialog).getByLabelText(/^First name/i), customerFirstName);
  await user.type(within(dialog).getByLabelText(/^Last name/i), "Wizard");
  await selectInCombobox(dialog, "Gender", "Male");
  await user.click(within(dialog).getByRole("button", { name: "Create" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  // The customer picker is a real search dropdown (MUI `Autocomplete`, `OrderBuilderPage.tsx`'s
  // own doc comment) — a selected value renders as the search input's *value*, not as page
  // text, so this has to be `findByDisplayValue`, not `findByText`. The display value is the
  // full "First Last" name (`customerName` in `OrderBuilderPage.tsx`), not just the first name —
  // `lastName` is now a required quick-create field (`CustomerFormFields.tsx`), so the created
  // customer always has one.
  await screen.findByDisplayValue(`${customerFirstName} Wizard`);
  await user.click(screen.getByRole("button", { name: "Next" }));

  const customersForRetailer = await apiRequest<{ data: { id: string; firstName: string }[] }>(
    `/customers?retailerId=${retailerId}`,
    token
  );
  const created = customersForRetailer.data.find((customer) => customer.firstName === customerFirstName);
  if (!created) {
    throw new Error(`Expected to find newly quick-created customer "${customerFirstName}" via GET /customers`);
  }
  return created.id;
}

/** The cart's own product-add `<select aria-label="Product">`, per `OrderCartStep.tsx`. */
async function addLineItem(user: ReturnType<typeof userEvent.setup>, superProductName: string) {
  const select = await screen.findByRole("combobox", { name: "Product" });
  await user.selectOptions(select, superProductName);
}

function getLineItemRow(superProductId: string): HTMLElement {
  return screen.getByTestId(`line-item-row-${superProductId}`);
}

async function bumpQuantity(user: ReturnType<typeof userEvent.setup>, superProductId: string, times: number) {
  const row = getLineItemRow(superProductId);
  const plusButton = within(row).getByRole("button", { name: "+" });
  for (let i = 0; i < times; i++) {
    await user.click(plusButton);
  }
}

/**
 * The Measurement/Fabric & Styling panels now take over `OrderCartStep`'s
 * entire rendered output (`OrderCartStep.tsx`) instead of appearing inline
 * below the table — only one can be open at a time, and the product
 * select/table (including every row's Measurement/Fabric & Styling cells)
 * simply doesn't render while a panel is open. Closes whichever panel is
 * currently open, if any, before a caller tries to click a row cell.
 */
async function closeAnyOpenPanel(user: ReturnType<typeof userEvent.setup>) {
  const closeButton = screen.queryByRole("button", { name: "Close" });
  if (!closeButton) return;
  await user.click(closeButton);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument());
}

/** Opens the line item's Group 6 `<LineItemMeasurementsPanel>` (its Measurement cell) and returns the panel's own container (heading + panel, per `OrderCartStep.tsx`'s panel takeover). */
async function openMeasurementsPanel(user: ReturnType<typeof userEvent.setup>, superProductId: string, superProductName: string): Promise<HTMLElement> {
  await closeAnyOpenPanel(user);
  const row = getLineItemRow(superProductId);
  await user.click(within(row).getByTestId("measurement-status"));
  const heading = await screen.findByText(`${superProductName} — Measurements`);
  return heading.closest("div") as HTMLElement;
}

/** Opens the line item's Group 5 `<StylingAccordion>` (its Fabric & Styling cell) and returns the panel's own container. */
async function openStylingPanel(user: ReturnType<typeof userEvent.setup>, superProductId: string, superProductName: string): Promise<HTMLElement> {
  await closeAnyOpenPanel(user);
  const row = getLineItemRow(superProductId);
  await user.click(within(row).getByTestId("styling-status"));
  const heading = await screen.findByText(`${superProductName} — Fabric & Styling`);
  return heading.closest("div") as HTMLElement;
}

/**
 * Only one of Group 6's measurements panel / Group 5's styling accordion is
 * ever mounted at once (this page's single-`focused` "inline, not modal"
 * design, `OrderCartStep.tsx`) — so every component's measurement value is
 * filled in one open-the-panel-once pass, not by reopening the panel per
 * component. `<MeasurementForm>` fetches its own data independently and
 * shows a spinner until it resolves, so this waits (`findAllByRole`, not
 * `getAllByRole`) rather than assuming the inputs are already there the
 * instant the section's heading is.
 *
 * PHASE_9_TASKS.md Group 8: types `value` into **every** "* value" input for
 * the component (`aria-label` ending in " value", excluding the paired
 * "* adjustment"/"* total" inputs `MeasurementForm.tsx` also renders) — the
 * real seeded jacket/pant/vest/shirt products each have several measurement
 * definitions (12/8/5/12, confirmed live), and Group 8's gate
 * (`useLineItemMeasurementsCompleteness`) requires every one of them to
 * resolve to a real total, not just the first. Filling only the first field
 * (this helper's pre-Group-8 behavior) would leave the line item
 * permanently "Missing" and the real "Place Order" button disabled.
 */
async function fillMeasurementValues(
  user: ReturnType<typeof userEvent.setup>,
  panel: HTMLElement,
  entries: [slotLabel: string, value: string][]
) {
  for (const [slotLabel, value] of entries) {
    const heading = within(panel).getByRole("heading", { name: new RegExp(`^${slotLabel}\\b`) });
    const section = heading.closest("div") as HTMLElement;
    const valueInputs = (await within(section).findAllByRole("textbox")).filter((input) =>
      (input.getAttribute("aria-label") ?? "").endsWith(" value")
    );
    for (const input of valueInputs) {
      await user.type(input, value);
    }
  }
}

/**
 * PHASE_9_TASKS.md Group 8: clicks through **every** tab of the component's
 * "Normal styles" bar (`FeatureSelector.tsx`'s `ChoiceTabBar`), picking the
 * first available style/sub-option tile on each — not just the first tab's
 * first style. Group 8's gate (`useLineItemStylingCompleteness`) requires
 * every `isRequired && !isAdditional` choice feature to have a `styleId`
 * selected; the real seeded jacket/pant/vest/shirt each have several such
 * features (10/8/3/6, confirmed live), only one of which is the tab active
 * by default.
 *
 * Only a top-level style pick is required for completeness (the gate checks
 * `styleId`, not `styleOptionId` — a style with sub-options still counts as
 * "selected" once its own tile is clicked, even before any sub-option is
 * chosen), so this only ever needs one click per tab: `<Tab>` elements
 * persist across the whole bar (only the active tab's `<ChoiceFeatureField>`
 * panel content is swapped, `ChoiceTabBar`'s own single-`activeFeature`
 * render), so switching tabs directly (rather than relying on
 * `advanceToNextTab`, which only fires for a *final*, no-sub-options
 * selection) reaches every tab regardless of whether its first style reveals
 * sub-options.
 */
/**
 * A style with no sub-options renders as an image-card button (`aria-pressed`); a style WITH
 * sub-options renders as a plain radio instead (PHASE_10_TASKS.md follow-up — legacy `Options.jsx`'s
 * real shape, `ChoiceFeatureField.tsx`'s own doc comment) — so "pick any unselected style in this
 * tab" has to try both, a tab can be made up entirely of either kind depending on the real
 * catalog data.
 *
 * Scoped to the active tab's own real `role="tabpanel"` (`ChoiceTabBar`'s own doc comment on
 * why it exists), NOT the whole component `section` — `section` also contains sibling inline
 * features rendered unconditionally alongside the tab bar (e.g. Monogram Position/Font Style,
 * which render their own real `role="radio"` elements) that would otherwise be indistinguishable
 * from this tab's actual style choices and get clicked by mistake, confirmed live: without this
 * scoping, a required choice feature whose every style has sub-options (e.g. the real seeded
 * "jacket lapel", where all 5 styles have real sub-options) could end up never receiving a real
 * selection at all, leaving "styling" permanently Missing.
 */
async function selectAnUnselectedStyle(user: ReturnType<typeof userEvent.setup>, section: HTMLElement): Promise<void> {
  const panel = within(section).getByRole("tabpanel");
  const unselectedButtons = within(panel).queryAllByRole("button", { pressed: false });
  if (unselectedButtons.length > 0) {
    await user.click(unselectedButtons[0]!);
    return;
  }
  const uncheckedRadios = within(panel).queryAllByRole("radio", { checked: false });
  if (uncheckedRadios.length > 0) {
    await user.click(uncheckedRadios[0]!);
  }
}

async function completeAllStyleTabs(user: ReturnType<typeof userEvent.setup>, section: HTMLElement) {
  const tabs = within(section).queryAllByRole("tab");
  for (const tab of tabs) {
    await user.click(tab);
    await selectAnUnselectedStyle(user, section);
  }
}

/**
 * Same as `completeAllStyleTabs`, deliberately leaving the *first* tab's
 * choice feature unselected — PHASE_9_TASKS.md Group 8's "one unit's
 * required styling still incomplete" test case. Skips the first tab
 * specifically (not the last): the "Normal styles" bar's tabs are every
 * `isAdditional === false` choice feature, which — confirmed live against
 * the real seeded catalog — includes the optional "Piping" feature seeded
 * *last* in `sequence_order` alongside the real required ones; skipping the
 * last tab would therefore skip only the one feature that's already allowed
 * to be empty, leaving the styling accidentally "complete" and defeating the
 * point of this helper. The first tab, by contrast, is always one of the
 * product's real required features on every real seeded product.
 */
async function completeAllStyleTabsExceptFirst(user: ReturnType<typeof userEvent.setup>, section: HTMLElement) {
  const tabs = within(section).queryAllByRole("tab");
  for (const tab of tabs.slice(1)) {
    await user.click(tab);
    await selectAnUnselectedStyle(user, section);
  }
}

async function fillAllMeasurementValues(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement, value: string) {
  // `findAllByRole` (not the synchronous `getAllByRole`), matching
  // `fillMeasurementValues`'s already-correct approach — PHASE_10_TASKS.md
  // Workstream D Group 3 added a brief loading gate while the customer's
  // measurement profile is fetched, so the inputs aren't necessarily present
  // on the very first render after the panel opens.
  const valueInputs = (await within(panel).findAllByRole("textbox"))
    .filter((input) => (input.getAttribute("aria-label") ?? "").endsWith(" value"));
  for (const input of valueInputs) {
    await user.type(input, value);
  }
  return valueInputs;
}

/**
 * Falls back to the whole panel when the component has no own heading
 * (`ComponentStylingPanel`'s `showHeading` is `false` for a single-component
 * super product, `StylingAccordion.tsx`), where the single component's own
 * tab bar is the only one present anyway.
 */
async function pickFirstStyleForComponents(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement, slotLabels: string[]) {
  for (const slotLabel of slotLabels) {
    const headings = within(panel).queryAllByRole("heading", { name: new RegExp(`^${slotLabel}\\b`) });
    const section = (headings[0]?.closest("div") as HTMLElement) ?? panel;
    await completeAllStyleTabs(user, section);
  }
}

const createdOrderIds: string[] = [];
const createdSuperProductIds: string[] = [];
const createdRetailerIds: string[] = [];
const createdCustomerIds: string[] = [];

/**
 * Every cleanup step below is independent and best-effort by construction
 * (a failure in one must not skip the rest). Failures are logged rather than
 * silently swallowed.
 */
afterAll(async () => {
  if (!seededToken) return;

  try {
    await hardDeleteOrders(createdOrderIds);
  } catch (err) {
    console.error("Failed to hard-delete order fixtures:", err);
  }

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
  for (const id of createdRetailerIds) {
    await apiRequest(`/retailers/${id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete retailer fixture ${id}:`, err)
    );
  }

  if (orderCreatorFixture) {
    await orderCreatorFixture.cleanup().catch((err: unknown) =>
      console.error("Failed to clean up the orders.create fixture user:", err)
    );
  }

  const remaining = await countOrdersByIds(createdOrderIds);
  expect(remaining).toBe(0);
  const activeCustomers = await countActiveCustomersByIds(createdCustomerIds);
  expect(activeCustomers).toBe(0);
});

describe.skipIf(!seededToken)("OrderBuilderPage (live siam/server integration)", () => {
  it(
    "places a real order against a 3-component super product entirely through the cart, with distinct measurements/features per component",
    async () => {
      const token = seededToken as string;
      const products = realProducts as RealProductIds;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const superProduct = await createSuperProductFixture(token, `Live Three-Piece ${Date.now()}`, [
        { productId: products.jacket, slotLabel: "Jacket" },
        { productId: products.pant, slotLabel: "Pant" },
        { productId: products.vest, slotLabel: "Vest" },
      ]);
      createdSuperProductIds.push(superProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore();
      renderWizard(store);

      const customerId = await advancePastRetailerAndCustomer(user, retailer.name, retailer.id, token);
      createdCustomerIds.push(customerId);

      await screen.findByRole("combobox", { name: "Product" });
      await addLineItem(user, superProduct.name);
      const row = await screen.findByTestId(`line-item-row-${superProduct.id}`);
      expect(within(row).getByText(superProduct.name.toUpperCase())).toBeInTheDocument();

      const measurementsPanel = await openMeasurementsPanel(user, superProduct.id, superProduct.name);
      await fillMeasurementValues(user, measurementsPanel, [
        ["Jacket", "42"],
        ["Pant", "34"],
        ["Vest", "40"],
      ]);

      const stylingPanel = await openStylingPanel(user, superProduct.id, superProduct.name);
      await pickFirstStyleForComponents(user, stylingPanel, ["Jacket", "Pant", "Vest"]);

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));

      await screen.findByText("Summary");
      expect(screen.getByText(new RegExp(`${superProduct.name} × 1`))).toBeInTheDocument();

      await clickPlaceOrder(user, store);

      await screen.findByRole("heading", { name: "Order Placed" }, { timeout: 10000 });
      const orderNumberElement = await screen.findByText(new RegExp(`^${retailer.code}-\\d{4}$`));
      const orderNumber = orderNumberElement.textContent as string;

      const orderList = await apiRequest<{ data: { id: string; orderNumber: string }[] }>(
        `/orders?retailerId=${retailer.id}`,
        token
      );
      const createdOrderRef = orderList.data.find((order) => order.orderNumber === orderNumber);
      expect(createdOrderRef).toBeDefined();
      createdOrderIds.push(createdOrderRef!.id);

      const orderDetail = await apiRequest<{
        data: {
          items: {
            superProductId: string;
            components: {
              slotLabel: string;
              productId: string;
              measurements: { value: string | null }[];
              features: { styleId: string | null }[];
            }[];
          }[];
        };
      }>(`/orders/${createdOrderRef!.id}`, token);

      expect(orderDetail.data.items).toHaveLength(1);
      const [item] = orderDetail.data.items;
      expect(item!.superProductId).toBe(superProduct.id);
      expect(item!.components).toHaveLength(3);

      const bySlot = new Map(item!.components.map((component) => [component.slotLabel, component]));
      expect(Number(bySlot.get("Jacket")?.measurements[0]?.value)).toBe(42);
      expect(Number(bySlot.get("Pant")?.measurements[0]?.value)).toBe(34);
      expect(Number(bySlot.get("Vest")?.measurements[0]?.value)).toBe(40);
      expect(bySlot.get("Jacket")?.features[0]?.styleId).toEqual(expect.any(String));
      expect(bySlot.get("Pant")?.features[0]?.styleId).toEqual(expect.any(String));
      expect(bySlot.get("Vest")?.features[0]?.styleId).toEqual(expect.any(String));
    },
    // PHASE_9_TASKS.md Group 8: raised from 45000 — the real gate now requires
    // filling every one of the real jacket/pant/vest products' measurement
    // definitions and clicking through every one of their required choice
    // tabs (10/8/3), not just one field/tab each.
    90000
  );

  it(
    "places a real order against a 1-component super product with the same wizard code, proving no hardcoding to a fixed component count",
    async () => {
      const token = seededToken as string;
      const products = realProducts as RealProductIds;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const superProduct = await createSuperProductFixture(token, `Live Shirt Only ${Date.now()}`, [
        { productId: products.shirt, slotLabel: "Shirt" },
      ]);
      createdSuperProductIds.push(superProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore();
      renderWizard(store);

      const customerId = await advancePastRetailerAndCustomer(user, retailer.name, retailer.id, token);
      createdCustomerIds.push(customerId);

      await addLineItem(user, superProduct.name);
      await screen.findByTestId(`line-item-row-${superProduct.id}`);

      const measurementsPanel = await openMeasurementsPanel(user, superProduct.id, superProduct.name);
      await fillMeasurementValues(user, measurementsPanel, [["Shirt", "16"]]);

      const stylingPanel = await openStylingPanel(user, superProduct.id, superProduct.name);
      await pickFirstStyleForComponents(user, stylingPanel, ["Shirt"]);

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));

      await screen.findByText("Summary");
      expect(screen.getByText(new RegExp(`${superProduct.name} × 1`))).toBeInTheDocument();

      await clickPlaceOrder(user, store);

      await screen.findByRole("heading", { name: "Order Placed" }, { timeout: 10000 });
      const orderNumberElement = await screen.findByText(new RegExp(`^${retailer.code}-\\d{4}$`));
      const orderNumber = orderNumberElement.textContent as string;

      const orderList = await apiRequest<{ data: { id: string; orderNumber: string }[] }>(
        `/orders?retailerId=${retailer.id}`,
        token
      );
      const createdOrderRef = orderList.data.find((order) => order.orderNumber === orderNumber);
      expect(createdOrderRef).toBeDefined();
      createdOrderIds.push(createdOrderRef!.id);

      const orderDetail = await apiRequest<{ data: { items: { components: unknown[] }[] } }>(
        `/orders/${createdOrderRef!.id}`,
        token
      );
      expect(orderDetail.data.items).toHaveLength(1);
      expect(orderDetail.data.items[0]!.components).toHaveLength(1);
    },
    45000
  );

  it(
    "surfaces a real backend validation error (COMPONENT_SET_MISMATCH) clearly instead of swallowing it",
    async () => {
      const token = seededToken as string;
      const products = realProducts as RealProductIds;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const superProduct = await createSuperProductFixture(token, `Live Mismatch Fixture ${Date.now()}`, [
        { productId: products.jacket, slotLabel: "Jacket" },
        { productId: products.pant, slotLabel: "Pant" },
      ]);
      createdSuperProductIds.push(superProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore();
      renderWizard(store);

      const customerId = await advancePastRetailerAndCustomer(user, retailer.name, retailer.id, token);
      createdCustomerIds.push(customerId);

      await addLineItem(user, superProduct.name);
      await screen.findByTestId(`line-item-row-${superProduct.id}`);

      const measurementsPanel = await openMeasurementsPanel(user, superProduct.id, superProduct.name);
      await fillMeasurementValues(user, measurementsPanel, [
        ["Jacket", "42"],
        ["Pant", "34"],
      ]);
      const stylingPanel = await openStylingPanel(user, superProduct.id, superProduct.name);
      await pickFirstStyleForComponents(user, stylingPanel, ["Jacket", "Pant"]);

      // Simulate a concurrent edit the client's already-fetched, in-memory
      // super product can't see: remove the Pant component server-side
      // between selecting the super product and submitting, the same race
      // technique `SuperProductsPage.live.test.tsx` uses for
      // TOO_MANY_COMPONENTS. The wizard still submits both
      // superProductComponentIds it knows about, so the server now sees an
      // unknown one and must reject with a real 422.
      const pantComponent = superProduct.components.find((component) => component.slotLabel === "Pant")!;
      await apiRequest(`/super-products/${superProduct.id}/components/${pantComponent.id}`, token, {
        method: "DELETE",
      });

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Summary");
      await clickPlaceOrder(user, store);

      const errorAlert = await screen.findByText(/does not match super product.*defined components/i, undefined, {
        timeout: 10000,
      });
      expect(errorAlert).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Order Placed" })).not.toBeInTheDocument();

      // Confirm no order was actually created despite the failed submission.
      await waitForNoOpenListbox().catch(() => {});
      const orderList = await apiRequest<{ data: { id: string }[] }>(`/orders?retailerId=${retailer.id}`, token);
      expect(orderList.data).toHaveLength(0);
    },
    // PHASE_9_TASKS.md Group 8: raised from 30000 for the same reason as the
    // 3-component test above — the real gate requires this fixture's jacket
    // (10 tabs) and pant (8 tabs) to actually be fully filled before the real
    // "Place Order" button is even clickable, not just "enough to reach the
    // Review step."
    60000
  );

  it(
    "PHASE_9_TASKS.md Group 7: 2 line items (qty 1 + qty 3) submit as exactly 4 real order_items — the qty-3 line item's units share byte-identical measurements/measurementNote/Shoulder-Type but have independently distinct styling",
    async () => {
      const token = seededToken as string;
      const products = realProducts as RealProductIds;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const jacketSuperProduct = await createSuperProductFixture(token, `Live Cart Jacket ${Date.now()}`, [
        { productId: products.jacket, slotLabel: "Jacket" },
      ]);
      createdSuperProductIds.push(jacketSuperProduct.id);
      const shirtSuperProduct = await createSuperProductFixture(token, `Live Cart Shirt ${Date.now()}`, [
        { productId: products.shirt, slotLabel: "Shirt" },
      ]);
      createdSuperProductIds.push(shirtSuperProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore();
      renderWizard(store);

      const customerId = await advancePastRetailerAndCustomer(user, retailer.name, retailer.id, token);
      createdCustomerIds.push(customerId);

      // Add both line items.
      await addLineItem(user, jacketSuperProduct.name);
      await screen.findByTestId(`line-item-row-${jacketSuperProduct.id}`);
      await addLineItem(user, shirtSuperProduct.name);
      await screen.findByTestId(`line-item-row-${shirtSuperProduct.id}`);

      // Bump the jacket line item to quantity 3; leave shirt at the default quantity 1.
      await bumpQuantity(user, jacketSuperProduct.id, 2);
      const jacketRow = getLineItemRow(jacketSuperProduct.id);
      expect(within(jacketRow).getByText("3")).toBeInTheDocument();
      const shirtRow = getLineItemRow(shirtSuperProduct.id);
      expect(within(shirtRow).getByText("1")).toBeInTheDocument();

      // Fill the jacket line item's ONE shared Measurements panel: every real
      // measurement value, a measurement note, and a Shoulder Type selection —
      // this is Decision 3's shared draft, entered exactly once regardless of quantity.
      const jacketMeasurementNote = `Shared jacket note ${Date.now()}`;
      {
        const panel = await openMeasurementsPanel(user, jacketSuperProduct.id, jacketSuperProduct.name);
        const valueInputs = (await within(panel).findAllByRole("textbox"))
          .filter((input) => (input.getAttribute("aria-label") ?? "").endsWith(" value"));
        expect(valueInputs.length).toBeGreaterThan(0);
        for (const input of valueInputs) {
          await user.type(input, "42");
        }
        const noteField = within(panel).getByLabelText(/^note$/i);
        await user.type(noteField, jacketMeasurementNote);
        const shoulderRadios = within(panel).getAllByRole("radio");
        expect(shoulderRadios.length).toBeGreaterThan(0);
        await user.click(shoulderRadios[0]!);
        await waitFor(() => expect(shoulderRadios[0]).toBeChecked());
      }

      // Fill the jacket line item's 3 independent per-unit Styling accordions
      // with a distinct "fabric" text value each — Decision 3's per-unit draft.
      const jacketFabricValues = ["JACKET-UNIT0-FABRIC", "JACKET-UNIT1-FABRIC", "JACKET-UNIT2-FABRIC"];
      {
        await openStylingPanel(user, jacketSuperProduct.id, jacketSuperProduct.name);
        for (let unitIndex = 0; unitIndex < 3; unitIndex++) {
          if (unitIndex > 0) {
            const summaryButton = screen.getByRole("button", { name: new RegExp(`Item ${unitIndex + 1}\\b`) });
            await user.click(summaryButton);
            await screen.findByText(`Summary — Item ${unitIndex + 1}`);
          }
          const unitContent = document.getElementById(`unit-${unitIndex}-content`) as HTMLElement;
          const fabricInput = await within(unitContent).findByLabelText(/^fabric$/i);
          await user.type(fabricInput, jacketFabricValues[unitIndex]!);
          await waitFor(() => expect(fabricInput).toHaveValue(jacketFabricValues[unitIndex]));
          // PHASE_9_TASKS.md Group 8: also satisfy every required, non-additional
          // choice feature on this unit (jacket lapel/front button/.../button,
          // 10 real ones) — otherwise this unit stays "styling incomplete" and
          // the real Place Order gate below stays disabled.
          await completeAllStyleTabs(user, unitContent);
        }
      }

      // Fill the shirt line item (quantity 1) — a real, distinct second line
      // item in the same order, and (PHASE_9_TASKS.md Group 8) filled
      // completely enough that it doesn't itself block the real Place Order
      // gate below (which requires every line item to be complete, not just
      // the one under this test's own focus).
      {
        const panel = await openMeasurementsPanel(user, shirtSuperProduct.id, shirtSuperProduct.name);
        const valueInputs = (await within(panel).findAllByRole("textbox"))
          .filter((input) => (input.getAttribute("aria-label") ?? "").endsWith(" value"));
        expect(valueInputs.length).toBeGreaterThan(0);
        for (const input of valueInputs) {
          await user.type(input, "16");
        }
      }
      {
        const panel = await openStylingPanel(user, shirtSuperProduct.id, shirtSuperProduct.name);
        const fabricInput = await within(panel).findByLabelText(/^fabric$/i);
        await user.type(fabricInput, "SHIRT-FABRIC");
        await completeAllStyleTabs(user, panel);
      }

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Summary");
      expect(screen.getByText(new RegExp(`${jacketSuperProduct.name} × 3`))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`${shirtSuperProduct.name} × 1`))).toBeInTheDocument();

      await clickPlaceOrder(user, store);
      await screen.findByRole("heading", { name: "Order Placed" }, { timeout: 15000 });
      const orderNumberElement = await screen.findByText(new RegExp(`^${retailer.code}-\\d{4}$`));
      const orderNumber = orderNumberElement.textContent as string;

      const orderList = await apiRequest<{ data: { id: string; orderNumber: string }[] }>(
        `/orders?retailerId=${retailer.id}`,
        token
      );
      const createdOrderRef = orderList.data.find((order) => order.orderNumber === orderNumber);
      expect(createdOrderRef).toBeDefined();
      createdOrderIds.push(createdOrderRef!.id);

      interface DetailComponent {
        slotLabel: string;
        productId: string;
        measurementNote: string | null;
        measurements: { measurementDefinitionId: string; value: string | null; adjustmentValue: string | null; totalValue: string | null }[];
        features: { featureId: string; styleId: string | null; textValue: string | null }[];
      }
      interface DetailItem {
        superProductId: string;
        components: DetailComponent[];
      }
      const orderDetail = await apiRequest<{ data: { items: DetailItem[] } }>(`/orders/${createdOrderRef!.id}`, token);

      // Exactly 4 real order_items rows total: 3 for the jacket line item, 1 for the shirt.
      expect(orderDetail.data.items).toHaveLength(4);
      const jacketItems = orderDetail.data.items.filter((i) => i.superProductId === jacketSuperProduct.id);
      const shirtItems = orderDetail.data.items.filter((i) => i.superProductId === shirtSuperProduct.id);
      expect(jacketItems).toHaveLength(3);
      expect(shirtItems).toHaveLength(1);
      for (const item of jacketItems) expect(item.components).toHaveLength(1);
      for (const item of shirtItems) expect(item.components).toHaveLength(1);

      const jacketComponents = jacketItems.map((item) => item.components[0]!);

      // Byte-identical shared measurements + measurementNote across all 3 sibling units.
      function measurementSnapshot(component: DetailComponent): string {
        return JSON.stringify(
          [...component.measurements]
            .sort((a, b) => a.measurementDefinitionId.localeCompare(b.measurementDefinitionId))
            .map((m) => ({
              measurementDefinitionId: m.measurementDefinitionId,
              value: m.value,
              adjustmentValue: m.adjustmentValue,
              totalValue: m.totalValue,
            }))
        );
      }
      const measurementSnapshots = jacketComponents.map(measurementSnapshot);
      expect(new Set(measurementSnapshots).size).toBe(1);
      expect(jacketComponents.every((c) => c.measurements.length > 0)).toBe(true);
      expect(jacketComponents.every((c) => c.measurementNote === jacketMeasurementNote)).toBe(true);

      // Byte-identical shared Shoulder Type selection across all 3 sibling units.
      const jacketFeaturesRes = await apiRequest<{ data: { id: string; name: string; renderSlot: string | null }[] }>(
        `/features?productId=${products.jacket}`,
        token
      );
      const shoulderTypeFeature = jacketFeaturesRes.data.find((f) => f.renderSlot === "shoulder_type");
      if (!shoulderTypeFeature) throw new Error("Expected the real seeded Shoulder Type feature on jacket");
      const shoulderSelections = jacketComponents.map(
        (c) => c.features.find((f) => f.featureId === shoulderTypeFeature.id)?.styleId
      );
      expect(shoulderSelections.every((s) => s !== undefined && s === shoulderSelections[0])).toBe(true);
      expect(shoulderSelections[0]).toEqual(expect.any(String));

      // Independently distinct per-unit styling: the "fabric" text feature value differs per unit.
      const fabricFeature = jacketFeaturesRes.data.find((f) => f.name.toLowerCase() === "fabric");
      if (!fabricFeature) throw new Error("Expected the real seeded fabric feature on jacket");
      const fabricValues = jacketComponents.map((c) => c.features.find((f) => f.featureId === fabricFeature.id)?.textValue);
      expect(new Set(fabricValues).size).toBe(3);
      expect(new Set(fabricValues)).toEqual(new Set(jacketFabricValues));
    },
    // PHASE_9_TASKS.md Group 8: raised from 60000 — this test now also
    // clicks through every required choice tab on all 3 jacket units plus
    // the shirt unit (the real gate requires it) on top of its existing
    // real-network-round-trip-heavy setup.
    150000
  );

  it(
    "measurements are never required one-by-one: Place Order enables once required styling is done even with every measurement left blank, and blank measurements submit as real '0' rows, not omitted",
    async () => {
      const token = seededToken as string;
      const products = realProducts as RealProductIds;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      // Vest: the leanest real seeded product (5 measurements, 3 required
      // choice features, no Shoulder Type/Monogram Position render-slot
      // features) — enough to prove the gate rule without jacket's much
      // larger real catalog slowing this test down for no extra coverage.
      const superProduct = await createSuperProductFixture(token, `Live Gate Vest ${Date.now()}`, [
        { productId: products.vest, slotLabel: "Vest" },
      ]);
      createdSuperProductIds.push(superProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore();
      renderWizard(store);

      const customerId = await advancePastRetailerAndCustomer(user, retailer.name, retailer.id, token);
      createdCustomerIds.push(customerId);

      await addLineItem(user, superProduct.name);
      await screen.findByTestId(`line-item-row-${superProduct.id}`);

      // Nothing filled in yet: Place Order must be disabled (styling is
      // incomplete) and the incomplete-line-items warning must name this
      // product. Measurements being blank plays no part in this — confirmed
      // below, once styling alone is finished and the gate still enables.
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Summary");
      let placeOrderButton = screen.getByRole("button", { name: "Place Order" });
      expect(placeOrderButton).toBeDisabled();
      expect(await screen.findByTestId("incomplete-line-items-warning")).toHaveTextContent(superProduct.name);

      // Back to the Products step — `OrderCartStep` (and the measurement/
      // styling panels it hosts) only mounts there, not on the Review step.
      await user.click(screen.getByRole("button", { name: "Back" }));

      // Complete ALL required styling for the one real unit, and deliberately
      // leave the shared measurement entry completely untouched — a product
      // can have 10+ measurement points, and requiring every one to be
      // filled before an order can be placed is exactly the friction this
      // group's gate rule was changed to remove (real product decision, not
      // a legacy-parity bug). The gate must now enable on styling alone.
      const measurementsPanel = await openMeasurementsPanel(user, superProduct.id, superProduct.name);
      // Confirm real measurement fields are actually present (so "left
      // blank" below is a meaningful assertion, not vacuously true because
      // the panel had nothing to fill in the first place). `findAllByLabelText`
      // (not the synchronous `getAllByLabelText`) — PHASE_10_TASKS.md Workstream
      // D Group 3 added a brief loading gate here while the customer's
      // measurement profile is fetched, so the fields aren't necessarily
      // present on the very first render after the panel opens.
      const valueInputs = await within(measurementsPanel).findAllByLabelText(/value$/i, {}, { timeout: 10000 });
      expect(valueInputs.length).toBeGreaterThan(0);

      const stylingPanel = await openStylingPanel(user, superProduct.id, superProduct.name);
      await completeAllStyleTabs(user, stylingPanel);

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Summary");
      placeOrderButton = screen.getByRole("button", { name: "Place Order" });
      expect(placeOrderButton).toBeEnabled();

      await clickPlaceOrder(user, store);
      await screen.findByRole("heading", { name: "Order Placed" }, { timeout: 10000 });
      const orderNumberElement = await screen.findByText(new RegExp(`^${retailer.code}-\\d{4}$`));
      const orderNumber = orderNumberElement.textContent as string;

      const orderList = await apiRequest<{ data: { id: string; orderNumber: string }[] }>(
        `/orders?retailerId=${retailer.id}`,
        token
      );
      const createdOrderRef = orderList.data.find((order) => order.orderNumber === orderNumber);
      expect(createdOrderRef).toBeDefined();
      createdOrderIds.push(createdOrderRef!.id);

      // The real proof of the "automatically 0" behavior: the order's
      // recorded measurements aren't omitted just because the user never
      // touched them — every one of the vest's real linked measurement
      // definitions has an explicit "0" row.
      interface DetailComponent {
        measurements: { measurementDefinitionId: string; value: string | null; adjustmentValue: string | null; totalValue: string | null }[];
      }
      interface DetailItem {
        components: DetailComponent[];
      }
      const orderDetail = await apiRequest<{ data: { items: DetailItem[] } }>(`/orders/${createdOrderRef!.id}`, token);
      const component = orderDetail.data.items[0]?.components[0];
      expect(component).toBeDefined();
      const vestMeasurementLinks = await apiRequest<{ data: { measurementDefinitionId: string }[] }>(
        `/products/${products.vest}/measurements`,
        token
      );
      expect(component!.measurements).toHaveLength(vestMeasurementLinks.data.length);
      // `numeric(10,2)` columns round-trip as "0.00", not "0" — checking the
      // numeric value (not the exact string) is what actually matters here.
      expect(component!.measurements.every((m) => Number(m.value) === 0 && Number(m.adjustmentValue) === 0)).toBe(
        true
      );
    },
    90000
  );

  it(
    "PHASE_9_TASKS.md Group 8: a complete shared measurement entry with one unit's required styling left incomplete still blocks Place Order",
    async () => {
      const token = seededToken as string;
      const products = realProducts as RealProductIds;

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);
      const superProduct = await createSuperProductFixture(token, `Live Gate Vest Partial ${Date.now()}`, [
        { productId: products.vest, slotLabel: "Vest" },
      ]);
      createdSuperProductIds.push(superProduct.id);

      const user = userEvent.setup();
      const store = buildTestStore();
      renderWizard(store);

      const customerId = await advancePastRetailerAndCustomer(user, retailer.name, retailer.id, token);
      createdCustomerIds.push(customerId);

      await addLineItem(user, superProduct.name);
      await screen.findByTestId(`line-item-row-${superProduct.id}`);

      const measurementsPanel = await openMeasurementsPanel(user, superProduct.id, superProduct.name);
      const valueInputs = await fillAllMeasurementValues(user, measurementsPanel, "38");
      expect(valueInputs.length).toBeGreaterThan(0);

      const stylingPanel = await openStylingPanel(user, superProduct.id, superProduct.name);
      await completeAllStyleTabsExceptFirst(user, stylingPanel);

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Summary");

      const placeOrderButton = screen.getByRole("button", { name: "Place Order" });
      expect(placeOrderButton).toBeDisabled();
      expect(await screen.findByTestId("incomplete-line-items-warning")).toHaveTextContent(superProduct.name);

      // A real block, not just a visual affordance: MUI sets `pointer-events:
      // none` on a disabled button, so `userEvent`'s real pointer-interaction
      // check refuses to even fire the click (confirmed by this `rejects`
      // assertion, not assumed) — and confirm independently, via the real
      // backend, that no order exists for this retailer either way.
      await expect(user.click(placeOrderButton)).rejects.toThrow(/pointer-events: none/);
      expect(screen.queryByRole("heading", { name: "Order Placed" })).not.toBeInTheDocument();
      const orderList = await apiRequest<{ data: { id: string }[] }>(`/orders?retailerId=${retailer.id}`, token);
      expect(orderList.data).toHaveLength(0);

      // Now complete the last tab too — the gate must flip to enabled and
      // the order must actually submit. `stylingPanel`'s own DOM nodes are
      // stale (`OrderCartStep` only mounts on the Products step, and "Next"
      // above unmounted it), so this navigates back and re-opens a fresh one
      // rather than reusing the old reference.
      await user.click(screen.getByRole("button", { name: "Back" }));
      const stylingPanelAgain = await openStylingPanel(user, superProduct.id, superProduct.name);
      await completeAllStyleTabs(user, stylingPanelAgain);

      await closeAnyOpenPanel(user);
      await user.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Summary");
      await waitFor(() => expect(screen.getByRole("button", { name: "Place Order" })).toBeEnabled());
      await clickPlaceOrder(user, store);

      await screen.findByRole("heading", { name: "Order Placed" }, { timeout: 10000 });
      const orderNumberElement = await screen.findByText(new RegExp(`^${retailer.code}-\\d{4}$`));
      const orderNumber = orderNumberElement.textContent as string;
      const orderList2 = await apiRequest<{ data: { id: string; orderNumber: string }[] }>(
        `/orders?retailerId=${retailer.id}`,
        token
      );
      const createdOrderRef = orderList2.data.find((order) => order.orderNumber === orderNumber);
      expect(createdOrderRef).toBeDefined();
      createdOrderIds.push(createdOrderRef!.id);
    },
    90000
  );
});
