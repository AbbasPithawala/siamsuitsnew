import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";
import type { FeatureRenderSlot, FeatureStyle, FeatureStyleOption, FeatureType, ProductFeature } from "../featureSelector/featuresApi";

export type { FeatureRenderSlot, FeatureStyle, FeatureStyleOption, FeatureType, ProductFeature };

/**
 * Admin CRUD surface for the same `features`/`feature_products`/`styles`/
 * `style_options` model Group 6's `featureSelector/featuresApi.ts` reads
 * (`GET /api/features?productId=...`, read-only, customer-facing). This
 * file is the write side — injected into the same shared `baseApi` instance
 * per its own doc comment, but with its own `Feature` tag rather than
 * touching Group 6's untagged `productFeatures` query, which is intentionally
 * left alone (see PHASE_5_TASKS.md Group 3).
 *
 * Response shapes below reuse `ProductFeature`/`FeatureStyle`/
 * `FeatureStyleOption` from Group 6's file since `assembleFeatures` in
 * `server/src/services/features.service.ts` is the one function backing
 * both `GET /features` (admin list, this file) and `GET /features?productId=`
 * (Group 6) — the wire shape is genuinely identical, so re-declaring it here
 * would just be duplication that could drift.
 */
export interface FeatureInput {
  name: string;
  thaiName?: string;
  type: FeatureType;
  processId?: string;
  productIds?: string[];
}

export type FeatureUpdateInput = Partial<Pick<FeatureInput, "name" | "thaiName" | "type" | "processId">>;

export interface StyleInput {
  name: string;
  thaiName?: string;
  image?: string;
  price?: string;
  workerPrice?: string;
}

export type StyleUpdateInput = Partial<StyleInput>;

export interface StyleOptionInput {
  name: string;
  image?: string;
}

export type StyleOptionUpdateInput = Partial<StyleOptionInput>;

interface FeatureResponseEnvelope {
  data: ProductFeature;
}

interface FeatureListResponseEnvelope {
  data: ProductFeature[];
}

function listFeaturesPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  return `/features?${params.toString()}`;
}

interface StyleResponseEnvelope {
  data: FeatureStyle;
}

interface StyleOptionResponseEnvelope {
  data: FeatureStyleOption;
}

