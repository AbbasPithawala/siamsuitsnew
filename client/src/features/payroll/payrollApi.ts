import { baseApi } from "../../api/baseApi";
import type { Tailor } from "../tailors/tailorsApi";

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `worker_advance_payments` table. */
export interface AdvancePayment {
  id: string;
  tailorId: string;
  amount: string;
  cleared: boolean;
  clearedAt: string | null;
  paymentSettlementId: string | null;
}

export interface CreateAdvanceResult {
  advance: AdvancePayment;
  tailor: Tailor;
}

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `jobs` table. */
export interface UnpaidJob {
  id: string;
  manufacturingStepId: string;
  tailorId: string;
  cost: string;
  stylingPrice: string;
  paid: boolean;
  paidDate: string | null;
}

export interface ExtraPaymentRef {
  id: string;
  categoryId: string;
  cost: string;
  approved: boolean;
  paid: boolean;
}

/**
 * `payroll.service.ts`'s `listUnpaidCompletedJobs` return shape — the small
 * backend read PHASE_6_TASKS.md Group 8 confirmed was missing and added
 * (`GET /tailors/:tailorId/unpaid-jobs`). Enriched with just enough of the
 * job's component/process/product to render a settlement-selection row, plus
 * a preview of the extra payments `createSettlement` will fold into
 * `subTotal` — a preview only; the real settlement total always comes back
 * from `createSettlement`/`getSettlement` itself, never computed here.
 */
export interface UnpaidJobEntry {
  job: UnpaidJob;
  process: { id: string; name: string; thaiName: string | null } | null;
  component: { id: string; slotLabel: string; orderItemId: string } | null;
  product: { id: string; name: string } | null;
  approvedUnpaidExtraPayments: ExtraPaymentRef[];
}

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `payment_settlements` table — every amount server-computed, per `createSettlement`'s doc comment. */
export interface Settlement {
  id: string;
  tailorId: string;
  subTotal: string;
  deductedAdvance: string;
  rent: string;
  manualBill: string;
  totalPay: string;
  createdAt: string;
}

export interface CreateSettlementInput {
  tailorId: string;
  jobIds: string[];
  rent?: number;
  manualBill?: number;
  deductedAdvance?: number;
}

/**
 * `payroll.service.ts`'s `getSettlement` return shape, enriched (not a new
 * endpoint — PHASE_6_TASKS.md Group 8's UI requirement that a settlement
 * visibly reflect the `worker_advance_payments.cleared`/`extra_payments.paid`
 * flags it flips) with the specific advance/extra-payment rows this
 * settlement actually cleared/paid, for the settlement confirmation view.
 */
export interface SettlementDetail {
  settlement: Settlement;
  jobs: UnpaidJob[];
  extraPayments: ExtraPaymentRef[];
  clearedAdvances: AdvancePayment[];
}

interface CreateAdvanceResponseEnvelope {
  data: CreateAdvanceResult;
}

interface UnpaidJobListResponseEnvelope {
  data: UnpaidJobEntry[];
}

interface SettlementResponseEnvelope {
  data: Settlement;
}

interface SettlementDetailResponseEnvelope {
  data: SettlementDetail;
}

/**
 * PHASE_6_TASKS.md Group 8 — payroll UI. `createAdvancePayment` and
 * `createSettlement` both invalidate the `Tailor` tag (list + the specific
 * tailor) so `advanceBalance` shown on `TailorsPage` updates immediately,
 * without that page needing to know anything about payroll. `createSettlement`
 * also invalidates `UnpaidJob` for the settled tailor, since every job it
 * just settled must drop out of that list on the next read.
 */
export const payrollApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createAdvancePayment: builder.mutation<CreateAdvanceResult, { tailorId: string; amount: number }>({
      query: ({ tailorId, amount }) => ({ url: `/tailors/${tailorId}/advances`, method: "POST", body: { amount } }),
      transformResponse: (response: CreateAdvanceResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { tailorId }) => [
        { type: "Tailor", id: tailorId },
        { type: "Tailor", id: "LIST" },
      ],
    }),
    listUnpaidJobs: builder.query<UnpaidJobEntry[], string>({
      query: (tailorId) => `/tailors/${tailorId}/unpaid-jobs`,
      transformResponse: (response: UnpaidJobListResponseEnvelope) => response.data,
      providesTags: (_result, _error, tailorId) => [{ type: "UnpaidJob", id: tailorId }],
    }),
    createSettlement: builder.mutation<Settlement, CreateSettlementInput>({
      query: ({ tailorId, ...body }) => ({ url: `/tailors/${tailorId}/settlements`, method: "POST", body }),
      transformResponse: (response: SettlementResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { tailorId }) => [
        { type: "UnpaidJob", id: tailorId },
        { type: "Tailor", id: tailorId },
        { type: "Tailor", id: "LIST" },
      ],
    }),
    getSettlement: builder.query<SettlementDetail, { tailorId: string; settlementId: string }>({
      query: ({ tailorId, settlementId }) => `/tailors/${tailorId}/settlements/${settlementId}`,
      transformResponse: (response: SettlementDetailResponseEnvelope) => response.data,
    }),
  }),
});

export const { useCreateAdvancePaymentMutation, useListUnpaidJobsQuery, useCreateSettlementMutation, useGetSettlementQuery } = payrollApi;
