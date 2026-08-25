import { useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useHasPermission } from "../auth/useHasPermission";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useListProductsQuery } from "../catalog/productsApi";
import { useListExtraPaymentCategoriesQuery } from "../extraPayments/extraPaymentCategoriesApi";
import { useCreateExtraPaymentMutation } from "../extraPayments/extraPaymentsApi";
import { useListTailorsQuery } from "../tailors/tailorsApi";
import { CertifiedTailorSelect } from "./CertifiedTailorSelect";
import { getManufacturingErrorMessage, getMessageForCode } from "./manufacturingErrors";
import { useAssignNextStepMutation, useCompleteStepMutation, useGetComponentDetailQuery } from "./manufacturingApi";
import type { ManufacturingStep, ManufacturingStepStatus } from "./manufacturingApi";

function stepChipColor(status: ManufacturingStepStatus): "default" | "warning" | "success" {
  if (status === "complete") return "success";
  if (status === "assigned") return "warning";
  return "default";
}

interface ActiveJob {
  id: string;
  step: ManufacturingStep;
  cost: string;
  stylingPrice: string;
}

/**
 * Factory floor job-assignment/completion screen — PHASE_6_TASKS.md Group 7.
 * The manual-id/lookup fallback this task explicitly allows: no camera/QR
 * scanning library is installed anywhere in this rewrite's client yet (the
 * legacy `AssignItem.jsx` pulled in `qr-scanner`/`html5-qrcode`, neither of
 * which exist here), so this is a plain text input for the
 * `order_item_component`'s own id — the real QR/scan identifier per
 * `REWRITE_ARCHITECTURE.md`'s QR redesign, just typed instead of scanned.
 *
 * One page covers both halves of the task rather than two separate routes:
 * assigning a step and completing the job it creates are one continuous
 * per-piece workflow on the factory floor (the legacy `AssignItem.jsx`'s
 * "showJob" card did the same — assign, then immediately offer completion +
 * extra payment on that same job). Completing a step that was assigned in an
 * *earlier* session (not this page load) isn't supported — there is no
 * `GET /jobs`/`GET /jobs/:id` endpoint anywhere in the API to look an
 * existing job up by id, only `POST .../assign` and `POST .../complete`, so
 * there is nothing to fetch. That gap is flagged in `PHASE_6_TASKS.md`'s
 * Group 7 write-up rather than invented here. The blocked-state message
 * below (`STEP_IN_PROGRESS`) still tells the operator which tailor already
 * has it, from `manufacturingSteps[].tailorId`, even without the job id.
 *
 * Uses MUI directly (Paper/Stack/Table-free card layout) rather than porting
 * `factory.css`'s bespoke classes/inline styles — Groups 0-6 of this same
 * phase already established plain-MUI as this rewrite's actual factory-floor
 * visual convention (see e.g. `TailorsPage.tsx`, `OrderDetailPage.tsx`), so
 * matching those sibling screens keeps this one consistent with the rest of
 * the rebuilt app rather than reintroducing the legacy bootstrap-era CSS.
 */
