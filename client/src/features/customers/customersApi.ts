import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/services/customers.service.ts`'s `customers` shape.
 * Originated as a minimal list+create API for the order-builder wizard's
 * inline search/quick-create (`PHASE_5_TASKS.md` Group 7). `PHASE_6_TASKS.md`
 * Group 5 extends it with `listCustomers`/`getCustomer`/`updateCustomer`/
 * `deleteCustomer` for the real `CustomersPage` admin screen, rather than
 * duplicating the query/mutation shapes in a second file — same rationale as
 * `retailersApi.ts`'s Group 4 extension. `deleteCustomer` soft-deletes
 * (`customers.service.ts`'s `softDeleteCustomer` sets `deletedAt`; there is
 * no `isActive` column on `customers` the way there is on `retailers`, so
 * "deactivate" here just means the delete action, same UX as
 * `RetailersPage.tsx`'s "Deactivate (soft-delete) via the Delete action").
 */
export interface Customer {
  id: string;
  retailerId: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  email: string | null;
  contactNumber: string | null;
  image: string | null;
  imageNote: string | null;
}

export interface CustomerCreateInput {
  retailerId: string;
  firstName: string;
  lastName?: string;
  gender?: string;
  email?: string;
  contactNumber?: string;
  image?: string;
  imageNote?: string;
}

export type CustomerUpdateInput = Partial<CustomerCreateInput>;

export interface CustomerListFilter {
  retailerId?: string;
}

interface CustomerResponseEnvelope {
  data: Customer;
}

interface CustomerListResponseEnvelope {
  data: Customer[];
}

export type PaginatedCustomerListArgs = CustomerListFilter & PaginationQueryParams;

function listCustomersPaginatedQuery(args: PaginatedCustomerListArgs): string {
  const params = new URLSearchParams();
  if (args.retailerId) params.set("retailerId", args.retailerId);
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/customers?${qs}` : "/customers";
}

/**
 * `createCustomer` requires `retailerId` — `customers.service.ts`'s
 * `requireRetailer` check throws `RETAILER_NOT_FOUND` without one — so a
 * customer can only ever be created in the context of an already chosen
 * retailer. `listCustomersByRetailer` is keyed on exactly that, matching the
 * order-builder wizard's retailer-before-customer step order (see
 * `OrderBuilderPage.tsx`'s doc comment for why that reorders
 * `PHASE_5_TASKS.md`'s literal (1) customer / (2) retailer listing).
 *
 * `listCustomers` below is the more general form for `CustomersPage`'s
 * admin list: `retailerId` is optional there (`customers.service.ts`'s
 * `listCustomers` filter is `{ retailerId?: string }`, listing every
 * customer in the tenant when omitted) so the admin screen's "All retailers"
 * filter option has a real backing query rather than requiring a retailer
 * to be picked first.
 */
export const customersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCustomersByRetailer: builder.query<Customer[], string>({
      query: (retailerId) => `/customers?retailerId=${encodeURIComponent(retailerId)}`,
      transformResponse: (response: CustomerListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((customer) => ({ type: "Customer" as const, id: customer.id })), { type: "Customer" as const, id: "LIST" }]
          : [{ type: "Customer" as const, id: "LIST" }],
    }),
    listCustomers: builder.query<Customer[], CustomerListFilter | void>({
      query: (filter) => (filter?.retailerId ? `/customers?retailerId=${encodeURIComponent(filter.retailerId)}` : "/customers"),
      transformResponse: (response: CustomerListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((customer) => ({ type: "Customer" as const, id: customer.id })), { type: "Customer" as const, id: "LIST" }]
          : [{ type: "Customer" as const, id: "LIST" }],
    }),
    /**
     * PHASE_10_TASKS.md Workstream C Group 4 — the paginated variant used by
     * `CustomersPage`'s admin table. A separate cache entry from
     * `listCustomers` above (same `/customers` URL, always-explicit `page`/
     * `pageSize`) rather than changing `listCustomers`'s own response shape,
     * so `listCustomersByRetailer`/`listCustomers`'s existing callers (the
     * order-builder's customer picker, `OrderListPage`'s filter dropdown)
     * keep receiving a plain `Customer[]` completely unaffected.
     */
    listCustomersPaginated: builder.query<PaginatedResponse<Customer>, PaginatedCustomerListArgs>({
      query: listCustomersPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((customer) => ({ type: "Customer" as const, id: customer.id })), { type: "Customer" as const, id: "LIST" }]
          : [{ type: "Customer" as const, id: "LIST" }],
    }),
    getCustomer: builder.query<Customer, string>({
      query: (id) => `/customers/${id}`,
      transformResponse: (response: CustomerResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Customer", id }],
    }),
    createCustomer: builder.mutation<Customer, CustomerCreateInput>({
      query: (body) => ({ url: "/customers", method: "POST", body }),
      transformResponse: (response: CustomerResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Customer", id: "LIST" }],
    }),
    updateCustomer: builder.mutation<Customer, { id: string; body: CustomerUpdateInput }>({
      query: ({ id, body }) => ({ url: `/customers/${id}`, method: "PATCH", body }),
      transformResponse: (response: CustomerResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),
    deleteCustomer: builder.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListCustomersByRetailerQuery,
  useListCustomersQuery,
  useListCustomersPaginatedQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customersApi;
