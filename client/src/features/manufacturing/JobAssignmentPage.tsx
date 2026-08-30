import { useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useHasPermission } from "../auth/useHasPermission";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useListProductsQuery } from "../catalog/productsApi";
import { useListExtraPaymentCategoriesQuery } from "../extraPayments/extraPaymentCategoriesApi";
import { useCreateExtraPaymentMutation, useRemoveExtraPaymentMutation } from "../extraPayments/extraPaymentsApi";
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

interface AttachedPaymentState {
  approved: boolean;
  rejected: boolean;
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
 * extra payment on that same job). There's still no generic `GET /jobs/:id`,
 * but `getComponentDetail` resolves the one in-progress job this screen
 * actually needs (`ComponentDetail.activeJob`, plus its already-attached
 * extra payments' approved/rejected status), so re-looking-up a component —
 * even after a reload, in a new tab, or in a different session entirely —
 * recovers the "Complete job" screen rather than only the blocked-state
 * message. An attached-but-still-pending extra payment can be removed again
 * from here (`removeExtraPayment`) right up until the job completes; once
 * an admin approves or rejects it on `ExtraPaymentsApprovalPage.tsx`, or the
 * job completes, it's locked from this screen.
 *
 * `activeJob`/`attachedPayments` below are derived straight from
 * `componentDetail` every render rather than mirrored into local state via
 * an effect — every mutation that changes either (`assignNextStep`,
 * `createExtraPayment`, `removeExtraPayment`, `completeStep`) already
 * invalidates the `ManufacturingComponent` tag, so the refetched
 * `componentDetail` is the single source of truth and there's nothing for
 * local state to add except a stale-copy bug and a "setState in an effect"
 * lint error.
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
  const [extraPaymentModalOpen, setExtraPaymentModalOpen] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [extraPaymentModalError, setExtraPaymentModalError] = useState<string | null>(null);
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
  const [removeExtraPayment] = useRemoveExtraPaymentMutation();

  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const processNameById = new Map((processes ?? []).map((process) => [process.id, process.name]));
  const tailorNameById = new Map((tailors ?? []).map((tailor) => [tailor.id, tailor.name]));

  function resetSessionState() {
    setExtraPaymentModalOpen(false);
    setPendingCategoryId(null);
    setExtraPaymentModalError(null);
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

  // Derived from `componentDetail` (see this file's doc comment) — recovers an
  // in-progress job on any fresh lookup, a reload included, not just the
  // browser tab that made the original `assignNextStep` call.
  const activeJob: ActiveJob | null = (() => {
    if (!componentDetail?.activeJob) return null;
    const step = componentDetail.manufacturingSteps.find((s) => s.id === componentDetail.activeJob!.manufacturingStepId);
    if (!step) return null;
    return { id: componentDetail.activeJob.id, step, cost: componentDetail.activeJob.cost, stylingPrice: componentDetail.activeJob.stylingPrice };
  })();

  const attachedPayments: Record<string, AttachedPaymentState> = Object.fromEntries(
    (componentDetail?.activeJobExtraPayments ?? []).map((p) => [p.categoryId, { approved: p.approved, rejected: p.rejected }])
  );

  async function handleAssign() {
    if (!componentDetail?.nextStep || !selectedTailorId) return;
    setAssignError(null);
    try {
      await assignNextStep({ componentId: componentDetail.id, tailorId: selectedTailorId }).unwrap();
      setSelectedTailorId("");
    } catch (err) {
      setAssignError(getManufacturingErrorMessage(err, "Failed to assign the step."));
    }
  }

  async function handleAttachExtraPayment(categoryId: string) {
    if (!activeJob || !componentDetail) return;
    setExtraPaymentModalError(null);
    setPendingCategoryId(categoryId);
    try {
      await createExtraPayment({ jobId: activeJob.id, categoryId, componentId: componentDetail.id }).unwrap();
    } catch (err) {
      setExtraPaymentModalError(getManufacturingErrorMessage(err, "Failed to attach that extra payment."));
    } finally {
      setPendingCategoryId(null);
    }
  }

  async function handleRemoveExtraPayment(categoryId: string) {
    if (!activeJob || !componentDetail) return;
    setExtraPaymentModalError(null);
    setPendingCategoryId(categoryId);
    try {
      await removeExtraPayment({ jobId: activeJob.id, categoryId, componentId: componentDetail.id }).unwrap();
    } catch (err) {
      setExtraPaymentModalError(getManufacturingErrorMessage(err, "Failed to remove that extra payment."));
    } finally {
      setPendingCategoryId(null);
    }
  }

  async function handleCompleteJob() {
    if (!activeJob || !componentDetail) return;
    setCompleteError(null);
    try {
      // Rejected attachments don't count toward the preview total below — an admin already
      // decided this one isn't getting paid. The real payroll total is always recomputed
      // server-side from `approved` extra payments at settlement time regardless (see
      // `payroll.service.ts`'s `createSettlement`); this is display-only.
      const payableCategoryIds = Object.keys(attachedPayments).filter((id) => !attachedPayments[id]?.rejected);
      const extraTotal = matchingCategories
        .filter((category) => payableCategoryIds.includes(category.id))
        .reduce((sum, category) => sum + Number(category.cost), 0);

      await completeStep({ jobId: activeJob.id, componentId: componentDetail.id }).unwrap();

      const total = Number(activeJob.cost) + Number(activeJob.stylingPrice) + extraTotal;
      setFlashMessage(
        `Job completed${payableCategoryIds.length > 0 ? ` with ${payableCategoryIds.length} extra payment(s)` : ""}. Total pay: THB ${total.toFixed(2)}.`
      );
      setExtraPaymentModalOpen(false);
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

              {Object.keys(attachedPayments).length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {Object.keys(attachedPayments).length} extra payment(s) attached.
                </Typography>
              )}

              {completeError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {completeError}
                </Alert>
              )}

              <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
                {canComplete ? (
                  <Button variant="contained" onClick={handleCompleteJob} disabled={completeState.isLoading}>
                    {completeState.isLoading ? "Completing…" : "Complete job"}
                  </Button>
                ) : (
                  <Alert severity="warning">You do not have permission to complete this job.</Alert>
                )}
                {canManageExtraPayments && matchingCategories.length > 0 && (
                  <Button variant="outlined" onClick={() => setExtraPaymentModalOpen(true)}>
                    Attach extra payment
                  </Button>
                )}
              </Stack>
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

      <Dialog open={extraPaymentModalOpen} onClose={() => setExtraPaymentModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Attach extra payment</DialogTitle>
        <DialogContent>
          {extraPaymentModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {extraPaymentModalError}
            </Alert>
          )}
          <List disablePadding>
            {matchingCategories.map((category) => {
              const attached = attachedPayments[category.id];
              const isPending = pendingCategoryId === category.id;
              return (
                <ListItem
                  key={category.id}
                  disableGutters
                  secondaryAction={
                    !attached ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAttachExtraPayment(category.id)}
                        disabled={isPending}
                      >
                        {isPending ? "Adding…" : "Add"}
                      </Button>
                    ) : attached.approved ? (
                      <Chip size="small" color="success" label="Approved" />
                    ) : attached.rejected ? (
                      <Chip size="small" color="error" label="Rejected" />
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" color="success" label="Added" />
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRemoveExtraPayment(category.id)}
                          disabled={isPending}
                        >
                          {isPending ? "Removing…" : "Remove"}
                        </Button>
                      </Stack>
                    )
                  }
                >
                  <ListItemText
                    primary={`${category.name}${category.thaiName ? ` / ${category.thaiName}` : ""}`}
                    secondary={`THB ${category.cost}`}
                  />
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtraPaymentModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
