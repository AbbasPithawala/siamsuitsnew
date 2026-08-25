import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Payments as PaymentsIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import { useHasPermission } from "../auth/useHasPermission";
import { useCreateAdvancePaymentMutation } from "../payroll/payrollApi";
import { TailorCertificationsEditor } from "./TailorCertificationsEditor";
import {
  useCreateTailorMutation,
  useDeleteTailorMutation,
  useGetTailorQuery,
  useListTailorsPaginatedQuery,
  useUpdateTailorMutation,
} from "./tailorsApi";
import type { Tailor } from "./tailorsApi";

const MIN_PASSWORD_LENGTH = 8;

interface TailorFormState {
  name: string;
  username: string;
  password: string;
  isActive: boolean;
}

const EMPTY_FORM: TailorFormState = { name: "", username: "", password: "", isActive: true };

/**
 * Tailors admin — PHASE_6_TASKS.md Group 4, the closest sibling to
 * `UsersPage.tsx` (Phase 5 Group 4): a password field that only exists on
 * create (`createTailorSchema` in `tailors.routes.ts` requires it, min 8
 * chars, hashed server-side; this page deliberately doesn't wire a "reset
 * password" control on edit), plus a nested certifications sub-view — the
 * process equivalent of that page's `UserRolesEditor` roles checkbox list.
 * Gated by `RequirePermission permission="factory.tailors.manage"` at the
 * route level in `AppRoutes.tsx`, same page-level-gate reasoning as
 * `UsersPage.tsx`, so no `useHasPermission` button checks are needed here.
 *
 * This is the screen `PHASE_6_TASKS.md` calls out as making Phase 3's
 * manufacturing assignment actually usable by someone who isn't editing the
 * database by hand — the acceptance test is creating a tailor and certifying
 * them for a real process entirely through this UI.
 */
