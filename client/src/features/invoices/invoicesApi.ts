import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/services/invoices.service.ts`'s `INVOICE_STATUSES` —
 * the only two states an invoice ever transitions between (`updateInvoiceStatus`
 * rejects re-applying the current status with a 409, see that function's doc
 * comment).
 */
export const INVOICE_STATUSES = ["Unpaid", "Paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** A resolved line item as the server returns it — `amount` is always server-computed (`resolveLineItems` in `invoices.service.ts`), never sent by the client. */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: string;
}

/** Mirrors `server/src/db/schema/invoicing.ts`'s `retailer_invoices` table. */
export interface Invoice {
  id: string;
  retailerId: string;
  invoiceNumber: string;
  lineItems: InvoiceLineItem[];
  discount: string;
  shippingCharge: string;
  total: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  retailerId: string;
  lineItems: LineItemInput[];
  discount?: number;
  shippingCharge?: number;
}

export interface ListInvoicesFilter {
  retailerId?: string;
  status?: string;
}

interface InvoiceResponseEnvelope {
  data: Invoice;
}

interface InvoiceListResponseEnvelope {
  data: Invoice[];
}

function listInvoicesQuery(filter: ListInvoicesFilter | void): string {
  const params = new URLSearchParams();
  if (filter?.retailerId) params.set("retailerId", filter.retailerId);
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return qs ? `/invoices?${qs}` : "/invoices";
}

export type PaginatedInvoicesListArgs = ListInvoicesFilter & PaginationQueryParams;

function listInvoicesPaginatedQuery(args: PaginatedInvoicesListArgs): string {
  const params = new URLSearchParams();
  if (args.retailerId) params.set("retailerId", args.retailerId);
  if (args.status) params.set("status", args.status);
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/invoices?${qs}` : "/invoices";
}

/**
 * PHASE_6_TASKS.md Group 9 — invoicing UI, against Group 1's
 * `invoices.service.ts`/`invoices.routes.ts`. `total`/`lineItems[].amount`
 * are always the server's numbers (never summed client-side, this
 * codebase's hard financial-totals rule); this file only ever sends the raw
 * `description`/`quantity`/`unitPrice` a line item needs plus the overall
 * `discount`/`shippingCharge`, same input shape `createInvoiceSchema` in
 * `invoices.routes.ts` validates.
 */
export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listInvoices: builder.query<Invoice[], ListInvoicesFilter | void>({
      query: listInvoicesQuery,
      transformResponse: (response: InvoiceListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((invoice) => ({ type: "Invoice" as const, id: invoice.id })), { type: "Invoice" as const, id: "LIST" }]
          : [{ type: "Invoice" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `InvoicesPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listInvoicesPaginated: builder.query<PaginatedResponse<Invoice>, PaginatedInvoicesListArgs>({
      query: listInvoicesPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((invoice) => ({ type: "Invoice" as const, id: invoice.id })), { type: "Invoice" as const, id: "LIST" }]
          : [{ type: "Invoice" as const, id: "LIST" }],
    }),
    createInvoice: builder.mutation<Invoice, CreateInvoiceInput>({
      query: (body) => ({ url: "/invoices", method: "POST", body }),
      transformResponse: (response: InvoiceResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Invoice", id: "LIST" }],
    }),
    updateInvoiceStatus: builder.mutation<Invoice, { id: string; status: InvoiceStatus }>({
      query: ({ id, status }) => ({ url: `/invoices/${id}/status`, method: "PATCH", body: { status } }),
      transformResponse: (response: InvoiceResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Invoice", id },
        { type: "Invoice", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListInvoicesQuery,
  useListInvoicesPaginatedQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceStatusMutation,
} = invoicesApi;
