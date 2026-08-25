import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/** Mirrors `server/src/db/schema/tenancy.ts`'s `tailors` table, minus `passwordHash` — never sent over the wire (see `tailors.service.ts`'s `sanitize`). */
export interface Tailor {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
  advanceBalance: string;
}

/** `server/src/db/schema/catalog.ts`'s `processes` shape, as embedded in `getTailor`'s `certifications` array (`tailors.service.ts`'s `withCertifications`). */
export interface ProcessRef {
  id: string;
  name: string;
  thaiName: string | null;
  price: string;
}

export interface TailorDetail extends Tailor {
  certifications: ProcessRef[];
}

export interface TailorCreateInput {
  name: string;
  username: string;
  /** Plaintext, sent once; `createTailor` in `tailors.service.ts` hashes it before it ever touches the database. Never re-fetched or displayed. */
  password: string;
  isActive?: boolean;
}

export type TailorUpdateInput = Partial<Pick<TailorCreateInput, "name" | "username" | "isActive">>;

interface TailorResponseEnvelope {
  data: Tailor;
}

interface TailorDetailResponseEnvelope {
  data: TailorDetail;
}

interface TailorListResponseEnvelope {
  data: Tailor[];
}

interface ProcessRefListResponseEnvelope {
  data: ProcessRef[];
}

function listTailorsPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/tailors?${qs}` : "/tailors";
}

/**
 * PHASE_6_TASKS.md Group 4. `GET /tailors[/:id]` requires only
 * `authenticate` (`server/src/routes/tailors.routes.ts`'s doc comment) —
 * same read-open convention as the catalog resources — but `TailorsPage` is
 * still wrapped in `RequirePermission permission="factory.tailors.manage"`
 * at the route level, same page-level-gate reasoning as `UsersPage.tsx`.
 *
 * `getTailor` is the source of a tailor's process certifications, consumed
 * by `TailorCertificationsEditor`'s checkbox list; certify/decertify
 * invalidate that same `{Tailor, id}` tag so the checkbox state updates
 * immediately on toggle — same pattern as `usersApi.ts`'s role assignment.
 */
export const tailorsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTailors: builder.query<Tailor[], void>({
      query: () => "/tailors",
      transformResponse: (response: TailorListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((tailor) => ({ type: "Tailor" as const, id: tailor.id })), { type: "Tailor" as const, id: "LIST" }]
          : [{ type: "Tailor" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `TailorsPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listTailorsPaginated: builder.query<PaginatedResponse<Tailor>, PaginationQueryParams>({
      query: listTailorsPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((tailor) => ({ type: "Tailor" as const, id: tailor.id })), { type: "Tailor" as const, id: "LIST" }]
          : [{ type: "Tailor" as const, id: "LIST" }],
    }),
    getTailor: builder.query<TailorDetail, string>({
      query: (id) => `/tailors/${id}`,
      transformResponse: (response: TailorDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Tailor", id }],
    }),
    createTailor: builder.mutation<Tailor, TailorCreateInput>({
      query: (body) => ({ url: "/tailors", method: "POST", body }),
      transformResponse: (response: TailorResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Tailor", id: "LIST" }],
    }),
    updateTailor: builder.mutation<Tailor, { id: string; body: TailorUpdateInput }>({
      query: ({ id, body }) => ({ url: `/tailors/${id}`, method: "PATCH", body }),
      transformResponse: (response: TailorResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Tailor", id },
        { type: "Tailor", id: "LIST" },
      ],
    }),
    deleteTailor: builder.mutation<void, string>({
      query: (id) => ({ url: `/tailors/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Tailor", id },
        { type: "Tailor", id: "LIST" },
      ],
    }),
    certifyTailor: builder.mutation<ProcessRef[], { tailorId: string; processId: string }>({
      query: ({ tailorId, processId }) => ({ url: `/tailors/${tailorId}/processes`, method: "POST", body: { processId } }),
      transformResponse: (response: ProcessRefListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { tailorId }) => [{ type: "Tailor", id: tailorId }],
    }),
    decertifyTailor: builder.mutation<void, { tailorId: string; processId: string }>({
      query: ({ tailorId, processId }) => ({ url: `/tailors/${tailorId}/processes/${processId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { tailorId }) => [{ type: "Tailor", id: tailorId }],
    }),
  }),
});

export const {
  useListTailorsQuery,
  useListTailorsPaginatedQuery,
  useGetTailorQuery,
  useCreateTailorMutation,
  useUpdateTailorMutation,
  useDeleteTailorMutation,
  useCertifyTailorMutation,
  useDecertifyTailorMutation,
} = tailorsApi;
