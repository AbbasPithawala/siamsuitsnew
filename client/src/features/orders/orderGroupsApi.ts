import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";
import type { CreateOrderItemInput, OrderDetail } from "./ordersApi";

/**
 * The gap this file closes: `navConfig.ts` carried a standing doc comment
 * ("`Group Orders` has no entry at all... a standing gap") — real backend
 * support (`server/src/services/order-groups.service.ts`,
 * `server/src/routes/order-groups.routes.ts`) has existed since Phase 3 with
 * zero frontend consumer. Mirrors `ordersApi.ts`'s own conventions exactly
 * (same `baseApi.injectEndpoints` pattern, same Workstream C pagination
 * envelope), reusing `CreateOrderItemInput`/`OrderDetail` from that file
 * rather than redefining an order-item/order-detail shape a second time —
 * `POST /order-groups`'s `orders[].items` is the exact same
 * `orderItemInputSchema` `POST /orders`'s own `items` uses
 * (`order-groups.routes.ts`'s `createOrderGroupOrderSchema` reuses
 * `orders.routes.ts`'s `orderItemInputSchema` directly), and
 * `GET /order-groups/:id`'s `orders[]` entries are each a full `OrderDetail`
 * (`getOrderGroup`'s own `assembleOrderDetail` call per child order —
 * verified against `order-groups.service.ts`, not inferred).
 */

/** Bare `order_groups` row shape (camelCase, as Drizzle returns it) — `GET /order-groups`'s list response never nests child orders (no count, no child-order info at all), unlike the `:id` detail endpoint below. */
export interface OrderGroup {
  id: string;
  tenantId: string;
  retailerId: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** `GET /order-groups/:id` and `POST /order-groups`'s real response shape — the bare group row plus every child order's full detail. */
export interface OrderGroupDetail extends OrderGroup {
  orders: OrderDetail[];
}

export interface CreateOrderGroupOrderInput {
  customerId: string;
  items: CreateOrderItemInput[];
}

export interface CreateOrderGroupInput {
  retailerId: string;
  orders: CreateOrderGroupOrderInput[];
}

export interface ListOrderGroupsFilter {
  retailerId?: string;
}

export type PaginatedOrderGroupsListArgs = ListOrderGroupsFilter & PaginationQueryParams;

interface OrderGroupDetailResponseEnvelope {
  data: OrderGroupDetail;
}

function listOrderGroupsPaginatedQuery(args: PaginatedOrderGroupsListArgs): string {
  const params = new URLSearchParams();
  if (args.retailerId) params.set("retailerId", args.retailerId);
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/order-groups?${qs}` : "/order-groups";
}

export const orderGroupsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** PHASE_10_TASKS.md Workstream C's mandatory-pagination convention (page 1/25 defaults) — `GET /order-groups` is mandatorily paginated server-side, no unpaginated variant exists. */
    listOrderGroupsPaginated: builder.query<PaginatedResponse<OrderGroup>, PaginatedOrderGroupsListArgs>({
      query: listOrderGroupsPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((group) => ({ type: "OrderGroup" as const, id: group.id })), { type: "OrderGroup" as const, id: "LIST" }]
          : [{ type: "OrderGroup" as const, id: "LIST" }],
    }),
    getOrderGroup: builder.query<OrderGroupDetail, string>({
      query: (id) => `/order-groups/${id}`,
      transformResponse: (response: OrderGroupDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "OrderGroup", id }],
    }),
    createOrderGroup: builder.mutation<OrderGroupDetail, CreateOrderGroupInput>({
      query: (body) => ({ url: "/order-groups", method: "POST", body }),
      transformResponse: (response: OrderGroupDetailResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "OrderGroup", id: "LIST" }],
    }),
  }),
});

export const { useListOrderGroupsPaginatedQuery, useGetOrderGroupQuery, useCreateOrderGroupMutation } = orderGroupsApi;