export function TailorsPage() {
  const pagination = usePagination();
  const { data: tailorsResponse, isLoading, isError, error } = useListTailorsPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const tailors = tailorsResponse?.data;
  const canManageAdvances = useHasPermission("factory.advance_payments.manage");

  const [createTailor, createState] = useCreateTailorMutation();
  const [updateTailor, updateState] = useUpdateTailorMutation();
  const [deleteTailor, deleteState] = useDeleteTailorMutation();
  const [createAdvancePayment, advanceState] = useCreateAdvancePaymentMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TailorFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Tailor | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<Tailor | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");

  const mutationState = editingId ? updateState : createState;
  const { data: editingTailorDetail } = useGetTailorQuery(editingId ?? "", { skip: !editingId });

  const isFormValid =
    form.name.trim().length > 0 &&
    form.username.trim().length > 0 &&
    (editingId !== null || form.password.length >= MIN_PASSWORD_LENGTH);

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(tailor: Tailor) {
    setEditingId(tailor.id);
    setForm({ name: tailor.name, username: tailor.username, password: "", isActive: tailor.isActive });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      if (editingId) {
        await updateTailor({
          id: editingId,
          body: { name: form.name.trim(), username: form.username.trim(), isActive: form.isActive },
        }).unwrap();
      } else {
        await createTailor({ name: form.name.trim(), username: form.username.trim(), password: form.password }).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteTailor(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // see ProductsPage.tsx's identical comment
    }
  }

  function openAdvanceDialog(tailor: Tailor) {
    setAdvanceTarget(tailor);
    setAdvanceAmount("");
  }

  async function handleRecordAdvance() {
    if (!advanceTarget) return;
    const amount = Number(advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      await createAdvancePayment({ tailorId: advanceTarget.id, amount }).unwrap();
      setAdvanceTarget(null);
      setAdvanceAmount("");
    } catch {
      // surfaced below via advanceState.error
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Tailors</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Tailor
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load tailors.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Certified processes</TableCell>
              <TableCell align="right">Advance balance</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tailors?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">No tailors yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {tailors?.map((tailor) => (
              <TailorRow
                key={tailor.id}
                tailor={tailor}
                canManageAdvances={canManageAdvances}
                onEdit={() => openEditDialog(tailor)}
                onDelete={() => setDeleteTarget(tailor)}
                onRecordAdvance={() => openAdvanceDialog(tailor)}
              />
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={tailorsResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Tailor" : "Add Tailor"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <TextField
              label="Username"
              required
              fullWidth
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            />
            {editingId === null && (
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            )}
            {editingId !== null && (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                }
                label="Active"
              />
            )}
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save tailor.")}</Alert>
            )}

            {editingId && (
              <>
                <Divider />
                {editingTailorDetail ? (
                  <TailorCertificationsEditor tailorId={editingId} certifications={editingTailorDetail.certifications} />
                ) : (
                  <Typography color="text.secondary">Loading certifications…</Typography>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid || mutationState.isLoading}>
            {editingId ? "Save" : "Add Tailor"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        itemLabel={deleteTarget?.name ?? ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        isDeleting={deleteState.isLoading}
      />

      {/*
        PHASE_6_TASKS.md Group 8: recording a cash advance
        (`POST /tailors/:id/advances`). Reached from this admin screen rather
        than a standalone page — `TailorsPage` already owns the tailor roster
        and now shows each tailor's running `advanceBalance`, so "add an
        advance for this tailor" belongs next to that balance, same
        page-composition reasoning as the certifications editor nested in the
        edit dialog above. Gated separately from `factory.tailors.manage`
        (this page's own route-level gate) via `factory.advance_payments.manage`
        — an actor might hold one without the other (`server/src/db/seed/permissions.ts`).
      */}
      <Dialog open={advanceTarget !== null} onClose={() => setAdvanceTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Record Cash Advance — {advanceTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary">
              Current outstanding balance: THB {advanceTarget?.advanceBalance ?? "0.00"}
            </Typography>
            <TextField
              label="Advance amount"
              type="number"
              required
              fullWidth
              autoFocus
              inputProps={{ min: 0, step: "0.01" }}
              value={advanceAmount}
              onChange={(event) => setAdvanceAmount(event.target.value)}
            />
            {advanceState.error && (
              <Alert severity="error">{getApiErrorMessage(advanceState.error, "Failed to record advance.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvanceTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordAdvance}
            disabled={!(Number(advanceAmount) > 0) || advanceState.isLoading}
          >
            {advanceState.isLoading ? "Recording…" : "Record Advance"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface TailorRowProps {
  tailor: Tailor;
  canManageAdvances: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRecordAdvance: () => void;
}

/**
 * Separate row component so the certified-process count can come from its
 * own `useGetTailorQuery(tailor.id)` cache entry without every row in the
 * list forcing `listTailors` itself to carry the nested certifications
 * array (`listTailors` in `tailors.service.ts` deliberately doesn't; only
 * `getTailor` does).
 */
function TailorRow({ tailor, canManageAdvances, onEdit, onDelete, onRecordAdvance }: TailorRowProps) {
  const { data: detail } = useGetTailorQuery(tailor.id);

  return (
    <TableRow>
      <TableCell>{tailor.name}</TableCell>
      <TableCell>{tailor.username}</TableCell>
      <TableCell>
        <Chip size="small" label={tailor.isActive ? "Active" : "Inactive"} color={tailor.isActive ? "success" : "default"} />
      </TableCell>
      <TableCell align="right">{detail ? detail.certifications.length : "…"}</TableCell>
      <TableCell align="right">THB {tailor.advanceBalance}</TableCell>
      <TableCell align="right">
        {canManageAdvances && (
          <IconButton aria-label={`Record advance for ${tailor.name}`} onClick={onRecordAdvance}>
            <PaymentsIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton aria-label={`Edit ${tailor.name}`} onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton aria-label={`Delete ${tailor.name}`} onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