export const featuresApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listFeatures: builder.query<ProductFeature[], void>({
      query: () => "/features",
      transformResponse: (response: FeatureListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((feature) => ({ type: "Feature" as const, id: feature.id })), { type: "Feature" as const, id: "LIST" }]
          : [{ type: "Feature" as const, id: "LIST" }],
    }),
    /**
     * PHASE_10_TASKS.md Workstream C Group 4 — opt-in-mode paginated variant for
     * `FeaturesPage`'s "All Products" (unfiltered) branch only, see `productsApi.ts`'s
     * `listProductsPaginated` doc comment. Never sends `productId`, so it always hits
     * `features.routes.ts`'s pagination-eligible branch — `listProductFeatures` below
     * (the product-filtered branch, Workstream A) is untouched and stays fully
     * unpaginated, always, per this group's own scope boundary.
     */
    listFeaturesPaginated: builder.query<PaginatedResponse<ProductFeature>, PaginationQueryParams>({
      query: listFeaturesPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((feature) => ({ type: "Feature" as const, id: feature.id })), { type: "Feature" as const, id: "LIST" }]
          : [{ type: "Feature" as const, id: "LIST" }],
    }),
    /**
     * The admin, tagged counterpart to `featureSelector/featuresApi.ts`'s untagged
     * `productFeatures` (deliberately left alone, per that file's own comment) — this one
     * needs real cache invalidation since `setProductFeatures` below writes through it.
     * Returned in the product's own configured order (PHASE_8_TASKS.md Group 1).
     */
    listProductFeatures: builder.query<ProductFeature[], string>({
      query: (productId) => `/features?productId=${encodeURIComponent(productId)}`,
      transformResponse: (response: FeatureListResponseEnvelope) => response.data,
      providesTags: (result, _error, productId) =>
        result
          ? [...result.map((feature) => ({ type: "Feature" as const, id: feature.id })), { type: "Feature" as const, id: `PRODUCT-${productId}` }]
          : [{ type: "Feature" as const, id: `PRODUCT-${productId}` }],
    }),
    createFeature: builder.mutation<ProductFeature, FeatureInput>({
      query: (body) => ({ url: "/features", method: "POST", body }),
      transformResponse: (response: FeatureResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Feature", id: "LIST" }],
    }),
    updateFeature: builder.mutation<ProductFeature, { id: string; body: FeatureUpdateInput }>({
      query: ({ id, body }) => ({ url: `/features/${id}`, method: "PATCH", body }),
      transformResponse: (response: FeatureResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Feature", id },
        { type: "Feature", id: "LIST" },
      ],
    }),
    deleteFeature: builder.mutation<void, string>({
      query: (id) => ({ url: `/features/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Feature", id },
        { type: "Feature", id: "LIST" },
      ],
    }),
    /**
     * `PUT /features/:id/products` is a full replace of the link set (see
     * `setFeatureProducts` in `features.service.ts`), not an add/remove pair
     * like Group 2's super product components — so the caller always sends
     * the complete desired `productIds[]`.
     */
    setFeatureProducts: builder.mutation<ProductFeature, { id: string; productIds: string[] }>({
      query: ({ id, productIds }) => ({ url: `/features/${id}/products`, method: "PUT", body: { productIds } }),
      transformResponse: (response: FeatureResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Feature", id },
        { type: "Feature", id: "LIST" },
      ],
    }),
    /**
     * The product-side counterpart to `setFeatureProducts` above — full replace of *this
     * product's* feature links, in order (`PUT /products/:id/features`,
     * `setProductFeatures` in `features.service.ts`). PHASE_8_TASKS.md Group 1.
     */
    setProductFeatures: builder.mutation<ProductFeature[], { productId: string; featureIds: string[] }>({
      query: ({ productId, featureIds }) => ({ url: `/products/${productId}/features`, method: "PUT", body: { featureIds } }),
      transformResponse: (response: FeatureListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { productId }) => [
        { type: "Feature", id: `PRODUCT-${productId}` },
        { type: "Feature", id: "LIST" },
      ],
    }),
    createStyle: builder.mutation<FeatureStyle, { featureId: string; body: StyleInput }>({
      query: ({ featureId, body }) => ({ url: `/features/${featureId}/styles`, method: "POST", body }),
      transformResponse: (response: StyleResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { featureId }) => [
        { type: "Feature", id: featureId },
        { type: "Feature", id: "LIST" },
      ],
    }),
    updateStyle: builder.mutation<FeatureStyle, { featureId: string; styleId: string; body: StyleUpdateInput }>({
      query: ({ styleId, body }) => ({ url: `/styles/${styleId}`, method: "PATCH", body }),
      transformResponse: (response: StyleResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { featureId }) => [
        { type: "Feature", id: featureId },
        { type: "Feature", id: "LIST" },
      ],
    }),
    deleteStyle: builder.mutation<void, { featureId: string; styleId: string }>({
      query: ({ styleId }) => ({ url: `/styles/${styleId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { featureId }) => [
        { type: "Feature", id: featureId },
        { type: "Feature", id: "LIST" },
      ],
    }),
    createStyleOption: builder.mutation<FeatureStyleOption, { featureId: string; styleId: string; body: StyleOptionInput }>({
      query: ({ styleId, body }) => ({ url: `/styles/${styleId}/options`, method: "POST", body }),
      transformResponse: (response: StyleOptionResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { featureId }) => [
        { type: "Feature", id: featureId },
        { type: "Feature", id: "LIST" },
      ],
    }),
    updateStyleOption: builder.mutation<FeatureStyleOption, { featureId: string; optionId: string; body: StyleOptionUpdateInput }>({
      query: ({ optionId, body }) => ({ url: `/style-options/${optionId}`, method: "PATCH", body }),
      transformResponse: (response: StyleOptionResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { featureId }) => [
        { type: "Feature", id: featureId },
        { type: "Feature", id: "LIST" },
      ],
    }),
    deleteStyleOption: builder.mutation<void, { featureId: string; optionId: string }>({
      query: ({ optionId }) => ({ url: `/style-options/${optionId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { featureId }) => [
        { type: "Feature", id: featureId },
        { type: "Feature", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListFeaturesQuery,
  useListFeaturesPaginatedQuery,
  useListProductFeaturesQuery,
  useCreateFeatureMutation,
  useUpdateFeatureMutation,
  useDeleteFeatureMutation,
  useSetFeatureProductsMutation,
  useSetProductFeaturesMutation,
  useCreateStyleMutation,
  useUpdateStyleMutation,
  useDeleteStyleMutation,
  useCreateStyleOptionMutation,
  useUpdateStyleOptionMutation,
  useDeleteStyleOptionMutation,
} = featuresApi;
