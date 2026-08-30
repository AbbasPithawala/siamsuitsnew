import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { getManufacturingErrorMessage } from "../manufacturing/manufacturingErrors";
import { useListTailorsQuery } from "../tailors/tailorsApi";
import {
  useApproveExtraPaymentMutation,
  useListExtraPaymentsQuery,
  useRejectExtraPaymentMutation,
} from "./extraPaymentsApi";
import type { ExtraPaymentListItem, ExtraPaymentStatus } from "./extraPaymentsApi";

type PendingAction = { extraPayment: ExtraPaymentListItem; kind: "approve" | "reject" };

/**
 * Admin approval queue — the new rewrite's counterpart to legacy
 * `siamClient/src/components/superAdmin/pages/Factory/ManageExtraPayments.jsx`,
 * which had no equivalent anywhere in this rewrite until now even though the
 * backend's `approved`/`rejected` gate on payroll (`payroll.service.ts`'s
 * `createSettlement`/`listUnpaidCompletedJobs` only ever include `approved:
 * true` extra payments) has been enforced since Phase 3 Group 5/6 — nothing
 * ever surfaced the pending queue to actually approve or reject through.
 *
 * Deliberately simpler than the legacy page: no bulk-select/bulk-approve
 * (legacy's `selectedPaymentIds` state) and no inline cost/authorized-by
 * editing (legacy's click-to-edit table cells) — neither was asked for here,
 * and both are easy to add later against the same `listExtraPayments`/
 * `approveExtraPayment`/`rejectExtraPayment` endpoints if needed. A tailor
 * filter is kept since it's the one piece of legacy's search bar that's
 * cheap and directly useful for a queue that can span every tailor.
 */
export function ExtraPaymentsApprovalPage() {
  const canApprove = useHasPermission("factory.extra_payments.approve");

  const [statusFilter, setStatusFilter] = useState<ExtraPaymentStatus>("pending");
  const [tailorId, setTailorId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const queryArgs = tailorId ? { status: statusFilter, tailorId } : { status: statusFilter };
  const { data: extraPayments, isLoading, isError, error } = useListExtraPaymentsQuery(queryArgs);
  const { data: tailors } = useListTailorsQuery();

  const [approveExtraPayment, approveState] = useApproveExtraPaymentMutation();
  const [rejectExtraPayment, rejectState] = useRejectExtraPaymentMutation();
  const actionState = pendingAction?.kind === "approve" ? approveState : rejectState;

  function openConfirm(extraPayment: ExtraPaymentListItem, kind: PendingAction["kind"]) {
    setActionError(null);
    setPendingAction({ extraPayment, kind });
  }

  async function handleConfirmAction() {
    if (!pendingAction) return;
    setActionError(null);
    try {
      if (pendingAction.kind === "approve") {
        await approveExtraPayment(pendingAction.extraPayment.id).unwrap();
      } else {
        await rejectExtraPayment(pendingAction.extraPayment.id).unwrap();
      }
      setPendingAction(null);
    } catch (err) {
      setActionError(getManufacturingErrorMessage(err, `Failed to ${pendingAction.kind} that extra payment.`));
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Extra Payments Approval
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Extra payments a tailor's job attaches only ever pay out once approved here — payroll settlement only ever
        includes approved extra payments.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="ep-status-label">Status</InputLabel>
          <Select
            labelId="ep-status-label"
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ExtraPaymentStatus)}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="ep-tailor-label">Tailor</InputLabel>
          <Select labelId="ep-tailor-label" label="Tailor" value={tailorId} onChange={(event) => setTailorId(event.target.value)}>
            <MenuItem value="">
              <em>All tailors</em>
            </MenuItem>
            {tailors?.map((tailor) => (
              <MenuItem key={tailor.id} value={tailor.id}>
                {tailor.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load extra payments.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tailor</TableCell>
              <TableCell>Order #</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Authorized by</TableCell>
              {statusFilter === "pending" && canApprove && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {extraPayments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={statusFilter === "pending" && canApprove ? 8 : 7}>
                  <Typography color="text.secondary">No {statusFilter} extra payments.</Typography>
                </TableCell>
              </TableRow>
            )}
            {extraPayments?.map((extraPayment) => (
              <TableRow key={extraPayment.id}>
                <TableCell>{extraPayment.tailor?.name ?? "—"}</TableCell>
                <TableCell>{extraPayment.order?.orderNumber ?? "—"}</TableCell>
                <TableCell>{extraPayment.component?.slotLabel ?? "—"}</TableCell>
                <TableCell>
                  {extraPayment.category?.name ?? "—"}
                  {extraPayment.category?.thaiName ? ` / ${extraPayment.category.thaiName}` : ""}
                </TableCell>
                <TableCell align="right">{extraPayment.cost}</TableCell>
                <TableCell>{new Date(extraPayment.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{extraPayment.authorizedBy || "N/A"}</TableCell>
                {statusFilter === "pending" && canApprove && (
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="contained" color="success" onClick={() => openConfirm(extraPayment, "approve")}>
                        Approve
                      </Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => openConfirm(extraPayment, "reject")}>
                        Decline
                      </Button>
                    </Stack>
                  </TableCell>
                )}
                {statusFilter !== "pending" && (
                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={extraPayment.approved ? "success" : "error"}
                      label={extraPayment.approved ? "Approved" : "Rejected"}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={pendingAction !== null} onClose={() => setPendingAction(null)}>
        <DialogTitle>Confirm {pendingAction?.kind === "approve" ? "approval" : "decline"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {pendingAction?.kind === "approve" ? "approve" : "decline"} the{" "}
            {pendingAction?.extraPayment.category?.name ?? "extra payment"} payment of THB {pendingAction?.extraPayment.cost} for{" "}
            {pendingAction?.extraPayment.tailor?.name ?? "this tailor"}?
          </DialogContentText>
          {actionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {actionError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAction(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={pendingAction?.kind === "approve" ? "success" : "error"}
            onClick={handleConfirmAction}
            disabled={actionState.isLoading}
          >
            {actionState.isLoading ? "Saving…" : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
