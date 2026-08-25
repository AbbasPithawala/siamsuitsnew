import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { InvoicesPage } from "./InvoicesPage";

/**
 * Integration test against a real, running `siam/server` (not mocked),
 * mirroring `RetailersPage.live.test.tsx`/`PayrollSettlementPage.live.test.tsx`'s
 * pattern. This is PHASE_6_TASKS.md Group 9's headline acceptance test:
 * create a real invoice against a real retailer with real line items,
 * confirm it appears in the list with the server-computed total (never
 * summed client-side), then mark it paid and confirm the status updates —
 * entirely through the UI.
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
      <InvoicesPage />
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdRetailerIds: string[] = [];
const createdInvoiceIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  const token = seededToken;

  const { hardDeleteInvoices, countInvoicesByIds } = await import("./testSupport/invoiceDbCleanup");
  await hardDeleteInvoices(createdInvoiceIds).catch((err) => console.error("Failed to hard-delete invoice fixtures:", err));

  for (const id of createdRetailerIds) {
    await apiRequest(`/retailers/${id}`, token, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete retailer fixture ${id}:`, err)
    );
  }

  const remaining = await countInvoicesByIds(createdInvoiceIds);
  expect(remaining).toBe(0);
});

describe.skipIf(!seededToken)("InvoicesPage (live siam/server integration)", () => {
  it(
    "creates a real invoice for a real retailer with real line items, showing the server-computed total, then marks it paid",
    async () => {
      const token = seededToken as string;
      const user = userEvent.setup();
      const suffix = Date.now().toString(36);

      const retailerName = `Live Invoice Retailer ${suffix}`;
      const retailerCode = `LIV-${suffix}`.toUpperCase();
      const retailer = await apiRequest<{ data: { id: string; code: string } }>("/retailers", token, {
        method: "POST",
        body: JSON.stringify({ name: retailerName, code: retailerCode }),
      });
      createdRetailerIds.push(retailer.data.id);

      renderPage();

      await screen.findByRole("heading", { name: "Invoices" });

      await user.click(screen.getByRole("button", { name: "Create Invoice" }));
      const dialog = await screen.findByRole("dialog");

      await user.click(within(dialog).getByLabelText(/^Retailer/));
      const retailerListbox = await screen.findByRole("listbox");
      await user.click(within(retailerListbox).getByRole("option", { name: retailerName }));

      const descriptionInputs = () => within(dialog).getAllByLabelText(/^Description/);
      const quantityInputs = () => within(dialog).getAllByLabelText(/^Quantity/);
      const unitPriceInputs = () => within(dialog).getAllByLabelText(/^Unit price/);

      await user.type(descriptionInputs()[0]!, "Bespoke jacket");
      await user.clear(quantityInputs()[0]!);
      await user.type(quantityInputs()[0]!, "2");
      await user.type(unitPriceInputs()[0]!, "10");

      await user.click(within(dialog).getByRole("button", { name: "Add line item" }));
      await user.type(descriptionInputs()[1]!, "Alterations");
      await user.clear(quantityInputs()[1]!);
      await user.type(quantityInputs()[1]!, "1");
      await user.type(unitPriceInputs()[1]!, "5");

      await user.type(within(dialog).getByLabelText("Discount"), "5");
      await user.type(within(dialog).getByLabelText("Shipping charge"), "3");

      // subTotal = 2*10 + 1*5 = 25; total = 25 - 5 (discount) + 3 (shipping) = 23.
      await user.click(within(dialog).getByRole("button", { name: "Create Invoice" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      const invoiceNumber = `${retailerCode}-INV-0001`;
      const row = (await screen.findByText(invoiceNumber, {}, NETWORK_WAIT)).closest("tr");
      expect(row).not.toBeNull();
      await within(row as HTMLElement).findByText("THB 23.00", {}, NETWORK_WAIT);
      await within(row as HTMLElement).findByText("Unpaid", {}, NETWORK_WAIT);

      const serverList = await apiRequest<{ data: { id: string; invoiceNumber: string; total: string }[] }>(
        `/invoices?retailerId=${retailer.data.id}`,
        token
      );
      const created = serverList.data.find((inv) => inv.invoiceNumber === invoiceNumber);
      expect(created).toBeDefined();
      if (!created) return;
      createdInvoiceIds.push(created.id);
      expect(created.total).toBe("23.00");

      // View line items dialog shows the server-computed per-line amounts.
      await user.click(within(row as HTMLElement).getByRole("button", { name: `View ${invoiceNumber}` }));
      const viewDialog = await screen.findByRole("dialog");
      await within(viewDialog).findByText("Bespoke jacket");
      await within(viewDialog).findByText("THB 20.00");
      const alterationsRow = (await within(viewDialog).findByText("Alterations")).closest("tr");
      expect(alterationsRow).not.toBeNull();
      await within(alterationsRow as HTMLElement).findByText("THB 5.00");
      await user.click(within(viewDialog).getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), NETWORK_WAIT);

      // Mark paid.
      await user.click(within(row as HTMLElement).getByRole("button", { name: `Mark ${invoiceNumber} paid` }));
      await within(row as HTMLElement).findByText("Paid", {}, NETWORK_WAIT);
      expect(within(row as HTMLElement).queryByRole("button", { name: `Mark ${invoiceNumber} paid` })).not.toBeInTheDocument();

      const afterPaid = await apiRequest<{ data: { status: string } }>(`/invoices/${created.id}`, token);
      expect(afterPaid.data.status).toBe("Paid");
    },
    45000
  );
});
