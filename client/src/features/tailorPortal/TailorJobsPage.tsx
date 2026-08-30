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
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useListProductsQuery } from "../catalog/productsApi";
import { useListExtraPaymentCategoriesQuery } from "../extraPayments/extraPaymentCategoriesApi";
import { getManufacturingErrorMessage, getMessageForCode } from "../manufacturing/manufacturingErrors";
import { useGetComponentDetailQuery } from "../manufacturing/manufacturingApi";
import type { ManufacturingStep, ManufacturingStepStatus } from "../manufacturing/manufacturingApi";
import {
  useAssignSelfMutation,
  useAttachExtraPaymentSelfMutation,
  useCompleteSelfMutation,
  useRemoveExtraPaymentSelfMutation,
} from "./tailorPortalApi";

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
 * Tailor-portal counterpart to `JobAssignmentPage.tsx` — same "one page covers lookup,
 * assign, complete, and extra payments" design and the same `getComponentDetail`-derived
 * state (see that file's doc comment for why `activeJob`/`attachedPayments` are computed
 * fresh from `componentDetail` every render, not mirrored into local state), but every
 * mutation is self-scoped: there's no tailor picker (always the logged-in tailor,
 * `tailorPortalApi.ts`'s `assignSelf`/`completeSelf`/`attachExtraPaymentSelf`/
 * `removeExtraPaymentSelf`, each forcing `req.actor!.id` server-side), and the
 * "Complete job"/"Attach extra payment" UI only ever renders when the component's
 * in-progress step actually belongs to *this* tailor (`componentDetail.activeJob.tailorId
 * === me.id`) — if a different tailor has it in progress, this page shows the same
 * blocked-state message the staff screen shows for `STEP_IN_PROGRESS`/`STEP_LOCKED`,
 * without naming who (this portal never surfaces another tailor's identity/earnings).
 */
export function TailorJobsPage() {
  const { data: me } = useMeQuery();

  const [componentIdInput, setComponentIdInput] = useState("");
  const [lookupId, setLookupId] = useState("");
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
  const { data: extraPaymentCategories } = useListExtraPaymentCategoriesQuery();

  const [assignSelf, assignState] = useAssignSelfMutation();
  const [completeSelf, completeState] = useCompleteSelfMutation();
  const [attachExtraPaymentSelf] = useAttachExtraPaymentSelfMutation();
  const [removeExtraPaymentSelf] = useRemoveExtraPaymentSelfMutation();

  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const processNameById = new Map((processes ?? []).map((process) => [process.id, process.name]));

  function resetSessionState() {
    setExtraPaymentModalOpen(false);
    setPendingCategoryId(null);
    setExtraPaymentModalError(null);
    setAssignError(null);
    setCompleteError(null);
    setFlashMessage(null);
  }

  function handleLookupSubmit(event: FormEvent) {
    event.preventDefault();
    resetSessionState();
    setLookupId(componentIdInput.trim());
  }

  const activeJob: ActiveJob | null = (() => {
    if (!componentDetail?.activeJob || !me) return null;
    if (componentDetail.activeJob.tailorId !== me.id) return null;
    const step = componentDetail.manufacturingSteps.find((s) => s.id === componentDetail.activeJob!.manufacturingStepId);
    if (!step) return null;
    return { id: componentDetail.activeJob.id, step, cost: componentDetail.activeJob.cost, stylingPrice: componentDetail.activeJob.stylingPrice };
  })();

  const attachedPayments: Record<string, AttachedPaymentState> = activeJob
    ? Object.fromEntries((componentDetail?.activeJobExtraPayments ?? []).map((p) => [p.categoryId, { approved: p.approved, rejected: p.rejected }]))
    : {};

  async function handleAssignToMe() {
    if (!componentDetail?.nextStep) return;
    setAssignError(null);
    try {
      await assignSelf({ componentId: componentDetail.id }).unwrap();
    } catch (err) {
      setAssignError(getManufacturingErrorMessage(err, "Failed to assign the step."));
    }
  }

  async function handleAttachExtraPayment(categoryId: string) {
    if (!activeJob || !componentDetail) return;
    setExtraPaymentModalError(null);
    setPendingCategoryId(categoryId);
    try {
      await attachExtraPaymentSelf({ jobId: activeJob.id, categoryId, componentId: componentDetail.id }).unwrap();
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
      await removeExtraPaymentSelf({ jobId: activeJob.id, categoryId, componentId: componentDetail.id }).unwrap();
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
      const payableCategoryIds = Object.keys(attachedPayments).filter((id) => !attachedPayments[id]?.rejected);
      const extraTotal = matchingCategories
        .filter((category) => payableCategoryIds.includes(category.id))
        .reduce((sum, category) => sum + Number(category.cost), 0);

      await completeSelf({ jobId: activeJob.id, componentId: componentDetail.id }).unwrap();

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

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        My Jobs
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Look up an order item component by ID to assign its next manufacturing step to yourself, or complete a step
        you've already assigned to yourself.
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
                Assigned to you — process {processNameById.get(activeJob.step.processId) ?? activeJob.step.processId}
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
                <Button variant="contained" onClick={handleCompleteJob} disabled={completeState.isLoading}>
                  {completeState.isLoading ? "Completing…" : "Complete job"}
                </Button>
                {matchingCategories.length > 0 && (
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
                {assignError && <Alert severity="error">{assignError}</Alert>}
                <Button
                  variant="contained"
                  onClick={handleAssignToMe}
                  disabled={assignState.isLoading}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {assignState.isLoading ? "Assigning…" : "Assign to me"}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Alert severity={componentDetail.blockedReason === "NO_STEP_AVAILABLE" ? "success" : "info"}>
              {getMessageForCode(componentDetail.blockedReason, "This component has no assignable step right now.")}
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
