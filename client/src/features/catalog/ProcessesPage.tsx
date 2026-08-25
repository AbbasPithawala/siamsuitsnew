import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import {
  useCreateProcessMutation,
  useDeleteProcessMutation,
  useListProcessesPaginatedQuery,
  useUpdateProcessMutation,
} from "./processesApi";
import type { Process, ProcessInput } from "./processesApi";

const EMPTY_FORM: ProcessInput = { name: "", thaiName: "", price: "" };

function toBody(form: ProcessInput): ProcessInput {
  const body: ProcessInput = { name: form.name.trim() };
  const thaiName = form.thaiName?.trim();
  if (thaiName) body.thaiName = thaiName;
  const price = form.price?.trim();
  if (price) body.price = price;
  return body;
}

/**
 * Processes catalog admin — PHASE_5_TASKS.md Group 1. Same page-level-open,
 * button-level-gated pattern as `ProductsPage.tsx` (see its doc comment):
 * `server/src/routes/processes.routes.ts` only gates writes on
 * `catalog.processes.manage`, reads are open to any authenticated user.
 */
export function ProcessesPage() {
  const canManage = useHasPermission("catalog.processes.manage");
  const pagination = usePagination();
  const { data: processesResponse, isLoading, isError, error } = useListProcessesPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const processes = processesResponse?.data;
  const [createProcess, createState] = useCreateProcessMutation();
  const [updateProcess, updateState] = useUpdateProcessMutation();
  const [deleteProcess, deleteState] = useDeleteProcessMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Process | null>(null);

  const mutationState = editingId ? updateState : createState;

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(process: Process) {
    setEditingId(process.id);
    setForm({
      name: process.name,
      thaiName: process.thaiName ?? "",
      price: process.price ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toBody(form);
    try {
      if (editingId) {
        await updateProcess({ id: editingId, body }).unwrap();
      } else {
        await createProcess(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteProcess(deleteTarget.id).unwrap();
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
        <Typography variant="h5">Processes</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Process
          </Button>
        )}
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load processes.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Thai name</TableCell>
              <TableCell>Price</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {processes?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3}>
                  <Typography color="text.secondary">No processes yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {processes?.map((process) => (
              <TableRow key={process.id}>
                <TableCell>{process.name}</TableCell>
                <TableCell>{process.thaiName ?? "—"}</TableCell>
                <TableCell>{process.price}</TableCell>
                {canManage && (
                  <TableCell align="right">
                    <IconButton aria-label={`Edit ${process.name}`} onClick={() => openEditDialog(process)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${process.name}`} onClick={() => setDeleteTarget(process)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={processesResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Process" : "Add Process"}</DialogTitle>
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
              label="Thai name"
              fullWidth
              value={form.thaiName ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, thaiName: event.target.value }))}
            />
            <TextField
              label="Price"
              fullWidth
              inputProps={{ inputMode: "decimal" }}
              value={form.price ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            />
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save process.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.name.trim() || mutationState.isLoading}
          >
            {editingId ? "Save" : "Add Process"}
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
