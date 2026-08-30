import { baseApi } from "../../api/baseApi";

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `extra_payments` table. */
export interface ExtraPayment {
  id: string;
  jobId: string;
  categoryId: string;
  tailorId: string;
  cost: string;
  approved: boolean;
  rejected: boolean;
  rejectedAt: string | null;
  paid: boolean;
  paidDate: string | null;
  description: string | null;
  authorizedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `extra-payments.service.ts`'s `listExtraPayments` enrichment — same shape as its `manufacturing.service.ts`-style join-and-map. */
export interface ExtraPaymentListItem extends ExtraPayment {
  tailor: { id: string; name: string } | null;
  category: { id: string; name: string; thaiName: string | null } | null;
  order: { id: string; orderNumber: string } | null;
  component: { id: string; slotLabel: string } | null;
}

export type ExtraPaymentStatus = "pending" | "approved" | "rejected";

interface ExtraPaymentResponseEnvelope {
  data: ExtraPayment;
}

interface ExtraPaymentListResponseEnvelope {
  data: ExtraPaymentListItem[];
}

function listExtraPaymentsQuery(args: { status?: ExtraPaymentStatus; tailorId?: string } = {}): string {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.tailorId) params.set("tailorId", args.tailorId);
  const qs = params.toString();
  return qs ? `/extra-payments?${qs}` : "/extra-payments";
}

/**
 * PHASE_6_TASKS.md Group 7's job-completion screen: attaching a real extra
 * payment (from Group 0's now-real categories) to a job before completing
 * it, via `extra-payments.routes.ts`'s `POST /jobs/:jobId/extra-payments`
 * (Phase 3 Group 5's `createExtraPayment`, with real server-side validation
 * of category/process/product/style match — see that service's doc comment).
 *
 * `listExtraPayments`/`approveExtraPayment`/`rejectExtraPayment` back the
 * admin approval queue (`ExtraPaymentsApprovalPage.tsx`, a later follow-up —
 * the legacy `ManageExtraPayments.jsx` equivalent this rewrite was missing).
 * `removeExtraPayment` is the job-assignment screen's own undo, keyed by
 * `(jobId, categoryId)` like `createExtraPayment` rather than the extra
 * payment's own id, since that screen never learns it.
 */
export const extraPaymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listExtraPayments: builder.query<ExtraPaymentListItem[], { status?: ExtraPaymentStatus; tailorId?: string } | void>({
      query: (args) => listExtraPaymentsQuery(args ?? {}),
      transformResponse: (response: ExtraPaymentListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((ep) => ({ type: "ExtraPayment" as const, id: ep.id })), { type: "ExtraPayment" as const, id: "LIST" }]
          : [{ type: "ExtraPayment" as const, id: "LIST" }],
    }),
    /** `componentId` is never sent to the server — it's only here so `invalidatesTags` can refresh the right `ManufacturingComponent` cache entry, same pattern `manufacturingApi.ts`'s `completeStep` uses for `componentId`. */
    createExtraPayment: builder.mutation<ExtraPayment, { jobId: string; categoryId: string; componentId: string }>({
      query: ({ jobId, categoryId }) => ({ url: `/jobs/${jobId}/extra-payments`, method: "POST", body: { categoryId } }),
      transformResponse: (response: ExtraPaymentResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
    /** Job-assignment screen's undo — see this file's doc comment. `componentId` is invalidation-only, same as `createExtraPayment`. */
    removeExtraPayment: builder.mutation<void, { jobId: string; categoryId: string; componentId: string }>({
      query: ({ jobId, categoryId }) => ({ url: `/jobs/${jobId}/extra-payments/${categoryId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { componentId }) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
    approveExtraPayment: builder.mutation<ExtraPayment, string>({
      query: (id) => ({ url: `/extra-payments/${id}/approve`, method: "PATCH" }),
      transformResponse: (response: ExtraPaymentResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, id) => [
        { type: "ExtraPayment", id },
        { type: "ExtraPayment", id: "LIST" },
      ],
    }),
    rejectExtraPayment: builder.mutation<ExtraPayment, string>({
      query: (id) => ({ url: `/extra-payments/${id}/reject`, method: "PATCH" }),
      transformResponse: (response: ExtraPaymentResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, id) => [
        { type: "ExtraPayment", id },
        { type: "ExtraPayment", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListExtraPaymentsQuery,
  useCreateExtraPaymentMutation,
  useRemoveExtraPaymentMutation,
  useApproveExtraPaymentMutation,
  useRejectExtraPaymentMutation,
} = extraPaymentsApi;
