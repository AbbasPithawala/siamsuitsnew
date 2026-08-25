import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";
import type { MeasurementValue } from "../measurements/MeasurementForm";
import type { FeatureValue } from "../featureSelector/featuresApi";

/**
 * Matches `server/src/services/orders.service.ts`'s `CreateComponentInput`/
 * `CreateOrderItemInput`/`CreateOrderInput` exactly (verified against that
 * file, not inferred) — in particular `superProductComponentId` identifies
 * each component, never `productId`. `MeasurementValue`/`FeatureValue` are
 * imported directly from Groups 5/6's generic components so there is no
 * translation layer between what those components emit and what this
 * mutation sends: the order-builder wizard (Group 7) passes their `onChange`
 * output straight through.
 */
export interface CreateOrderComponentInput {
  superProductComponentId: string;
  measurements?: MeasurementValue[];
  features?: FeatureValue[];
  /** PHASE_9_TASKS.md Decision 5 — shared per line item, mirrors `CreateComponentInput.measurementNote` server-side. */
  measurementNote?: string;
  /** PHASE_9_TASKS.md Group 5 — independent per physical unit, mirrors `CreateComponentInput.stylingNote` server-side. */
  stylingNote?: string;
  /** PHASE_9_TASKS.md Group 5 — the URL `POST /api/uploads` (via `uploadsApi.ts`) returns, independent per unit. */
  referenceImage?: string;
}

export interface CreateOrderItemInput {
  superProductId: string;
  components: CreateOrderComponentInput[];
}

export interface CreateOrderInput {
  retailerId: string;
  customerId: string;
  isRush?: boolean;
  repeatOfOrderId?: string;
  items: CreateOrderItemInput[];
}

/**
 * PHASE_10_TASKS.md Workstream E Group 6.3a — the edit-mode extension of the
 * two interfaces above, matching `server/src/routes/orders.routes.ts`'s
 * `editComponentInputSchema`/`editOrderItemInputSchema` exactly (verified
 * against that file, not inferred): each grows an optional real `id` —
 * omitted means "create new" (same reconciliation rule `orders.edit.routes.test.ts`
 * exercises), present means "update this existing row, matched against the
 * order's current items/components." `manualSizeImage` is edit-only (Group
 * 6.1's new `order_item_components.manual_size_image` column, shared per
 * line item exactly like `referenceImage` is per-unit) — the create path
 * never writes it since the Manual Size annotation editor only ever opens
 * from inside the edit wizard (Group 6.3c).
 */
export interface EditOrderComponentInput extends CreateOrderComponentInput {
  id?: string;
  manualSizeImage?: string;
}

export interface EditOrderItemInput {
  id?: string;
  superProductId: string;
  components: EditOrderComponentInput[];
}

export interface EditOrderInput {
  items: EditOrderItemInput[];
}

/**
 * Just enough of `assembleOrderDetail`'s response shape for the wizard's
 * success screen (order number).
 */
export interface CreatedOrder {
  id: string;
  orderNumber: string;
}

/**
 * PHASE_6_TASKS.md Group 6 extends this file with list/get/pdf endpoints for
 * the new order list/detail screens, rather than duplicating the query setup
 * in a second file — same rationale `retailersApi.ts`/`customersApi.ts` used
 * for their own Phase 6 extensions.
 *
 * Mirrors `server/src/db/schema/orders.ts`'s `orders` row shape (camelCase,
 * as Drizzle returns it) plus the two rollup fields Group 6 added to
 * `listOrders` (`manufacturingStepsTotal`/`manufacturingStepsComplete` — one
 * aggregate query across all listed orders' `manufacturing_steps`, not a
 * per-row follow-up request) so the order list can show "N/M steps complete"
 * without fetching each order's full nested detail.
 */
export interface OrderListItem {
  id: string;
  retailerId: string;
  customerId: string;
  groupId: string | null;
  orderNumber: string;
  status: string;
  type: "normal" | "group";
  isRush: boolean;
  isRepeat: boolean;
  repeatOfOrderId: string | null;
  pdfPath: string | null;
  orderDate: string;
  manufacturingStepsTotal: number;
  manufacturingStepsComplete: number;
  /** PHASE_10_TASKS.md Workstream E Group 6.1 — set whenever Group 6.2's edit/status/reassign routes actually change the order; `null` until then. */
  lastModifiedAt: string | null;
}

