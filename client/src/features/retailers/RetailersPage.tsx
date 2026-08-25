import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import {
  useCreateRetailerMutation,
  useDeleteRetailerMutation,
  useListRetailersPaginatedQuery,
  useUpdateRetailerMutation,
} from "./retailersApi";
import type { Retailer, RetailerInput } from "./retailersApi";

interface RetailerFormState {
  name: string;
  code: string;
  ownerName: string;
  logo: string;
  address: string;
  phone: string;
  emailRecipients: string;
  isActive: boolean;
}

const EMPTY_FORM: RetailerFormState = {
  name: "",
  code: "",
  ownerName: "",
  logo: "",
  address: "",
  phone: "",
  emailRecipients: "",
  isActive: true,
};

function parseEmailRecipients(raw: string): string[] | undefined {
  const emails = raw
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
  return emails.length > 0 ? emails : undefined;
}

function toBody(form: RetailerFormState, includeIsActive: boolean): RetailerInput {
  const body: RetailerInput = { name: form.name.trim(), code: form.code.trim() };
  const ownerName = form.ownerName.trim();
  if (ownerName) body.ownerName = ownerName;
  const logo = form.logo.trim();
  if (logo) body.logo = logo;
  const address = form.address.trim();
  if (address) body.address = address;
  const phone = form.phone.trim();
  if (phone) body.phone = phone;
  const emailRecipients = parseEmailRecipients(form.emailRecipients);
  if (emailRecipients) body.emailRecipients = emailRecipients;
  if (includeIsActive) body.isActive = form.isActive;
  return body;
}

/**
 * Retailers admin — PHASE_6_TASKS.md Group 4, replacing Phase 4's
 * `RetailersPlaceholderPage` at the same `/retailers` route (still gated by
 * `RequirePermission permission="retailers.manage"` at the route level in
 * `AppRoutes.tsx`, so no `useHasPermission` button checks are needed here —
 * same page-level-gate reasoning as `UsersPage.tsx`/`RolesPage.tsx`).
 *
 * Fields mirror `server/src/db/schema/tenancy.ts`'s `retailers` table:
 * name, code (tenant-unique), ownerName, logo, emailRecipients (a text
 * array — edited here as a comma-separated string and split/joined at the
 * form boundary rather than building a full chip-input control for a single
 * admin field). `isActive` is only editable, not settable on create (same
 * convention as `UsersPage.tsx`); deactivation otherwise happens via the
 * separate soft-delete action.
 */
export function RetailersPage() {
  const pagination = usePagination();
  const { data: retailersResponse, isLoading, isError, error } = useListRetailersPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const retailers = retailersResponse?.data;
  const [createRetailer, createState] = useCreateRetailerMutation();
  const [updateRetailer, updateState] = useUpdateRetailerMutation();
  const [deleteRetailer, deleteState] = useDeleteRetailerMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RetailerFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Retailer | null>(null);

  const mutationState = editingId ? updateState : createState;
  const isFormValid = form.name.trim().length > 0 && form.code.trim().length > 0;

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(retailer: Retailer) {
    setEditingId(retailer.id);
    setForm({
      name: retailer.name,
      code: retailer.code,
      ownerName: retailer.ownerName ?? "",
      logo: retailer.logo ?? "",
      address: retailer.address ?? "",
      phone: retailer.phone ?? "",
      emailRecipients: retailer.emailRecipients?.join(", ") ?? "",
      isActive: retailer.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toBody(form, editingId !== null);
    try {
      if (editingId) {
        await updateRetailer({ id: editingId, body }).unwrap();
      } else {
        await createRetailer(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteRetailer(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // see ProductsPage.tsx's identical comment
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Retailers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Retailer
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load retailers.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {retailers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">No retailers yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {retailers?.map((retailer) => (
              <TableRow key={retailer.id}>
                <TableCell>{retailer.name}</TableCell>
                <TableCell>{retailer.code}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={retailer.isActive ? "Active" : "Inactive"}
                    color={retailer.isActive ? "success" : "default"}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton aria-label={`Edit ${retailer.name}`} onClick={() => openEditDialog(retailer)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label={`Delete ${retailer.name}`} onClick={() => setDeleteTarget(retailer)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={retailersResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Retailer" : "Add Retailer"}</DialogTitle>
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
              label="Code"
              required
              fullWidth
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            />
            <TextField
              label="Owner name"
              fullWidth
              value={form.ownerName}
              onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
            />
            <TextField
              label="Logo URL"
              fullWidth
              value={form.logo}
              onChange={(event) => setForm((current) => ({ ...current, logo: event.target.value }))}
            />
            <TextField
              label="Address"
              fullWidth
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
            <TextField
              label="Phone"
              fullWidth
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <TextField
              label="Email recipients"
              helperText="Comma-separated email addresses"
              fullWidth
              value={form.emailRecipients}
              onChange={(event) => setForm((current) => ({ ...current, emailRecipients: event.target.value }))}
            />
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
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save retailer.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid || mutationState.isLoading}>
            {editingId ? "Save" : "Add Retailer"}
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
    </Box>
  );
}
