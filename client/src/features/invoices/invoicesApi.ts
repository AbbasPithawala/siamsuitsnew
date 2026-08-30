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
  dueDate: string | null;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Exactly one of `lineItems` (the original freeform manual-entry path) or `orderIds`
 * (picking specific orders — each contributing one line sourced from that order's own saved
 * `order_invoices.total` — mirroring legacy `CreateInvoice.jsx`'s real order-selection flow)
 * should be provided; `invoices.service.ts#buildInvoice` rejects both-or-neither with a 400.
 */
export interface CreateInvoiceInput {
  retailerId: string;
  lineItems?: LineItemInput[];
  orderIds?: string[];
  discount?: number;
  shippingCharge?: number;
  dueDate?: string;
}

export interface ListInvoicesFilter {
  retailerId?: string;
  status?: string;
}

/**
 * One row of `GET /retailers/:id/invoiceable-orders` — legacy `CreateInvoice.jsx`'s order
 * table (Order #/Date/Customer/Total Amount), filtered server-side to orders not yet bundled
 * into another retailer invoice. `total` is `null` when this order has no saved per-order
 * invoice yet — legacy's own real gate ("checkbox only enabled once `total_amount` is
 * truthy") applies off this: an order with `total: null` can be opened for pricing but can't
 * be selected into a grouped invoice yet.
 */
export interface InvoiceableOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  total: string | null;
}

/** One row of `GET /invoices/:id/orders` — legacy `InvoiceHistory.jsx`'s "View" dialog's order list. */
export interface InvoiceOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
}

/** Mirrors `server/src/services/orderInvoices.service.ts`'s `OrderInvoiceLineKind`. */
export const ORDER_INVOICE_LINE_KINDS = ["unit", "additional", "charge"] as const;
export type OrderInvoiceLineKind = (typeof ORDER_INVOICE_LINE_KINDS)[number];

export interface OrderInvoiceLine {
  id: string | null;
  groupLabel: string;
  kind: OrderInvoiceLineKind;
  label: string;
  price: string;
  sortOrder: number;
}

export interface OrderInvoiceLineInput {
  groupLabel: string;
  kind: OrderInvoiceLineKind;
  label: string;
  price: number;
}

/** Mirrors `server/src/services/orderInvoices.service.ts`'s `OrderInvoiceView` — a saved invoice, or an unsaved draft freshly computed from the order's current data when `isDraft` is `true`. */
export interface OrderInvoice {
  id: string | null;
  orderId: string;
  note: string | null;
  total: string;
  pdfPath: string | null;
  isDraft: boolean;
  lines: OrderInvoiceLine[];
}

export interface SaveOrderInvoiceInput {
  note?: string;
  lines: OrderInvoiceLineInput[];
}

interface InvoiceResponseEnvelope {
  data: Invoice;
}

interface InvoiceListResponseEnvelope {
  data: Invoice[];
}

interface InvoiceableOrdersResponseEnvelope {
  data: InvoiceableOrder[];
}

interface InvoiceOrdersResponseEnvelope {
  data: InvoiceOrderSummary[];
}

interface OrderInvoiceResponseEnvelope {
  data: OrderInvoice;
}

interface PdfPathResponseEnvelope {
  data: { path: string };
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
 *
 * PHASE_10_TASKS.md invoicing follow-up added the order-driven path on top: picking real
 * orders for a retailer (`listInvoiceableOrders`), pricing one order's own invoice
 * (`getOrderInvoice`/`saveOrderInvoice`), and generating/emailing server-rendered PDFs —
 * legacy `CreateInvoice.jsx`/`InvoiceHistory.jsx`'s actual workflow, which the original
 * freeform-line-item-only version of this page didn't cover at all.
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
      // Creating from `orderIds` removes those orders from every invoiceable-orders list —
      // always invalidated alongside the invoice list itself, a no-op extra tag when
      // creating from freeform `lineItems` instead.
      invalidatesTags: [{ type: "Invoice", id: "LIST" }, { type: "OrderInvoice", id: "LIST" }],
    }),
    updateInvoiceStatus: builder.mutation<Invoice, { id: string; status: InvoiceStatus }>({
      query: ({ id, status }) => ({ url: `/invoices/${id}/status`, method: "PATCH", body: { status } }),
      transformResponse: (response: InvoiceResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Invoice", id },
        { type: "Invoice", id: "LIST" },
      ],
    }),
    listInvoiceableOrders: builder.query<InvoiceableOrder[], string>({
      query: (retailerId) => `/retailers/${retailerId}/invoiceable-orders`,
      transformResponse: (response: InvoiceableOrdersResponseEnvelope) => response.data,
      providesTags: [{ type: "OrderInvoice", id: "LIST" }],
    }),
    getInvoiceOrders: builder.query<InvoiceOrderSummary[], string>({
      query: (invoiceId) => `/invoices/${invoiceId}/orders`,
      transformResponse: (response: InvoiceOrdersResponseEnvelope) => response.data,
    }),
    getOrderInvoice: builder.query<OrderInvoice, string>({
      query: (orderId) => `/orders/${orderId}/invoice`,
      transformResponse: (response: OrderInvoiceResponseEnvelope) => response.data,
      providesTags: (_result, _error, orderId) => [{ type: "OrderInvoice", id: orderId }],
    }),
    saveOrderInvoice: builder.mutation<OrderInvoice, { orderId: string; body: SaveOrderInvoiceInput }>({
      query: ({ orderId, body }) => ({ url: `/orders/${orderId}/invoice`, method: "PUT", body }),
      transformResponse: (response: OrderInvoiceResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: "OrderInvoice", id: orderId },
        { type: "OrderInvoice", id: "LIST" },
      ],
    }),
    generateOrderInvoicePdf: builder.mutation<{ path: string }, string>({
      query: (orderId) => ({ url: `/orders/${orderId}/invoice/pdf`, method: "POST" }),
      transformResponse: (response: PdfPathResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, orderId) => [{ type: "OrderInvoice", id: orderId }],
    }),
    generateRetailerInvoicePdf: builder.mutation<{ path: string }, string>({
      query: (invoiceId) => ({ url: `/invoices/${invoiceId}/pdf`, method: "POST" }),
      transformResponse: (response: PdfPathResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, invoiceId) => [{ type: "Invoice", id: invoiceId }],
    }),
    sendRetailerInvoiceEmail: builder.mutation<void, string>({
      query: (invoiceId) => ({ url: `/invoices/${invoiceId}/send-email`, method: "POST" }),
    }),
  }),
});

export const {
  useListInvoicesQuery,
  useListInvoicesPaginatedQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceStatusMutation,
  useListInvoiceableOrdersQuery,
  useGetInvoiceOrdersQuery,
  useGetOrderInvoiceQuery,
  useSaveOrderInvoiceMutation,
  useGenerateOrderInvoicePdfMutation,
  useGenerateRetailerInvoicePdfMutation,
  useSendRetailerInvoiceEmailMutation,
} = invoicesApi;