export function JobAssignmentPage() {
  const canComplete = useHasPermission("factory.jobs.complete");
  const canManageExtraPayments = useHasPermission("factory.extra_payments.manage");

  const [componentIdInput, setComponentIdInput] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [selectedTailorId, setSelectedTailorId] = useState("");
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const {
    data: componentDetail,
    isFetching: isLookingUp,
    isError: isLookupError,
    error: lookupError,
  } = useGetComponentDetailQuery(lookupId, { skip: !lookupId });

  const { data: products } = useListProductsQuery();
  const { data: processes } = useListProcessesQuery();
  const { data: tailors } = useListTailorsQuery();
  const { data: extraPaymentCategories } = useListExtraPaymentCategoriesQuery();

  const [assignNextStep, assignState] = useAssignNextStepMutation();
  const [completeStep, completeState] = useCompleteStepMutation();
  const [createExtraPayment] = useCreateExtraPaymentMutation();

  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const processNameById = new Map((processes ?? []).map((process) => [process.id, process.name]));
  const tailorNameById = new Map((tailors ?? []).map((tailor) => [tailor.id, tailor.name]));

  function resetSessionState() {
    setActiveJob(null);
    setSelectedCategoryIds([]);
    setSelectedTailorId("");
    setAssignError(null);
    setCompleteError(null);
    setFlashMessage(null);
  }

  function handleLookupSubmit(event: FormEvent) {
    event.preventDefault();
    resetSessionState();
    setLookupId(componentIdInput.trim());
  }

  async function handleAssign() {
    if (!componentDetail?.nextStep || !selectedTailorId) return;
    setAssignError(null);
    try {
      const result = await assignNextStep({ componentId: componentDetail.id, tailorId: selectedTailorId }).unwrap();
      setActiveJob({ id: result.job.id, step: result.step, cost: result.job.cost, stylingPrice: result.job.stylingPrice });
      setSelectedTailorId("");
    } catch (err) {
      setAssignError(getManufacturingErrorMessage(err, "Failed to assign the step."));
    }
  }

  function toggleCategory(categoryId: string, checked: boolean) {
    setSelectedCategoryIds((current) => (checked ? [...current, categoryId] : current.filter((id) => id !== categoryId)));
  }

  async function handleCompleteJob() {
    if (!activeJob || !componentDetail) return;
    setCompleteError(null);
    try {
      let extraTotal = 0;
      for (const categoryId of selectedCategoryIds) {
        const category = matchingCategories.find((c) => c.id === categoryId);
        await createExtraPayment({ jobId: activeJob.id, categoryId }).unwrap();
        extraTotal += Number(category?.cost ?? 0);
      }

      await completeStep({ jobId: activeJob.id, componentId: componentDetail.id }).unwrap();

      const total = Number(activeJob.cost) + Number(activeJob.stylingPrice) + extraTotal;
      setFlashMessage(
        `Job completed${selectedCategoryIds.length > 0 ? ` with ${selectedCategoryIds.length} extra payment(s)` : ""}. Total pay: THB ${total.toFixed(2)}.`
      );
      setActiveJob(null);
      setSelectedCategoryIds([]);
    } catch (err) {
      setCompleteError(getManufacturingErrorMessage(err, "Failed to complete the job."));
    }
  }

  const matchingCategories = (extraPaymentCategories ?? []).filter(
    (category) => componentDetail && activeJob && category.productId === componentDetail.productId && category.processId === activeJob.step.processId
  );

  let blockedTailorName: string | undefined;
  if (componentDetail && (componentDetail.blockedReason === "STEP_LOCKED" || componentDetail.blockedReason === "STEP_IN_PROGRESS")) {
    const inProgressStep = componentDetail.manufacturingSteps.find((s) => s.status === "assigned");
    blockedTailorName = inProgressStep?.tailorId ? tailorNameById.get(inProgressStep.tailorId) : undefined;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Assign / Complete Manufacturing Job
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Look up an order item component by ID (manual entry — no camera/QR scanning in this build) to assign its next
        manufacturing step to a certified tailor, or complete a step you just assigned.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box component="form" onSubmit={handleLookupSubmit}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <TextField
              label="Order item component ID"
              fullWidth
              value={componentIdInput}
              onChange={(event) => setComponentIdInput(event.target.value)}
            />
            <Button type="submit" variant="contained" disabled={!componentIdInput.trim() || isLookingUp}>
              Look up
            </Button>
          </Stack>
        </Box>
      </Paper>

      {isLookupError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {getManufacturingErrorMessage(lookupError, getApiErrorMessage(lookupError, "Failed to look up that component."))}
        </Alert>
      )}

      {componentDetail && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Typography variant="h6">{componentDetail.slotLabel}</Typography>
              <Typography color="text.secondary">
                Product: {productNameById.get(componentDetail.productId) ?? componentDetail.productId}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
            {componentDetail.manufacturingSteps.map((step) => (
              <Chip
                key={step.id}
                size="small"
                color={stepChipColor(step.status)}
                label={`${processNameById.get(step.processId) ?? step.processId}: ${step.status}`}
              />
            ))}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {flashMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {flashMessage}
            </Alert>
          )}

          {activeJob ? (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Job assigned — process {processNameById.get(activeJob.step.processId) ?? activeJob.step.processId}
              </Typography>
              <Typography sx={{ mb: 2 }}>
                Cost: THB {activeJob.cost} (process fee) + THB {activeJob.stylingPrice} (styling) = THB{" "}
                {(Number(activeJob.cost) + Number(activeJob.stylingPrice)).toFixed(2)}
              </Typography>

              {canManageExtraPayments && matchingCategories.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Extra payments for this product/process
                  </Typography>
                  <Stack>
                    {matchingCategories.map((category) => (
                      <FormControlLabel
                        key={category.id}
                        control={
                          <Checkbox
                            checked={selectedCategoryIds.includes(category.id)}
                            onChange={(event) => toggleCategory(category.id, event.target.checked)}
                          />
                        }
                        label={`${category.name}${category.thaiName ? ` / ${category.thaiName}` : ""} — THB ${category.cost}`}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {completeError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {completeError}
                </Alert>
              )}

              {canComplete ? (
                <Button variant="contained" onClick={handleCompleteJob} disabled={completeState.isLoading}>
                  {completeState.isLoading
                    ? "Completing…"
                    : selectedCategoryIds.length > 0
                      ? "Attach extra payment(s) & complete job"
                      : "Complete job"}
                </Button>
              ) : (
                <Alert severity="warning">You do not have permission to complete this job.</Alert>
              )}
            </Box>
          ) : componentDetail.nextStep ? (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Next step: {processNameById.get(componentDetail.nextStep.processId) ?? componentDetail.nextStep.processId}
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 420 }}>
                <CertifiedTailorSelect
                  processId={componentDetail.nextStep.processId}
                  processName={processNameById.get(componentDetail.nextStep.processId) ?? componentDetail.nextStep.processId}
                  value={selectedTailorId}
                  onChange={setSelectedTailorId}
                />
                {assignError && <Alert severity="error">{assignError}</Alert>}
                <Button
                  variant="contained"
                  onClick={handleAssign}
                  disabled={!selectedTailorId || assignState.isLoading}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {assignState.isLoading ? "Assigning…" : "Assign"}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Alert severity={componentDetail.blockedReason === "NO_STEP_AVAILABLE" ? "success" : "info"}>
              {getMessageForCode(componentDetail.blockedReason, "This component has no assignable step right now.")}
              {blockedTailorName ? ` Currently assigned to ${blockedTailorName}.` : ""}
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
}
