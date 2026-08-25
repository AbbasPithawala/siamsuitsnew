import { baseApi } from "../../api/baseApi";
import type { MeasurementDefinition } from "./measurementDefinitionsApi";

/**
 * Mirrors `server/src/db/schema/catalog.ts`'s `productFittings` table
 * (`product_fittings`, PHASE_8_TASKS.md Group 6.1): a named, per-product
 * preset fit (e.g. "Slim," "Regular"), verified directly against
 * `fittings.service.ts`'s `requireProductFitting`/`listFittingsForProduct`
 * return shape rather than assumed.
 */
export interface Fitting {
  id: string;
  productId: string;
  name: string;
  thaiName: string | null;
}

/**
 * One `fitting_values` row, joined with its measurement definition — the
 * shape `getFitting` in `fittings.service.ts` returns (`with: {
 * measurementDefinition: true }`). `value` is the fitting's preset
 * adjustment for that measurement, consumed downstream as a pre-filled
 * `adjustmentValue` (never the customer's real `value`).
 */
export interface FittingValue {
  id: string;
  productFittingId: string;
  measurementDefinitionId: string;
  value: string;
  measurementDefinition: MeasurementDefinition;
}

export interface FittingWithValues extends Fitting {
  values: FittingValue[];
}

export interface FittingInput {
  name: string;
  thaiName?: string;
}

export type FittingUpdateInput = Partial<FittingInput>;

export interface FittingValueInput {
  measurementDefinitionId: string;
  value: string;
}

interface FittingResponseEnvelope {
  data: Fitting;
}

interface FittingListResponseEnvelope {
  data: Fitting[];
}

interface FittingWithValuesResponseEnvelope {
  data: FittingWithValues;
}

interface FittingValueListResponseEnvelope {
  data: FittingValue[];
}

/**
 * Injected into the single `baseApi` instance (per its own doc comment),
 * matching `measurementDefinitionsApi.ts`'s/`measurementsApi.ts`'s
 * established pattern. GET endpoints are ungated server-side (see
 * `fittings.routes.ts`), writes require `catalog.fittings.manage`.
 */
export const fittingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listFittingsForProduct: builder.query<Fitting[], string>({
      query: (productId) => `/products/${productId}/fittings`,
      transformResponse: (response: FittingListResponseEnvelope) => response.data,
      providesTags: (result, _error, productId) =>
        result
          ? [
              ...result.map((fitting) => ({ type: "Fitting" as const, id: fitting.id })),
              { type: "Fitting" as const, id: `PRODUCT-${productId}` },
            ]
          : [{ type: "Fitting" as const, id: `PRODUCT-${productId}` }],
    }),
    createFitting: builder.mutation<Fitting, { productId: string; body: FittingInput }>({
      query: ({ productId, body }) => ({ url: `/products/${productId}/fittings`, method: "POST", body }),
      transformResponse: (response: FittingResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { productId }) => [{ type: "Fitting", id: `PRODUCT-${productId}` }],
    }),
    getFitting: builder.query<FittingWithValues, string>({
      query: (id) => `/fittings/${id}`,
      transformResponse: (response: FittingWithValuesResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Fitting", id }],
    }),
    updateFitting: builder.mutation<Fitting, { id: string; productId: string; body: FittingUpdateInput }>({
      query: ({ id, body }) => ({ url: `/fittings/${id}`, method: "PUT", body }),
      transformResponse: (response: FittingResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id, productId }) => [
        { type: "Fitting", id },
        { type: "Fitting", id: `PRODUCT-${productId}` },
      ],
    }),
    deleteFitting: builder.mutation<void, { id: string; productId: string }>({
      query: ({ id }) => ({ url: `/fittings/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { id, productId }) => [
        { type: "Fitting", id },
        { type: "Fitting", id: `PRODUCT-${productId}` },
      ],
    }),
    /** Full replace of a fitting's per-measurement values (`setFittingValues` in `fittings.service.ts`). */
    setFittingValues: builder.mutation<FittingValue[], { id: string; values: FittingValueInput[] }>({
      query: ({ id, values }) => ({ url: `/fittings/${id}/values`, method: "PUT", body: { values } }),
      transformResponse: (response: FittingValueListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: "Fitting", id }],
    }),
  }),
});

export const {
  useListFittingsForProductQuery,
  useCreateFittingMutation,
  useGetFittingQuery,
  useLazyGetFittingQuery,
  useUpdateFittingMutation,
  useDeleteFittingMutation,
  useSetFittingValuesMutation,
} = fittingsApi;
