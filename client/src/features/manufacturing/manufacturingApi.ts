import { baseApi } from "../../api/baseApi";

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `manufacturing_steps` table, same shape as `ordersApi.ts`'s `OrderManufacturingStep`. */
export type ManufacturingStepStatus = "pending" | "assigned" | "complete";

export interface ManufacturingStep {
  id: string;
  orderItemComponentId: string;
  processId: string;
  sequenceOrder: number;
  status: ManufacturingStepStatus;
  tailorId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export type BlockedReason = "STEP_LOCKED" | "STEP_IN_PROGRESS" | "NO_STEP_AVAILABLE" | null;

/**
 * `GET /manufacturing/components/:id`'s shape (`manufacturing.service.ts`'s
 * `getComponentDetail`, a small read endpoint this Phase 6 Group 7 frontend
 * work added — see that function's doc comment — since nothing in the
 * existing API let a caller look up a scanned/typed component id and see its
 * steps/next-assignable-process before committing to an assignment).
 */
export interface ComponentDetail {
  id: string;
  orderItemId: string;
  productId: string;
  slotLabel: string;
  manufacturingSteps: ManufacturingStep[];
  nextStep: ManufacturingStep | null;
  blockedReason: BlockedReason;
}

/** Mirrors `server/src/db/schema/manufacturing.ts`'s `jobs` table. */
export interface Job {
  id: string;
  manufacturingStepId: string;
  tailorId: string;
  cost: string;
  stylingPrice: string;
  paid: boolean;
  paidDate: string | null;
}

export interface AssignStepResult {
  step: ManufacturingStep;
  job: Job;
}

interface ComponentDetailResponseEnvelope {
  data: ComponentDetail;
}

interface AssignStepResponseEnvelope {
  data: AssignStepResult;
}

interface ManufacturingStepResponseEnvelope {
  data: ManufacturingStep;
}

/**
 * PHASE_6_TASKS.md Group 7 — the factory floor screens. `getComponentDetail`
 * provides the `ManufacturingComponent` tag so `assignNextStep`/`completeStep`
 * can invalidate it and the lookup screen picks up the new step status
 * without a manual refetch call.
 */
export const manufacturingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getComponentDetail: builder.query<ComponentDetail, string>({
      query: (componentId) => `/manufacturing/components/${componentId}`,
      transformResponse: (response: ComponentDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, componentId) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
    assignNextStep: builder.mutation<AssignStepResult, { componentId: string; tailorId: string }>({
      query: ({ componentId, tailorId }) => ({
        url: `/manufacturing/components/${componentId}/assign`,
        method: "POST",
        body: { tailorId },
      }),
      transformResponse: (response: AssignStepResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
    completeStep: builder.mutation<ManufacturingStep, { jobId: string; componentId: string }>({
      query: ({ jobId }) => ({ url: `/manufacturing/jobs/${jobId}/complete`, method: "POST" }),
      transformResponse: (response: ManufacturingStepResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [{ type: "ManufacturingComponent", id: componentId }],
    }),
  }),
});

export const { useGetComponentDetailQuery, useLazyGetComponentDetailQuery, useAssignNextStepMutation, useCompleteStepMutation } =
  manufacturingApi;
