import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { CustomersPage } from "./CustomersPage";
import { useListCustomersByRetailerQuery } from "./customersApi";
import { countActiveCustomersByIds, countActiveRetailersByIds } from "./testSupport/customerDbCheck";
import {
  clickNextPage,
  getFirstDataRowText,
  getPaginationRangeText,
  parsePaginationTotal,
  waitForFirstDataRowChange,
  waitForRangeText,
} from "../../testSupport/paginationTestHelpers";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `RetailersPage.live.test.tsx`'s/`TailorsPage.live.test.tsx`'s
 * pattern. Covers PHASE_6_TASKS.md Group 5's Customers screen: create/edit/
 * deactivate through the UI, filterable by retailer, plus the acceptance
 * criterion that a customer created here is immediately usable in the
 * order-builder wizard's customer picker — proven below by mounting
 * `useListCustomersByRetailerQuery` (the exact hook `OrderBuilderPage.tsx`
 * uses) alongside `CustomersPage` in the same store and watching it pick up
 * the new customer via the shared `Customer`/`LIST` RTK Query tag.
 *
 * Fixture naming embeds both a timestamp and a random suffix (not just
 * `Date.now()`) per this project's post-incident standard: prior live tests'
 * fixture names collided closely enough to produce ambiguous `getByText`
 * matches across unrelated test runs. Cleanup is verified with a direct DB
 * query (`customerDbCheck.ts`), not just a successful-looking `DELETE` call.
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

interface RetailerFixture {
  id: string;
  name: string;
  code: string;
}

async function createRetailerFixture(token: string): Promise<RetailerFixture> {
  const suffix = uniqueSuffix();
  const name = `Live Customer Retailer ${suffix}`;
  const code = `LCR-${suffix}`.toUpperCase();
  const created = await apiRequest<{ data: { id: string } }>("/retailers", token, {
    method: "POST",
    body: JSON.stringify({ name, code }),
  });
  return { id: created.data.id, name, code };
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

/**
 * Stands in for the order-builder wizard's own customer step: mounts the
 * exact `useListCustomersByRetailerQuery(retailerId)` hook `OrderBuilderPage.tsx`
 * uses, in the same Redux store as `CustomersPage`. Both queries share the
 * `Customer`/`LIST` RTK Query tag, so creating a customer through
 * `CustomersPage`'s UI invalidates and auto-refetches this probe too,
 * without any manual re-fetch — proving the "same underlying data, two
 * entry points" connection live, not just via two separate raw fetches.
 */
function WizardCustomerListProbe({ retailerId }: { retailerId: string }) {
  const { data } = useListCustomersByRetailerQuery(retailerId);
  return <pre data-testid="wizard-customer-probe">{JSON.stringify(data ?? [])}</pre>;
}

function renderPageWithWizardProbe(retailerId: string) {
  const store = buildTestStore();
  return render(
    <Provider store={store}>
      <CustomersPage />
      <WizardCustomerListProbe retailerId={retailerId} />
    </Provider>
  );
}

async function waitForNoOpenListbox() {
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

/**
 * `labelText` is matched with a `^`-anchored regex, not an exact string —
 * MUI appends a rendered `" *"` asterisk to a required field's accessible
 * name (see `customer-retailer-label`'s DOM: "Retailer" + a separate
 * asterisk `<span>`), so an exact-string `getByLabelText("Retailer")` never
 * matches. Same fix as `RetailersPage.live.test.tsx`'s `/^Name/i`-style
 * label matchers throughout this codebase's live tests.
 */
async function selectInCombobox(container: HTMLElement, labelText: string, optionName: string) {
  const combobox = within(container).getByLabelText(new RegExp(`^${labelText}`, "i"));
  await userEvent.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: optionName }));
  await waitForNoOpenListbox();
}

const NETWORK_WAIT = { timeout: 10000 };

const createdRetailerIds: string[] = [];
const createdCustomerIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

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

  const activeCustomers = await countActiveCustomersByIds(createdCustomerIds);
  expect(activeCustomers).toBe(0);
  const activeRetailers = await countActiveRetailersByIds(createdRetailerIds);
  expect(activeRetailers).toBe(0);
});

