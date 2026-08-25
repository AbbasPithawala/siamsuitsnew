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
  useCreateMeasurementDefinitionMutation,
  useDeleteMeasurementDefinitionMutation,
  useListMeasurementDefinitionsPaginatedQuery,
  useUpdateMeasurementDefinitionMutation,
} from "./measurementDefinitionsApi";
import type { MeasurementDefinition, MeasurementDefinitionInput } from "./measurementDefinitionsApi";

const EMPTY_FORM: MeasurementDefinitionInput = { name: "", thaiName: "", slug: "" };

function toBody(form: MeasurementDefinitionInput): MeasurementDefinitionInput {
  const body: MeasurementDefinitionInput = { name: form.name.trim(), slug: form.slug.trim() };
  const thaiName = form.thaiName?.trim();
  if (thaiName) body.thaiName = thaiName;
  return body;
}

/**
 * Measurement-definitions catalog admin — PHASE_5_TASKS.md Group 1. Same
 * page-level-open, button-level-gated pattern as `ProductsPage.tsx`: reads
 * are open to any authenticated user, writes require
 * `catalog.measurements.manage` (`server/src/routes/measurements.routes.ts`).
 *
 * This is the admin CRUD for the `measurement_definitions` catalog resource
 * itself — distinct from Group 5's generic `<MeasurementForm>`
 * (`../measurements/MeasurementForm.tsx`), which fills in *values* against a
 * product's already-linked definitions.
 */
export function MeasurementDefinitionsPage() {
  const canManage = useHasPermission("catalog.measurements.manage");
  const pagination = usePagination();
  const { data: definitionsResponse, isLoading, isError, error } = useListMeasurementDefinitionsPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const definitions = definitionsResponse?.data;
  const [createDefinition, createState] = useCreateMeasurementDefinitionMutation();
  const [updateDefinition, updateState] = useUpdateMeasurementDefinitionMutation();
  const [deleteDefinition, deleteState] = useDeleteMeasurementDefinitionMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MeasurementDefinitionInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<MeasurementDefinition | null>(null);

  const mutationState = editingId ? updateState : createState;

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(definition: MeasurementDefinition) {
    setEditingId(definition.id);
    setForm({
      name: definition.name,
      thaiName: definition.thaiName ?? "",
      slug: definition.slug,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toBody(form);
    try {
      if (editingId) {
        await updateDefinition({ id: editingId, body }).unwrap();
      } else {
        await createDefinition(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteDefinition(deleteTarget.id).unwrap();
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
        <Typography variant="h5">Measurement Definitions</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Measurement Definition
          </Button>
        )}
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load measurement definitions.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Thai name</TableCell>
              <TableCell>Slug</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {definitions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3}>
                  <Typography color="text.secondary">No measurement definitions yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {definitions?.map((definition) => (
              <TableRow key={definition.id}>
                <TableCell>{definition.name}</TableCell>
                <TableCell>{definition.thaiName ?? "—"}</TableCell>
                <TableCell>{definition.slug}</TableCell>
                {canManage && (
                  <TableCell align="right">
                    <IconButton aria-label={`Edit ${definition.name}`} onClick={() => openEditDialog(definition)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${definition.name}`} onClick={() => setDeleteTarget(definition)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={definitionsResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Measurement Definition" : "Add Measurement Definition"}</DialogTitle>
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
              label="Slug"
              required
              fullWidth
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            />
            {mutationState.error && (
              <Alert severity="error">
                {getApiErrorMessage(mutationState.error, "Failed to save measurement definition.")}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.slug.trim() || mutationState.isLoading}
          >
            {editingId ? "Save" : "Add Measurement Definition"}
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
