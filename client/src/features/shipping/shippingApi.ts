import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/** Mirrors `server/src/db/schema/invoicing.ts`'s `shipping_boxes` table (camelCase, as Drizzle returns it). */
export interface ShippingBox {
  id: string;
  retailerId: string;
  trackingCode: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The `orderItemComponents` row `shipping.service.ts`'s `assembleShippingBoxDetail` joins
 * onto each packed item — just enough to render what was packed (slot label, product,
 * the order item it belongs to) without a second round-trip.
 */
export interface ShippingBoxComponentRef {
  id: string;
  orderItemId: string;
  productId: string;
  slotLabel: string;
}

/** Mirrors `shipping_box_items`; `component` is `null` only if the referenced component was hard-deleted out from under it, which nothing in this codebase does. */
export interface ShippingBoxItem {
  id: string;
  shippingBoxId: string;
  orderItemComponentId: string;
  component: ShippingBoxComponentRef | null;
}

export interface ShippingBoxDetail extends ShippingBox {
  items: ShippingBoxItem[];
}

export interface CreateShippingBoxInput {
  retailerId: string;
}

export interface ListShippingBoxesFilter {
  retailerId?: string;
  isClosed?: boolean;
}

interface ShippingBoxResponseEnvelope {
  data: ShippingBox;
}

interface ShippingBoxDetailResponseEnvelope {
  data: ShippingBoxDetail;
}

interface ShippingBoxListResponseEnvelope {
  data: ShippingBox[];
}

interface ItemSlipPdfResponseEnvelope {
  data: { path: string };
}

function listShippingBoxesQuery(filter: ListShippingBoxesFilter | void): string {
  const params = new URLSearchParams();
  if (filter?.retailerId) params.set("retailerId", filter.retailerId);
  if (filter?.isClosed !== undefined) params.set("isClosed", String(filter.isClosed));
  const qs = params.toString();
  return qs ? `/shipping-boxes?${qs}` : "/shipping-boxes";
}

export type PaginatedShippingBoxesListArgs = ListShippingBoxesFilter & PaginationQueryParams;

function listShippingBoxesPaginatedQuery(args: PaginatedShippingBoxesListArgs): string {
  const params = new URLSearchParams();
  if (args.retailerId) params.set("retailerId", args.retailerId);
  if (args.isClosed !== undefined) params.set("isClosed", String(args.isClosed));
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/shipping-boxes?${qs}` : "/shipping-boxes";
}

/**
 * PHASE_6_TASKS.md Group 10 — shipping UI, against Group 2's
 * `shipping.service.ts`/`shipping.routes.ts`. `shipping.manage` gates every
 * one of these endpoints identically (reads and writes alike — see that
 * route file's own doc comment), unlike `invoices.manage`/`invoices.view`'s
 * split, so `ShippingPage.tsx` has no button-level permission checks of its
 * own: reaching the page at all already means the actor can do everything
 * on it.
 */
export const shippingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listShippingBoxes: builder.query<ShippingBox[], ListShippingBoxesFilter | void>({
      query: listShippingBoxesQuery,
      transformResponse: (response: ShippingBoxListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((box) => ({ type: "ShippingBox" as const, id: box.id })), { type: "ShippingBox" as const, id: "LIST" }]
          : [{ type: "ShippingBox" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `ShippingPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listShippingBoxesPaginated: builder.query<PaginatedResponse<ShippingBox>, PaginatedShippingBoxesListArgs>({
      query: listShippingBoxesPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((box) => ({ type: "ShippingBox" as const, id: box.id })), { type: "ShippingBox" as const, id: "LIST" }]
          : [{ type: "ShippingBox" as const, id: "LIST" }],
    }),
    getShippingBox: builder.query<ShippingBoxDetail, string>({
      query: (id) => `/shipping-boxes/${id}`,
      transformResponse: (response: ShippingBoxDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "ShippingBox", id }],
    }),
    createShippingBox: builder.mutation<ShippingBox, CreateShippingBoxInput>({
      query: (body) => ({ url: "/shipping-boxes", method: "POST", body }),
      transformResponse: (response: ShippingBoxResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "ShippingBox", id: "LIST" }],
    }),
    addShippingBoxItem: builder.mutation<void, { boxId: string; orderItemComponentId: string }>({
      query: ({ boxId, orderItemComponentId }) => ({
        url: `/shipping-boxes/${boxId}/items`,
        method: "POST",
        body: { orderItemComponentId },
      }),
      invalidatesTags: (_result, _error, { boxId }) => [
        { type: "ShippingBox", id: boxId },
        { type: "ShippingBox", id: "LIST" },
      ],
    }),
    removeShippingBoxItem: builder.mutation<void, { boxId: string; orderItemComponentId: string }>({
      query: ({ boxId, orderItemComponentId }) => ({
        url: `/shipping-boxes/${boxId}/items/${orderItemComponentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { boxId }) => [
        { type: "ShippingBox", id: boxId },
        { type: "ShippingBox", id: "LIST" },
      ],
    }),
    closeShippingBox: builder.mutation<ShippingBox, string>({
      query: (boxId) => ({ url: `/shipping-boxes/${boxId}/close`, method: "POST" }),
      transformResponse: (response: ShippingBoxResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, boxId) => [
        { type: "ShippingBox", id: boxId },
        { type: "ShippingBox", id: "LIST" },
      ],
    }),
    /**
     * Legacy `OrderStatusBarcoding.jsx`'s "Generate QR" mode — independent of the
     * shipping-box workflow above (see `shipping.routes.ts`'s doc comment on the
     * matching route). Also flips the order's status to "Shipment" server-side; the
     * response carries only the PDF path (no order id), so invalidate the whole
     * `Order` list rather than a specific entry.
     */
    generateItemSlipPdf: builder.mutation<string, string>({
      query: (componentId) => ({ url: `/shipping/components/${componentId}/slip-pdf`, method: "POST" }),
      transformResponse: (response: ItemSlipPdfResponseEnvelope) => response.data.path,
      invalidatesTags: [{ type: "Order", id: "LIST" }],
    }),
  }),
});

export const {
  useListShippingBoxesQuery,
  useListShippingBoxesPaginatedQuery,
  useGetShippingBoxQuery,
  useCreateShippingBoxMutation,
  useAddShippingBoxItemMutation,
  useRemoveShippingBoxItemMutation,
  useCloseShippingBoxMutation,
  useGenerateItemSlipPdfMutation,
} = shippingApi;
