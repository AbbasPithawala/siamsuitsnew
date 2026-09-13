import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `extra_payment_categories` table. */
export interface ExtraPaymentCategory {
  id: string;
  productId: string;
  processId: string;
  featureId: string | null;
  styleId: string | null;
  name: string;
  thaiName: string | null;
  cost: string;
}

export interface ExtraPaymentCategoryInput {
  productId: string;
  processId: string;
  featureId?: string;
  styleId?: string;
  name: string;
  thaiName?: string;
  cost?: string;
}

export type ExtraPaymentCategoryUpdateInput = Partial<ExtraPaymentCategoryInput>;

interface ExtraPaymentCategoryResponseEnvelope {
  data: ExtraPaymentCategory;
}

interface ExtraPaymentCategoryListResponseEnvelope {
  data: ExtraPaymentCategory[];
}

function listExtraPaymentCategoriesPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/extra-payment-categories?${qs}` : "/extra-payment-categories";
}

/**
 * PHASE_6_TASKS.md Group 7's admin screen for Group 0's
 * `extraPaymentCategories.routes.ts` CRUD — `GET` there takes only
 * `authenticate` (same open-read convention as the catalog resources),
 * writes require `factory.extra_payments.manage` (the same key Phase 3
 * Group 5 used for creating an actual extra payment against a job).
 */
export const extraPaymentCategoriesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Unpaginated-looking hook, but `/extra-payment-categories` is one of
     * PHASE_10_TASKS.md Workstream C's "mandatory mode" endpoints (defaults
     * to page 1 of 25, sorted by name) — that classification assumed only
     * `ExtraPaymentCategoriesPage.tsx`'s admin CRUD table consumed this list.
     * It's wrong: `JobAssignmentPage.tsx` and `TailorJobsPage.tsx` both need
     * the *entire* tenant-wide set to filter client-side to the handful
     * matching a specific product/process — the exact "also consumed
     * unfiltered by a picker" case `pagination.ts`'s own doc comment carves
     * out for "opt-in mode" endpoints (Products/Processes/etc.), just never
     * applied here. Requesting the server's own `MAX_PAGE_SIZE` (100, see
     * `server/src/utils/pagination.ts`) is the least-bad *client-side*
     * mitigation available without changing that classification — real fix
     * (reclassifying this endpoint to opt-in-mode pagination, or adding a
     * `productId`/`processId` filter) belongs in `siam/server` and is
     * flagged there, not invented here: a tenant with more than 100
     * non-deleted categories would still silently truncate.
     */
    listExtraPaymentCategories: builder.query<ExtraPaymentCategory[], void>({
      query: () => "/extra-payment-categories?pageSize=100",
      transformResponse: (response: ExtraPaymentCategoryListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((category) => ({ type: "ExtraPaymentCategory" as const, id: category.id })),
              { type: "ExtraPaymentCategory" as const, id: "LIST" },
            ]
          : [{ type: "ExtraPaymentCategory" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `ExtraPaymentCategoriesPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listExtraPaymentCategoriesPaginated: builder.query<PaginatedResponse<ExtraPaymentCategory>, PaginationQueryParams>({
      query: listExtraPaymentCategoriesPaginatedQuery,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((category) => ({ type: "ExtraPaymentCategory" as const, id: category.id })),
              { type: "ExtraPaymentCategory" as const, id: "LIST" },
            ]
          : [{ type: "ExtraPaymentCategory" as const, id: "LIST" }],
    }),
    createExtraPaymentCategory: builder.mutation<ExtraPaymentCategory, ExtraPaymentCategoryInput>({
      query: (body) => ({ url: "/extra-payment-categories", method: "POST", body }),
      transformResponse: (response: ExtraPaymentCategoryResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "ExtraPaymentCategory", id: "LIST" }],
    }),
    updateExtraPaymentCategory: builder.mutation<ExtraPaymentCategory, { id: string; body: ExtraPaymentCategoryUpdateInput }>({
      query: ({ id, body }) => ({ url: `/extra-payment-categories/${id}`, method: "PATCH", body }),
      transformResponse: (response: ExtraPaymentCategoryResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ExtraPaymentCategory", id },
        { type: "ExtraPaymentCategory", id: "LIST" },
      ],
    }),
    deleteExtraPaymentCategory: builder.mutation<void, string>({
      query: (id) => ({ url: `/extra-payment-categories/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "ExtraPaymentCategory", id },
        { type: "ExtraPaymentCategory", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListExtraPaymentCategoriesQuery,
  useListExtraPaymentCategoriesPaginatedQuery,
  useCreateExtraPaymentCategoryMutation,
  useUpdateExtraPaymentCategoryMutation,
  useDeleteExtraPaymentCategoryMutation,
} = extraPaymentCategoriesApi;
