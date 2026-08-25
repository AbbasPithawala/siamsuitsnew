import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/db/schema/index`'s `retailers` table (camelCase, as
 * Drizzle returns it). `listRetailers` originated in `PHASE_5_TASKS.md`
 * Group 7 for the order-builder wizard's retailer picker (the
 * `retailer_users` fine-grained access-control gap — which users can act on
 * behalf of which retailers — is deliberately deferred, so that wizard picks
 * from every retailer in the tenant rather than a restricted list).
 * `PHASE_6_TASKS.md` Group 4 adds the create/update/delete mutations here
 * for the real `RetailersPage` admin screen rather than duplicating the
 * query in a second file. `GET /retailers[/:id]` requires only
 * `authenticate`; `retailers.manage` gates the mutations below
 * (`server/src/routes/retailers.routes.ts`).
 */
export interface Retailer {
  id: string;
  name: string;
  code: string;
  ownerName: string | null;
  logo: string | null;
  address: string | null;
  phone: string | null;
  emailRecipients: string[] | null;
  isActive: boolean;
}

export interface RetailerInput {
  name: string;
  code: string;
  ownerName?: string;
  logo?: string;
  address?: string;
  phone?: string;
  emailRecipients?: string[];
  isActive?: boolean;
}

interface RetailerResponseEnvelope {
  data: Retailer;
}

interface RetailerListResponseEnvelope {
  data: Retailer[];
}

function listRetailersPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/retailers?${qs}` : "/retailers";
}

export const retailersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRetailers: builder.query<Retailer[], void>({
      query: () => "/retailers",
      transformResponse: (response: RetailerListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((retailer) => ({ type: "Retailer" as const, id: retailer.id })), { type: "Retailer" as const, id: "LIST" }]
          : [{ type: "Retailer" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `RetailersPage`'s admin table, see `customersApi.ts`'s `listCustomersPaginated` doc comment for why this is a separate endpoint rather than changing `listRetailers` itself. */
    listRetailersPaginated: builder.query<PaginatedResponse<Retailer>, PaginationQueryParams>({
      query: listRetailersPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((retailer) => ({ type: "Retailer" as const, id: retailer.id })), { type: "Retailer" as const, id: "LIST" }]
          : [{ type: "Retailer" as const, id: "LIST" }],
    }),
    /** Single-retailer fetch — added for the retailer self-service Profile page (a
     * retailer-linked actor fetching its own record by `me.retailerId`), same
     * open-read convention as `listRetailers` (`GET /retailers/:id` requires only
     * `authenticate`). */
    getRetailer: builder.query<Retailer, string>({
      query: (id) => `/retailers/${id}`,
      transformResponse: (response: RetailerResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Retailer", id }],
    }),
    createRetailer: builder.mutation<Retailer, RetailerInput>({
      query: (body) => ({ url: "/retailers", method: "POST", body }),
      transformResponse: (response: RetailerResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Retailer", id: "LIST" }],
    }),
    updateRetailer: builder.mutation<Retailer, { id: string; body: RetailerInput }>({
      query: ({ id, body }) => ({ url: `/retailers/${id}`, method: "PATCH", body }),
      transformResponse: (response: RetailerResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Retailer", id },
        { type: "Retailer", id: "LIST" },
      ],
    }),
    deleteRetailer: builder.mutation<void, string>({
      query: (id) => ({ url: `/retailers/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Retailer", id },
        { type: "Retailer", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListRetailersQuery,
  useListRetailersPaginatedQuery,
  useGetRetailerQuery,
  useCreateRetailerMutation,
  useUpdateRetailerMutation,
  useDeleteRetailerMutation,
} = retailersApi;