describe.skipIf(!seededToken)("CustomersPage (live siam/server integration)", () => {
  it(
    "creates, edits, and deactivates a real customer through the UI, immediately visible to the order-builder wizard's customer query",
    async () => {
      const token = seededToken as string;
      const user = userEvent.setup();

      const retailer = await createRetailerFixture(token);
      createdRetailerIds.push(retailer.id);

      const suffix = uniqueSuffix();
      const firstName = `LiveCust-${suffix}`;
      const lastName = `Tester-${suffix}`;

      renderPageWithWizardProbe(retailer.id);

      await screen.findByRole("heading", { name: "Customers" });

      // Filter by the fixture retailer via the "filter by retailer" dropdown.
      await selectInCombobox(document.body, "Filter by retailer", retailer.name);
      await screen.findByText("No customers yet.");

      await user.click(screen.getByRole("button", { name: "Add Customer" }));
      let dialog = await screen.findByRole("dialog");
      await selectInCombobox(dialog, "Retailer", retailer.name);
      await user.type(within(dialog).getByLabelText(/^First name/i), firstName);
      await user.type(within(dialog).getByLabelText(/^Last name/i), lastName);
      await selectInCombobox(dialog, "Gender", "Female");
      await user.type(within(dialog).getByLabelText(/^Contact number/i), "555-0100");
      await user.click(within(dialog).getByRole("button", { name: "Add Customer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const fullName = `${firstName} ${lastName}`;
      await screen.findByText(fullName, {}, NETWORK_WAIT);

      const listAfterCreate = await apiRequest<{ data: { id: string; firstName: string }[] }>(
        `/customers?retailerId=${retailer.id}`,
        token
      );
      const created = listAfterCreate.data.find((c) => c.firstName === firstName);
      expect(created).toBeDefined();
      if (!created) return;
      createdCustomerIds.push(created.id);

      // The order-builder wizard's own query hook, mounted alongside this
      // page, should pick up the new customer via the shared invalidation
      // tag without any manual action here.
      await waitFor(
        () => expect(screen.getByTestId("wizard-customer-probe").textContent).toContain(created.id),
        NETWORK_WAIT
      );

      let row = screen.getByText(fullName).closest("tr");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText("Female")).toBeInTheDocument();

      // Edit: change last name, gender, and contact number.
      await user.click(screen.getByRole("button", { name: `Edit ${fullName}` }));
      dialog = await screen.findByRole("dialog");
      const newLastName = `Edited-${suffix}`;
      const lastNameField = within(dialog).getByLabelText(/^Last name/i);
      await user.clear(lastNameField);
      await user.type(lastNameField, newLastName);
      await selectInCombobox(dialog, "Gender", "Other");
      await user.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const editedFullName = `${firstName} ${newLastName}`;
      await screen.findByText(editedFullName, {}, NETWORK_WAIT);
      row = screen.getByText(editedFullName).closest("tr");
      expect(within(row as HTMLElement).getByText("Other")).toBeInTheDocument();

      const serverDetail = await apiRequest<{ data: { lastName: string | null; gender: string | null } }>(
        `/customers/${created.id}`,
        token
      );
      expect(serverDetail.data.lastName).toBe(newLastName);
      expect(serverDetail.data.gender).toBe("Other");

      // Deactivate (soft-delete) via the Delete action.
      await user.click(screen.getByRole("button", { name: `Delete ${editedFullName}` }));
      const confirmDialog = await screen.findByRole("dialog");
      await user.click(within(confirmDialog).getByRole("button", { name: "Yes" }));
      await waitFor(() => expect(screen.queryByText(editedFullName)).not.toBeInTheDocument(), NETWORK_WAIT);

      await expect(apiRequest(`/customers/${created.id}`, token)).rejects.toThrow(/404/);
    },
    45000
  );

  it(
    "paginates the unfiltered customer list against real, already-seeded data (PHASE_10_TASKS.md Workstream C Group 4)",
    async () => {
      const token = seededToken as string;
      const user = userEvent.setup();

      // `customers` is a mandatory-pagination entity (PHASE_10_TASKS.md Workstream C) with a
      // real, already-large seeded/fixture count from prior phases' ETL and other live tests
      // — comfortably over the default pageSize=25, so no new fixtures are needed here.
      const store = configureStore({
        reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: (state: AuthTokenSliceState["auth"] = { token: seededToken }) => state },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
      });
      render(
        <Provider store={store}>
          <CustomersPage />
        </Provider>
      );

      await screen.findByRole("heading", { name: "Customers" });
      await waitForRangeText(/of \d+/);
      const total = parsePaginationTotal(getPaginationRangeText());
      expect(total).toBeGreaterThan(25);
      expect(getPaginationRangeText()).toMatch(/1.*25 of \d+/);

      const firstPageFirstRowText = getFirstDataRowText();

      await clickNextPage(user);
      await waitForRangeText(/26.*50 of \d+/);
      // The range text updates synchronously on click (local pagination
      // state) — it doesn't prove the real page-2 request has resolved yet.
      // Waiting for the row content to genuinely change is the real signal.
      await waitForFirstDataRowChange(firstPageFirstRowText);

      const tableAfter = screen.getByRole("table");
      const secondPageFirstRowText = within(tableAfter).getAllByRole("row")[1]?.textContent;
      expect(secondPageFirstRowText).not.toBe(firstPageFirstRowText);

      // Real request proof, not just UI state: `GET /customers?page=2&pageSize=25` returns a
      // genuinely different slice than page 1.
      const page1 = await apiRequest<{ data: { id: string }[] }>("/customers?page=1&pageSize=25", token);
      const page2 = await apiRequest<{ data: { id: string }[] }>("/customers?page=2&pageSize=25", token);
      const page1Ids = new Set(page1.data.map((c) => c.id));
      expect(page2.data.every((c) => !page1Ids.has(c.id))).toBe(true);
    },
    20000
  );
});
