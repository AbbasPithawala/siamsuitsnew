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
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import {
  useApproveTenantRequestMutation,
  useListTenantRequestsQuery,
  useRejectTenantRequestMutation,
} from "./tenantRequestsApi";
import type { ApproveTenantRequestResult, TenantRequest, TenantRequestStatus } from "./tenantRequestsApi";

type StatusFilter = TenantRequestStatus | "all";

const EMPTY_APPROVE_FORM = { slug: "", plan: "", logo: "", address: "", invoiceFooterText: "" };

/**
 * PHASE_11_TASKS.md Workstream F Group 1 — the superadmin's queue of public tenant-signup
 * requests (`RequestAccessPage.tsx`'s server-side counterpart). The approve dialog's five
 * fields are the hybrid pre-fill surface (Decision C5/the locked "hybrid" business-profile
 * decision): leaving them blank still provisions a real tenant, just one whose owner is forced
 * through `RequireProfileComplete`'s onboarding flow on first login instead of skipping it.
 *
 * Terminal requests (approved/rejected) hide the approve/reject actions entirely rather than
 * leaving them clickable-but-erroring — the backend 409s a re-approve/re-reject of a
 * non-pending request, but there's no reason to let a superadmin discover that by clicking.
 */
export function TenantRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const pagination = usePagination();
  const {
    data: requestsResponse,
    isLoading,
    isError,
    error,
  } = useListTenantRequestsQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
    ...(statusFilter === "all" ? {} : { status: statusFilter }),
  });
  const requests = requestsResponse?.data;

  const [approveTarget, setApproveTarget] = useState<TenantRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TenantRequest | null>(null);
  const [approveResult, setApproveResult] = useState<ApproveTenantRequestResult | null>(null);

  function handleStatusFilterChange(value: StatusFilter) {
    setStatusFilter(value);
    pagination.onPageChange(1);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Tenant Requests
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Public sign-up requests submitted from the request-access page. Approving one provisions a
        real tenant and its Owner account immediately.
      </Typography>

      <FormControl sx={{ minWidth: 200, mb: 2 }}>
        <InputLabel id="tenant-request-status-label">Status</InputLabel>
        <Select
          labelId="tenant-request-status-label"
          label="Status"
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value as StatusFilter)}
        >
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
          <MenuItem value="all">All</MenuItem>
        </Select>
      </FormControl>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load tenant requests.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Business</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Requested slug</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No {statusFilter === "all" ? "" : statusFilter} requests.</Typography>
                </TableCell>
              </TableRow>
            )}
            {requests?.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.businessName}</TableCell>
                <TableCell>
                  {request.contactName}
                  <Typography variant="body2" color="text.secondary">
                    {request.email} &middot; {request.phone}
                  </Typography>
                </TableCell>
                <TableCell>{request.requestedSlug}</TableCell>
                <TableCell>
                  {request.status === "pending" && <Chip size="small" label="Pending" color="warning" />}
                  {request.status === "approved" && (
                    <Tooltip title={request.createdTenantId ? `Tenant ID: ${request.createdTenantId}` : ""}>
                      <Chip size="small" label="Approved" color="success" />
                    </Tooltip>
                  )}
                  {request.status === "rejected" && (
                    <Tooltip title={request.rejectionReason ?? ""}>
                      <Chip size="small" label="Rejected" color="error" />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="right">
                  {request.status === "pending" && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="contained" color="success" onClick={() => setApproveTarget(request)}>
                        Approve
                      </Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => setRejectTarget(request)}>
                        Reject
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={requestsResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <ApproveTenantRequestDialog
        request={approveTarget}
        onClose={() => setApproveTarget(null)}
        onApproved={(result) => {
          setApproveTarget(null);
          setApproveResult(result);
        }}
      />
      <RejectTenantRequestDialog request={rejectTarget} onClose={() => setRejectTarget(null)} />
      <ApprovalResultDialog result={approveResult} onClose={() => setApproveResult(null)} />
    </Box>
  );
}

interface ApproveTenantRequestDialogProps {
  request: TenantRequest | null;
  onClose: () => void;
  onApproved: (result: ApproveTenantRequestResult) => void;
}

function ApproveTenantRequestDialog({ request, onClose, onApproved }: ApproveTenantRequestDialogProps) {
  const [form, setForm] = useState(EMPTY_APPROVE_FORM);
  const [approveTenantRequest, approveState] = useApproveTenantRequestMutation();

  function handleClose() {
    setForm(EMPTY_APPROVE_FORM);
    onClose();
  }

  async function handleSubmit() {
    if (!request) return;
    try {
      const result = await approveTenantRequest({
        id: request.id,
        body: {
          ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
          ...(form.plan.trim() ? { plan: form.plan.trim() } : {}),
          ...(form.logo.trim() ? { logo: form.logo.trim() } : {}),
          ...(form.address.trim() ? { address: form.address.trim() } : {}),
          ...(form.invoiceFooterText.trim() ? { invoiceFooterText: form.invoiceFooterText.trim() } : {}),
        },
      }).unwrap();
      setForm(EMPTY_APPROVE_FORM);
      onApproved(result);
    } catch {
      // surfaced below via approveState.error
    }
  }

  return (
    <Dialog open={request !== null} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Approve request — {request?.businessName}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Every field below is optional. Leave them blank to let the new owner complete their own
          business profile on first login instead.
        </DialogContentText>
        <Stack spacing={2}>
          <TextField
            label="Slug override"
            fullWidth
            placeholder={request?.requestedSlug ?? ""}
            helperText="Defaults to the requested slug if left blank."
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
          />
          <TextField
            label="Plan"
            fullWidth
            value={form.plan}
            onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
          />
          <TextField
            label="Logo URL"
            fullWidth
            value={form.logo}
            onChange={(event) => setForm((current) => ({ ...current, logo: event.target.value }))}
          />
          <TextField
            label="Business address"
            fullWidth
            multiline
            minRows={2}
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          />
          <TextField
            label="Invoice footer text"
            fullWidth
            value={form.invoiceFooterText}
            onChange={(event) => setForm((current) => ({ ...current, invoiceFooterText: event.target.value }))}
          />
          {approveState.error && (
            <Alert severity="error">{getApiErrorMessage(approveState.error, "Failed to approve request.")}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" color="success" onClick={handleSubmit} disabled={approveState.isLoading}>
          {approveState.isLoading ? "Approving…" : "Approve"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface RejectTenantRequestDialogProps {
  request: TenantRequest | null;
  onClose: () => void;
}

function RejectTenantRequestDialog({ request, onClose }: RejectTenantRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [rejectTenantRequest, rejectState] = useRejectTenantRequestMutation();

  function handleClose() {
    setReason("");
    onClose();
  }

  async function handleSubmit() {
    if (!request || reason.trim().length === 0) return;
    try {
      await rejectTenantRequest({ id: request.id, body: { reason: reason.trim() } }).unwrap();
      setReason("");
      onClose();
    } catch {
      // surfaced below via rejectState.error
    }
  }

  return (
    <Dialog open={request !== null} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Reject request — {request?.businessName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Reason"
            required
            fullWidth
            multiline
            minRows={2}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {rejectState.error && (
            <Alert severity="error">{getApiErrorMessage(rejectState.error, "Failed to reject request.")}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={reason.trim().length === 0 || rejectState.isLoading}
        >
          {rejectState.isLoading ? "Rejecting…" : "Reject"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface ApprovalResultDialogProps {
  result: ApproveTenantRequestResult | null;
  onClose: () => void;
}

/**
 * C4's manual-relay fallback, surfaced in the UI: the approve route always returns the real
 * generated credentials regardless of whether the welcome email actually sent, so a superadmin
 * working without SMTP configured can still relay them to the new owner by hand.
 */
function ApprovalResultDialog({ result, onClose }: ApprovalResultDialogProps) {
  return (
    <Dialog open={result !== null} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Tenant provisioned</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography>
            <strong>{result?.tenant.name}</strong> ({result?.tenant.slug}) is ready.
          </Typography>
          <Typography>
            Owner username: <strong data-testid="approval-owner-username">{result?.ownerUser.username}</strong>
          </Typography>
          <Typography>
            Temporary password: <strong data-testid="approval-temp-password">{result?.tempPassword}</strong>
          </Typography>
          {result?.emailSent ? (
            <Alert severity="success">A welcome email with these credentials was sent to the requester.</Alert>
          ) : (
            <Alert severity="warning">
              The welcome email could not be sent — relay these credentials to the requester manually.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
