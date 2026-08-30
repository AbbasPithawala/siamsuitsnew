import { baseApi } from "../../api/baseApi";
import type { AssignStepResult, ManufacturingStep } from "../manufacturing/manufacturingApi";
import type { ExtraPayment, ExtraPaymentListItem, ExtraPaymentStatus } from "../extraPayments/extraPaymentsApi";
import type { Settlement, SettlementDetail } from "../payroll/payrollApi";

interface AssignStepResponseEnvelope {
  data: AssignStepResult;
}

interface ManufacturingStepResponseEnvelope {
  data: ManufacturingStep;
}

interface ExtraPaymentResponseEnvelope {
  data: ExtraPayment;
}

interface SettlementListResponseEnvelope {
  data: Settlement[];
}

interface SettlementDetailResponseEnvelope {
  data: SettlementDetail;
}

interface SettlementPdfResponseEnvelope {
  data: { path: string };
}

interface ExtraPaymentListResponseEnvelope {
  data: ExtraPaymentListItem[];
}

function listOwnExtraPaymentsQuery(args: { status?: ExtraPaymentStatus } = {}): string {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  const qs = params.toString();
  return qs ? `/tailor-portal/extra-payments?${qs}` : "/tailor-portal/extra-payments";
}

/**
 * Self-service tailor portal — `server/src/routes/tailorPortal.routes.ts`'s endpoints,
 * every one forcing the logged-in tailor's own identity server-side (never a client-
 * supplied tailor id). Mirrors the staff-facing `manufacturingApi.ts`/`extraPaymentsApi.ts`/
 * `payrollApi.ts` endpoints these reuse under the hood — same response shapes, same
 * `ManufacturingComponent` tag invalidation for the assign/complete/attach/remove flow
 * (`TailorJobsPage.tsx` is the tailor-portal equivalent of `JobAssignmentPage.tsx`), so the
 * types are imported from those files rather than redeclared.
 */
export const tailorPortalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    assignSelf: builder.mutation<AssignStepResult, { componentId: string }>({
      query: ({ componentId }) => ({ url: `/tailor-portal/components/${componentId}/assign-self`, method: "POST" }),
      transformResponse: (response: AssignStepResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
    completeSelf: builder.mutation<ManufacturingStep, { jobId: string; componentId: string }>({
      query: ({ jobId }) => ({ url: `/tailor-portal/jobs/${jobId}/complete`, method: "POST" }),
      transformResponse: (response: ManufacturingStepResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
    attachExtraPaymentSelf: builder.mutation<ExtraPayment, { jobId: string; categoryId: string; componentId: string }>({
      query: ({ jobId, categoryId }) => ({ url: `/tailor-portal/jobs/${jobId}/extra-payments`, method: "POST", body: { categoryId } }),
      transformResponse: (response: ExtraPaymentResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [
        { type: "ManufacturingComponent", id: componentId },
        { type: "ExtraPayment", id: "SELF" },
      ],
    }),
    removeExtraPaymentSelf: builder.mutation<void, { jobId: string; categoryId: string; componentId: string }>({
      query: ({ jobId, categoryId }) => ({ url: `/tailor-portal/jobs/${jobId}/extra-payments/${categoryId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { componentId }) => [
        { type: "ManufacturingComponent", id: componentId },
        { type: "ExtraPayment", id: "SELF" },
      ],
    }),
    listOwnSettlements: builder.query<Settlement[], void>({
      query: () => "/tailor-portal/settlements",
      transformResponse: (response: SettlementListResponseEnvelope) => response.data,
    }),
    getOwnSettlement: builder.query<SettlementDetail, string>({
      query: (settlementId) => `/tailor-portal/settlements/${settlementId}`,
      transformResponse: (response: SettlementDetailResponseEnvelope) => response.data,
    }),
    generateOwnSettlementPdf: builder.mutation<{ path: string }, string>({
      query: (settlementId) => ({ url: `/tailor-portal/settlements/${settlementId}/pdf`, method: "POST" }),
      transformResponse: (response: SettlementPdfResponseEnvelope) => response.data,
    }),
    listOwnExtraPayments: builder.query<ExtraPaymentListItem[], { status?: ExtraPaymentStatus } | void>({
      query: (args) => listOwnExtraPaymentsQuery(args ?? {}),
      transformResponse: (response: ExtraPaymentListResponseEnvelope) => response.data,
      providesTags: [{ type: "ExtraPayment", id: "SELF" }],
    }),
  }),
});

export const {
  useAssignSelfMutation,
  useCompleteSelfMutation,
  useAttachExtraPaymentSelfMutation,
  useRemoveExtraPaymentSelfMutation,
  useListOwnSettlementsQuery,
  useGetOwnSettlementQuery,
  useGenerateOwnSettlementPdfMutation,
  useListOwnExtraPaymentsQuery,
} = tailorPortalApi;
