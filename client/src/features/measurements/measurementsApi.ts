import { baseApi } from "../../api/baseApi";

/**
 * Mirrors `server/src/db/schema/catalog.ts`'s `measurementDefinitions` table
 * (camelCase fields as Drizzle returns them, no case-transform layer in
 * between): `id`, `name`, `thaiName` (nullable — not every definition has a
 * Thai name yet), `slug`.
 */
export interface MeasurementDefinition {
  id: string;
  name: string;
  thaiName: string | null;
  slug: string;
}

/**
 * One row of `GET /api/products/:id/measurements`
 * (`server/src/routes/measurements.routes.ts`, backed by
 * `measurementsService.getProductMeasurements`) — a `product_measurements`
 * join row with its `measurementDefinition` relation eagerly loaded.
 */
export interface ProductMeasurementLink {
  id: string;
  productId: string;
  measurementDefinitionId: string;
  measurementDefinition: MeasurementDefinition;
}

interface ProductMeasurementsResponseEnvelope {
  data: ProductMeasurementLink[];
}

/**
 * Injected into the single `baseApi` instance (per its own doc comment) so
 * this endpoint shares the same cache/tag namespace as everything else,
 * rather than standing up a second `createApi`.
 */
export const measurementsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Returned in the product's own configured order (PHASE_8_TASKS.md Group 1).
    productMeasurements: builder.query<ProductMeasurementLink[], string>({
      query: (productId) => `/products/${productId}/measurements`,
      transformResponse: (response: ProductMeasurementsResponseEnvelope) => response.data,
      providesTags: (_result, _error, productId) => [{ type: "ProductMeasurements" as const, id: productId }],
    }),
    /** Full replace of a product's measurement links, in order (`setProductMeasurements` in `measurements.service.ts`). */
    setProductMeasurements: builder.mutation<ProductMeasurementLink[], { productId: string; measurementDefinitionIds: string[] }>({
      query: ({ productId, measurementDefinitionIds }) => ({
        url: `/products/${productId}/measurements`,
        method: "PUT",
        body: { measurementDefinitionIds },
      }),
      transformResponse: (response: ProductMeasurementsResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { productId }) => [{ type: "ProductMeasurements" as const, id: productId }],
    }),
  }),
});

export const { useProductMeasurementsQuery, useSetProductMeasurementsMutation } = measurementsApi;