export interface OrderMeasurement {
  id: string;
  orderItemComponentId: string;
  measurementDefinitionId: string;
  value: string | null;
  adjustmentValue: string | null;
  totalValue: string | null;
}

export interface OrderFeature {
  id: string;
  orderItemComponentId: string;
  featureId: string;
  styleId: string | null;
  styleOptionId: string | null;
  textValue: string | null;
  structuredValue: unknown;
}

export type ManufacturingStepStatus = "pending" | "assigned" | "complete";

export interface OrderManufacturingStep {
  id: string;
  orderItemComponentId: string;
  processId: string;
  sequenceOrder: number;
  status: ManufacturingStepStatus;
  tailorId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OrderDetailComponent {
  id: string;
  orderItemId: string;
  productId: string;
  slotLabel: string;
  measurements: OrderMeasurement[];
  features: OrderFeature[];
  manufacturingSteps: OrderManufacturingStep[];
  /** PHASE_9_TASKS.md Group 2 — `assembleOrderDetail` already spreads this onto every component. */
  measurementNote: string | null;
  /** PHASE_9_TASKS.md Group 2/5 — `assembleOrderDetail` already spreads these onto every component. */
  stylingNote: string | null;
  referenceImage: string | null;
  /** PHASE_10_TASKS.md Workstream E Group 6.1/6.2 — shared per line item, same denormalization mechanism as `measurementNote`. */
  manualSizeImage: string | null;
}

export interface OrderDetailItem {
  id: string;
  orderId: string;
  superProductId: string;
  sequence: number;
  components: OrderDetailComponent[];
}

/** Full `GET /orders/:id` shape — `assembleOrderDetail`'s `{ ...order, items }`, items -> components -> measurements/features/manufacturingSteps. */
export interface OrderDetail extends OrderListItem {
  items: OrderDetailItem[];
}

export interface ListOrdersFilter {
  retailerId?: string;
  customerId?: string;
  status?: string;
}

/** `POST /orders/:id/pdf`'s real response shape (`orderPdf.service.ts`'s `generateOrderPdf`): `path` is an absolute filesystem path on the server, not a URL — S3/static-file serving isn't wired up anywhere in this codebase yet (see that service's doc comment), so there is no downloadable link to offer, only confirmation that generation succeeded and where the file landed server-side. */
export interface GenerateOrderPdfResult {
  path: string;
  order: OrderDetail;
}

interface CreateOrderResponseEnvelope {
  data: CreatedOrder;
}

interface OrderListResponseEnvelope {
  data: OrderListItem[];
}

interface OrderDetailResponseEnvelope {
  data: OrderDetail;
}

interface GenerateOrderPdfResponseEnvelope {
  data: GenerateOrderPdfResult;
}

export interface SetOrderStatusArgs {
  id: string;
  status: string;
}

export interface ReassignOrderRetailerArgs {
  id: string;
  retailerId: string;
}

function listOrdersQuery(filter: ListOrdersFilter | void): string {
  const params = new URLSearchParams();
  if (filter?.retailerId) params.set("retailerId", filter.retailerId);
  if (filter?.customerId) params.set("customerId", filter.customerId);
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

export type PaginatedOrdersListArgs = ListOrdersFilter & PaginationQueryParams;

function listOrdersPaginatedQuery(args: PaginatedOrdersListArgs): string {
  const params = new URLSearchParams();
  if (args.retailerId) params.set("retailerId", args.retailerId);
  if (args.customerId) params.set("customerId", args.customerId);
  if (args.status) params.set("status", args.status);
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation<CreatedOrder, CreateOrderInput>({
      query: (body) => ({ url: "/orders", method: "POST", body }),
      transformResponse: (response: CreateOrderResponseEnvelope) => response.data,
      // Every order submission upserts the customer's measurement profile for
      // each real component product it touches (PHASE_10_TASKS.md Workstream D
      // Decision 2) — invalidated customer-wide (not per product, since this
      // input only ever carries `customerId`, never a component's real
      // `productId`) so a same-session "Start Another Order" for the same
      // customer sees the freshly-written profile, not a stale cached `null`/
      // pre-order snapshot.
      invalidatesTags: (_result, _error, arg) => [
        { type: "Order", id: "LIST" },
        { type: "CustomerMeasurementProfile", id: arg.customerId },
      ],
    }),
    listOrders: builder.query<OrderListItem[], ListOrdersFilter | void>({
      query: listOrdersQuery,
      transformResponse: (response: OrderListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((order) => ({ type: "Order" as const, id: order.id })), { type: "Order" as const, id: "LIST" }]
          : [{ type: "Order" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `OrderListPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listOrdersPaginated: builder.query<PaginatedResponse<OrderListItem>, PaginatedOrdersListArgs>({
      query: listOrdersPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((order) => ({ type: "Order" as const, id: order.id })), { type: "Order" as const, id: "LIST" }]
          : [{ type: "Order" as const, id: "LIST" }],
    }),
    getOrder: builder.query<OrderDetail, string>({
      query: (id) => `/orders/${id}`,
      transformResponse: (response: OrderDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Order", id }],
    }),
    generateOrderPdf: builder.mutation<GenerateOrderPdfResult, string>({
      query: (id) => ({ url: `/orders/${id}/pdf`, method: "POST" }),
      transformResponse: (response: GenerateOrderPdfResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, id) => [{ type: "Order", id }],
    }),
    /**
     * PHASE_10_TASKS.md Workstream E Group 6.3a — `PATCH /orders/:id`, the
     * full edit-wizard save. Mirrors `createOrder`'s own
     * `CustomerMeasurementProfile` invalidation rationale exactly: an edit
     * re-triggers the same profile-upsert server-side (Group 6.2's writeup
     * confirms `writeComponentContent` is shared between `buildOrder` and
     * `editOrderItems`), so any measurement change here needs to bust a
     * same-session "Start Another Order"/profile-prefill cache the same way
     * creation does. Uses `result.customerId` (from the response) rather
     * than a caller-supplied arg, since — unlike `CreateOrderInput` —
     * `EditOrderInput` never carries `customerId` at all (the order's
     * customer is immutable via this route; only `items[]` changes).
     */
    editOrder: builder.mutation<OrderDetail, { id: string; body: EditOrderInput }>({
      query: ({ id, body }) => ({ url: `/orders/${id}`, method: "PATCH", body }),
      transformResponse: (response: OrderDetailResponseEnvelope) => response.data,
      invalidatesTags: (result, _error, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
        ...(result ? [{ type: "CustomerMeasurementProfile" as const, id: result.customerId }] : []),
      ],
    }),
    /** PHASE_10_TASKS.md Workstream E Group 6.3a — `PATCH /orders/:id/status` (e.g. `"Modified"`/`"Cancelled"`), independent of `editOrder` above (never touches `items[]`). */
    setOrderStatus: builder.mutation<OrderDetail, SetOrderStatusArgs>({
      query: ({ id, status }) => ({ url: `/orders/${id}/status`, method: "PATCH", body: { status } }),
      transformResponse: (response: OrderDetailResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
    /** PHASE_10_TASKS.md Workstream E Group 6.3a — `PATCH /orders/:id/retailer`. */
    reassignOrderRetailer: builder.mutation<OrderDetail, ReassignOrderRetailerArgs>({
      query: ({ id, retailerId }) => ({ url: `/orders/${id}/retailer`, method: "PATCH", body: { retailerId } }),
      transformResponse: (response: OrderDetailResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Order", id },
        { type: "Order", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useCreateOrderMutation,
  useListOrdersQuery,
  useListOrdersPaginatedQuery,
  useGetOrderQuery,
  useGenerateOrderPdfMutation,
  useEditOrderMutation,
  useSetOrderStatusMutation,
  useReassignOrderRetailerMutation,
} = ordersApi;
