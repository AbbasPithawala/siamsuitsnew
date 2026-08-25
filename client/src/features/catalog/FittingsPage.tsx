import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
// Named barrel import — see LoginPage.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { useGetProductQuery } from "./productsApi";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import {
  useCreateFittingMutation,
  useDeleteFittingMutation,
  useListFittingsForProductQuery,
  useUpdateFittingMutation,
} from "./fittingsApi";
import type { Fitting, FittingInput } from "./fittingsApi";
import "../../styles/legacyAdmin/App.css";
import "../../styles/legacyAdmin/admin.css";

const EMPTY_FORM: FittingInput = { name: "", thaiName: "" };

function toBody(form: FittingInput): FittingInput {
  const body: FittingInput = { name: form.name.trim() };
  const thaiName = form.thaiName?.trim();
  if (thaiName) body.thaiName = thaiName;
  return body;
}

/**
 * Per-product fittings list — PHASE_8_TASKS.md Group 6.3, reachable from
 * `ProductsPage.tsx`'s per-row "Manage" action, matching legacy
 * `ManageMeasurementFits.jsx`'s per-product named-fit concept but scoped to
 * one product (rather than legacy's all-products-at-once table with an
 * eye-icon affordance) since this rewrite already has a per-product detail
 * entry point Group 1 established. Markup/CSS classes (`order-table
 * manage-page`, `top-heading-title`, `custom-btn`, `manage-btn`, `table`,
 * `backButton`) ported verbatim from the legacy admin screens per this
 * phase's established strategy.
 */
export function FittingsPage() {
  const { productId } = useParams<{ productId: string }>();
  const canManage = useHasPermission("catalog.fittings.manage");
  const { data: product } = useGetProductQuery(productId ?? "", { skip: !productId });
  const { data: fittings, isLoading, isError, error } = useListFittingsForProductQuery(productId ?? "", {
    skip: !productId,
  });
  const [createFitting, createState] = useCreateFittingMutation();
  const [updateFitting, updateState] = useUpdateFittingMutation();
  const [deleteFitting, deleteState] = useDeleteFittingMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FittingInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Fitting | null>(null);

  const mutationState = editingId ? updateState : createState;

  if (!productId) {
    return <Alert severity="error">Missing product.</Alert>;
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(fitting: Fitting) {
    setEditingId(fitting.id);
    setForm({ name: fitting.name, thaiName: fitting.thaiName ?? "" });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toBody(form);
    try {
      if (editingId) {
        await updateFitting({ id: editingId, productId: productId!, body }).unwrap();
      } else {
        await createFitting({ productId: productId!, body }).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteFitting({ id: deleteTarget.id, productId: productId! }).unwrap();
      setDeleteTarget(null);
    } catch {
      // dialog stays open; ConfirmDeleteDialog doesn't currently render
      // delete errors inline since soft-delete has no real validation to
      // fail on beyond 404/permission, both already handled elsewhere
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="content-wrapper">
      <div className="order-table manage-page">
        <div className="top-heading-title">
          <strong>{product ? `${product.name} — Fittings` : "Product Fittings"}</strong>
          <div className="add-btn">
            {canManage && (
              <button onClick={openCreateDialog} className="custom-btn" style={{ marginRight: "5px" }}>
                <AddIcon fontSize="small" style={{ verticalAlign: "middle", marginRight: 4 }} />
                Add New Fitting
              </button>
            )}
            <RouterLink to="/catalog/products" className="action backButton">
              <ArrowBackIcon />
            </RouterLink>
          </div>
        </div>

        {isError && (
          <Alert severity="error" sx={{ m: 2 }}>
            {getApiErrorMessage(error, "Failed to load fittings.")}
          </Alert>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>THAI NAME</th>
              <th>VALUES</th>
              {canManage && <th>ACTIONS</th>}
            </tr>
          </thead>
          <tbody>
            {fittings?.length === 0 && (
              <tr>
                <td colSpan={canManage ? 4 : 3}>No fittings defined for this product yet.</td>
              </tr>
            )}
            {fittings?.map((fitting) => (
              <tr key={fitting.id}>
                <td>
                  <strong>{fitting.name}</strong>
                </td>
                <td>{fitting.thaiName ?? "—"}</td>
                <td>
                  <strong>
                    {/* See ProductsPage.tsx's comment on this same pattern: `.manage-btn` only resets
                        `<button>` chrome, so an `<a>` needs its color/underline reset inline. */}
                    <RouterLink
                      to={`/catalog/products/${productId}/fittings/${fitting.id}`}
                      className="manage-btn"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Edit Values
                    </RouterLink>
                  </strong>
                </td>
                {canManage && (
                  <td>
                    <IconButton aria-label={`Edit ${fitting.name}`} onClick={() => openEditDialog(fitting)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${fitting.name}`} onClick={() => setDeleteTarget(fitting)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle className="dialog-title-head">{editingId ? "Edit Fitting" : "Add Fitting"}</DialogTitle>
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
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save fitting.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.name.trim() || mutationState.isLoading}>
            {editingId ? "Save" : "Add Fitting"}
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
    </div>
  );
}
