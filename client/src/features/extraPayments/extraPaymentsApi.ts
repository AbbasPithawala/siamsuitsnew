import { baseApi } from "../../api/baseApi";

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `extra_payments` table. */
export interface ExtraPayment {
  id: string;
  jobId: string;
  categoryId: string;
  tailorId: string;
  cost: string;
  approved: boolean;
  paid: boolean;
  paidDate: string | null;
  description: string | null;
  authorizedBy: string | null;
}

interface ExtraPaymentResponseEnvelope {
  data: ExtraPayment;
}

/**
 * PHASE_6_TASKS.md Group 7's job-completion screen: attaching a real extra
 * payment (from Group 0's now-real categories) to a job before completing
 * it, via `extra-payments.routes.ts`'s `POST /jobs/:jobId/extra-payments`
 * (Phase 3 Group 5's `createExtraPayment`, with real server-side validation
 * of category/process/product/style match — see that service's doc comment).
 * `approveExtraPayment` isn't wired to a screen yet — that's Phase 6 Group 8
 * (payroll)'s concern, not this group's.
 */
export const extraPaymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createExtraPayment: builder.mutation<ExtraPayment, { jobId: string; categoryId: string }>({
      query: ({ jobId, categoryId }) => ({ url: `/jobs/${jobId}/extra-payments`, method: "POST", body: { categoryId } }),
      transformResponse: (response: ExtraPaymentResponseEnvelope) => response.data,
    }),
  }),
});

export const { useCreateExtraPaymentMutation } = extraPaymentsApi;
