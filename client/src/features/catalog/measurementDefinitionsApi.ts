import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/db/schema/catalog.ts`'s `measurementDefinitions`
 * table: `id`, `name`, `thaiName` (nullable), `slug` (required, unique per
 * tenant — see `measurementsRouter`'s `createDefinitionSchema`).
 *
 * Distinct from `../measurements/measurementsApi.ts`'s `MeasurementDefinition`
 * (a read-only shape nested under a product-measurement link, for Group 5's
 * generic `<MeasurementForm>`) — this one is the admin CRUD resource itself.
 */
export interface MeasurementDefinition {
  id: string;
  name: string;
  thaiName: string | null;
  slug: string;
}

export interface MeasurementDefinitionInput {
  name: string;
  thaiName?: string;
  slug: string;
}

interface MeasurementDefinitionResponseEnvelope {
  data: MeasurementDefinition;
}

interface MeasurementDefinitionListResponseEnvelope {
  data: MeasurementDefinition[];
}

function listMeasurementDefinitionsPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  return `/measurement-definitions?${params.toString()}`;
}

export const measurementDefinitionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMeasurementDefinitions: builder.query<MeasurementDefinition[], void>({
      query: () => "/measurement-definitions",
      transformResponse: (response: MeasurementDefinitionListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((definition) => ({ type: "MeasurementDefinition" as const, id: definition.id })),
              { type: "MeasurementDefinition" as const, id: "LIST" },
            ]
          : [{ type: "MeasurementDefinition" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — opt-in-mode paginated variant for `MeasurementDefinitionsPage`, see `productsApi.ts`'s `listProductsPaginated` doc comment. */
    listMeasurementDefinitionsPaginated: builder.query<PaginatedResponse<MeasurementDefinition>, PaginationQueryParams>({
      query: listMeasurementDefinitionsPaginatedQuery,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((definition) => ({ type: "MeasurementDefinition" as const, id: definition.id })),
              { type: "MeasurementDefinition" as const, id: "LIST" },
            ]
          : [{ type: "MeasurementDefinition" as const, id: "LIST" }],
    }),
    createMeasurementDefinition: builder.mutation<MeasurementDefinition, MeasurementDefinitionInput>({
      query: (body) => ({ url: "/measurement-definitions", method: "POST", body }),
      transformResponse: (response: MeasurementDefinitionResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "MeasurementDefinition", id: "LIST" }],
    }),
    updateMeasurementDefinition: builder.mutation<
      MeasurementDefinition,
      { id: string; body: Partial<MeasurementDefinitionInput> }
    >({
      query: ({ id, body }) => ({ url: `/measurement-definitions/${id}`, method: "PATCH", body }),
      transformResponse: (response: MeasurementDefinitionResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "MeasurementDefinition", id },
        { type: "MeasurementDefinition", id: "LIST" },
      ],
    }),
    deleteMeasurementDefinition: builder.mutation<void, string>({
      query: (id) => ({ url: `/measurement-definitions/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "MeasurementDefinition", id },
        { type: "MeasurementDefinition", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListMeasurementDefinitionsQuery,
  useListMeasurementDefinitionsPaginatedQuery,
  useCreateMeasurementDefinitionMutation,
  useUpdateMeasurementDefinitionMutation,
  useDeleteMeasurementDefinitionMutation,
} = measurementDefinitionsApi;
