import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/db/schema/catalog.ts`'s `processes` table: `id`,
 * `name`, `thaiName` (nullable), `price` (Postgres `numeric`, returned by
 * Drizzle as a string, e.g. `"0.00"`).
 */
export interface Process {
  id: string;
  name: string;
  thaiName: string | null;
  price: string;
}

export interface ProcessInput {
  name: string;
  thaiName?: string;
  price?: string;
}

interface ProcessResponseEnvelope {
  data: Process;
}

interface ProcessListResponseEnvelope {
  data: Process[];
}

function listProcessesPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  return `/processes?${params.toString()}`;
}

export const processesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProcesses: builder.query<Process[], void>({
      query: () => "/processes",
      transformResponse: (response: ProcessListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((process) => ({ type: "Process" as const, id: process.id })), { type: "Process" as const, id: "LIST" }]
          : [{ type: "Process" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — opt-in-mode paginated variant for `ProcessesPage`, see `productsApi.ts`'s `listProductsPaginated` doc comment. */
    listProcessesPaginated: builder.query<PaginatedResponse<Process>, PaginationQueryParams>({
      query: listProcessesPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((process) => ({ type: "Process" as const, id: process.id })), { type: "Process" as const, id: "LIST" }]
          : [{ type: "Process" as const, id: "LIST" }],
    }),
    createProcess: builder.mutation<Process, ProcessInput>({
      query: (body) => ({ url: "/processes", method: "POST", body }),
      transformResponse: (response: ProcessResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Process", id: "LIST" }],
    }),
    updateProcess: builder.mutation<Process, { id: string; body: ProcessInput }>({
      query: ({ id, body }) => ({ url: `/processes/${id}`, method: "PATCH", body }),
      transformResponse: (response: ProcessResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Process", id },
        { type: "Process", id: "LIST" },
      ],
    }),
    deleteProcess: builder.mutation<void, string>({
      query: (id) => ({ url: `/processes/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Process", id },
        { type: "Process", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListProcessesQuery,
  useListProcessesPaginatedQuery,
  useCreateProcessMutation,
  useUpdateProcessMutation,
  useDeleteProcessMutation,
} = processesApi;
