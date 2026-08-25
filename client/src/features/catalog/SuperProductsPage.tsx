import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
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
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import {
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { useListProductsQuery } from "./productsApi";
import {
  useAddSuperProductComponentMutation,
  useCreateSuperProductMutation,
  useDeleteSuperProductMutation,
  useListSuperProductsPaginatedQuery,
  useRemoveSuperProductComponentMutation,
  useUpdateSuperProductComponentMutation,
  useUpdateSuperProductMutation,
} from "./superProductsApi";
import type { ComponentInput, SuperProduct, SuperProductInput } from "./superProductsApi";

const MAX_COMPONENTS = 3;
const EMPTY_FORM: SuperProductInput = { name: "", thaiName: "", image: "" };
const EMPTY_COMPONENT_DRAFT: ComponentInput = { productId: "", slotLabel: "" };

function toBody(form: SuperProductInput): SuperProductInput {
  const body: SuperProductInput = { name: form.name.trim() };
  const thaiName = form.thaiName?.trim();
  if (thaiName) body.thaiName = thaiName;
  const image = form.image?.trim();
  if (image) body.image = image;
  return body;
}

function isCompleteDraft(draft: ComponentInput): boolean {
  return draft.productId.trim().length > 0 && draft.slotLabel.trim().length > 0;
}

/**
 * Super products catalog admin — PHASE_5_TASKS.md Group 2. Same
 * page-level-open, button-level-gated pattern as the Group 1 catalog pages
 * (`ProductsPage.tsx` etc.): `GET /super-products[/:id]` requires only
 * `authenticate` (`server/src/routes/superProducts.routes.ts`), so reads are
 * open to any authenticated user; only the write endpoints require
 * `catalog.super_products.manage`, gating the mutating buttons via
 * `useHasPermission` rather than the whole page.
 *
 * The component builder has two distinct code paths, not because of UI
 * taste but because the backend itself has no bulk "reconcile components"
 * endpoint: `PATCH /super-products/:id` only ever touches
 * name/thaiName/image (`updateSuperProduct` in
 * `server/src/services/superProducts.service.ts`). So:
 *  - Creating: components are plain local draft rows, sent as one array in
 *    the `POST /super-products` body (`createSuperProductSchema` accepts up
 *    to 3 inline).
 *  - Editing: components already persisted server-side, and adding/editing/
 *    removing one is always its own request against
 *    `/super-products/:id/components[/:componentId]` — there is nothing to
 *    "save" for components on an existing super product, each action is
 *    already committed when it happens.
 */
export function SuperProductsPage() {
  const canManage = useHasPermission("catalog.super_products.manage");
  const pagination = usePagination();
  const { data: superProductsResponse, isLoading, isError, error } = useListSuperProductsPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const superProducts = superProductsResponse?.data;
  const { data: products } = useListProductsQuery();

  const [createSuperProduct, createState] = useCreateSuperProductMutation();
  const [updateSuperProduct, updateState] = useUpdateSuperProductMutation();
  const [deleteSuperProduct, deleteState] = useDeleteSuperProductMutation();
  const [addComponent, addComponentState] = useAddSuperProductComponentMutation();
  const [updateComponent] = useUpdateSuperProductComponentMutation();
  const [removeComponent] = useRemoveSuperProductComponentMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SuperProductInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<SuperProduct | null>(null);

  // Create-mode-only local drafts (see doc comment above).
  const [draftComponents, setDraftComponents] = useState<ComponentInput[]>([]);

  // Edit-mode-only: the "add a component" inline row, and which existing
  // component (if any) is being edited in place.
  const [addingComponent, setAddingComponent] = useState(false);
  const [newComponentDraft, setNewComponentDraft] = useState<ComponentInput>(EMPTY_COMPONENT_DRAFT);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editComponentDraft, setEditComponentDraft] = useState<ComponentInput>(EMPTY_COMPONENT_DRAFT);
  const [componentActionError, setComponentActionError] = useState<string | null>(null);

  const mutationState = editingId ? updateState : createState;
  const editingSuperProduct = editingId ? (superProducts?.find((sp) => sp.id === editingId) ?? null) : null;
  const existingComponents = editingSuperProduct?.components ?? [];
  const componentCount = editingId ? existingComponents.length : draftComponents.length;

  function resetComponentEditingState() {
    setAddingComponent(false);
    setNewComponentDraft(EMPTY_COMPONENT_DRAFT);
    setEditingComponentId(null);
    setEditComponentDraft(EMPTY_COMPONENT_DRAFT);
    setComponentActionError(null);
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDraftComponents([]);
    resetComponentEditingState();
    setDialogOpen(true);
  }

  function openEditDialog(superProduct: SuperProduct) {
    setEditingId(superProduct.id);
    setForm({
      name: superProduct.name,
      thaiName: superProduct.thaiName ?? "",
      image: superProduct.image ?? "",
    });
    setDraftComponents([]);
    resetComponentEditingState();
    setDialogOpen(true);
  }

  function addDraftRow() {
    if (draftComponents.length >= MAX_COMPONENTS) return;
    setDraftComponents((current) => [...current, { ...EMPTY_COMPONENT_DRAFT }]);
  }

  function updateDraftRow(index: number, patch: Partial<ComponentInput>) {
    setDraftComponents((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeDraftRow(index: number) {
    setDraftComponents((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const body = toBody(form);
    try {
      if (editingId) {
        await updateSuperProduct({ id: editingId, body }).unwrap();
      } else {
        const components = draftComponents.filter(isCompleteDraft);
        if (components.length > 0) body.components = components;
        await createSuperProduct(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleAddExistingComponent() {
    if (!editingId || !isCompleteDraft(newComponentDraft)) return;
    setComponentActionError(null);
    try {
      await addComponent({ superProductId: editingId, body: newComponentDraft }).unwrap();
      setAddingComponent(false);
      setNewComponentDraft(EMPTY_COMPONENT_DRAFT);
    } catch (err) {
      // Defense in depth: the "Add component" control is already disabled
      // at 3 client-side, but a concurrent edit elsewhere (or a stale view)
      // could still let this request through — surface the real
      // TOO_MANY_COMPONENTS 422 as a clear message rather than a raw failure.
      setComponentActionError(getApiErrorMessage(err, "Failed to add component."));
    }
  }

  function startComponentEdit(component: SuperProduct["components"][number]) {
    setEditingComponentId(component.id);
    setEditComponentDraft({ productId: component.productId, slotLabel: component.slotLabel });
    setComponentActionError(null);
  }

  async function handleSaveComponentEdit() {
    if (!editingId || !editingComponentId || !isCompleteDraft(editComponentDraft)) return;
    setComponentActionError(null);
    try {
      await updateComponent({
        superProductId: editingId,
        componentId: editingComponentId,
        body: editComponentDraft,
      }).unwrap();
      setEditingComponentId(null);
      setEditComponentDraft(EMPTY_COMPONENT_DRAFT);
    } catch (err) {
      setComponentActionError(getApiErrorMessage(err, "Failed to update component."));
    }
  }

  async function handleRemoveExistingComponent(componentId: string) {
    if (!editingId) return;
    setComponentActionError(null);
    try {
      await removeComponent({ superProductId: editingId, componentId }).unwrap();
    } catch (err) {
      setComponentActionError(getApiErrorMessage(err, "Failed to remove component."));
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteSuperProduct(deleteTarget.id).unwrap();
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
        <Typography variant="h5">Super Products</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Super Product
          </Button>
        )}
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load super products.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Thai name</TableCell>
              <TableCell>Components</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {superProducts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3}>
                  <Typography color="text.secondary">No super products yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {superProducts?.map((superProduct) => (
              <TableRow key={superProduct.id}>
                <TableCell>{superProduct.name}</TableCell>
                <TableCell>{superProduct.thaiName ?? "—"}</TableCell>
                <TableCell>
                  {superProduct.components.length === 0
                    ? "0"
                    : `${superProduct.components.length} (${superProduct.components
                        .map((c) => c.slotLabel)
                        .join(", ")})`}
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    <IconButton aria-label={`Edit ${superProduct.name}`} onClick={() => openEditDialog(superProduct)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete ${superProduct.name}`}
                      onClick={() => setDeleteTarget(superProduct)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={superProductsResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Super Product" : "Add Super Product"}</DialogTitle>
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
              label="Image URL"
              fullWidth
              value={form.image ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))}
            />
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save super product.")}</Alert>
            )}

            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Components ({componentCount}/{MAX_COMPONENTS})</Typography>
            </Stack>

            {editingId === null ? (
              <>
                {draftComponents.map((row, index) => (
                  <Stack direction="row" spacing={1} alignItems="center" key={index}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`component-product-label-${index}`}>Product</InputLabel>
                      <Select
                        labelId={`component-product-label-${index}`}
                        label="Product"
                        value={row.productId}
                        onChange={(event) => updateDraftRow(index, { productId: event.target.value })}
                      >
                        {products?.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Slot label"
                      size="small"
                      fullWidth
                      value={row.slotLabel}
                      onChange={(event) => updateDraftRow(index, { slotLabel: event.target.value })}
                    />
                    <IconButton aria-label={`Remove component ${index + 1}`} onClick={() => removeDraftRow(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addDraftRow}
                  disabled={draftComponents.length >= MAX_COMPONENTS}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add component
                </Button>
              </>
            ) : (
              <>
                {existingComponents.map((component) =>
                  editingComponentId === component.id ? (
                    <Stack direction="row" spacing={1} alignItems="center" key={component.id}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`edit-component-product-label-${component.id}`}>Product</InputLabel>
                        <Select
                          labelId={`edit-component-product-label-${component.id}`}
                          label="Product"
                          value={editComponentDraft.productId}
                          onChange={(event) =>
                            setEditComponentDraft((current) => ({ ...current, productId: event.target.value }))
                          }
                        >
                          {products?.map((product) => (
                            <MenuItem key={product.id} value={product.id}>
                              {product.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="Slot label"
                        size="small"
                        fullWidth
                        value={editComponentDraft.slotLabel}
                        onChange={(event) =>
                          setEditComponentDraft((current) => ({ ...current, slotLabel: event.target.value }))
                        }
                      />
                      <IconButton
                        aria-label={`Save component ${component.slotLabel}`}
                        onClick={handleSaveComponentEdit}
                        disabled={!isCompleteDraft(editComponentDraft)}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Cancel component edit" onClick={resetComponentEditingState}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" key={component.id}>
                      <Typography variant="body2">
                        {component.slotLabel}: {component.product.name}
                      </Typography>
                      <Box>
                        <IconButton
                          aria-label={`Edit component ${component.slotLabel}`}
                          onClick={() => startComponentEdit(component)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label={`Remove component ${component.slotLabel}`}
                          onClick={() => handleRemoveExistingComponent(component.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                  )
                )}

                {addingComponent ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl fullWidth size="small">
                      <InputLabel id="new-component-product-label">Product</InputLabel>
                      <Select
                        labelId="new-component-product-label"
                        label="Product"
                        value={newComponentDraft.productId}
                        onChange={(event) =>
                          setNewComponentDraft((current) => ({ ...current, productId: event.target.value }))
                        }
                      >
                        {products?.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Slot label"
                      size="small"
                      fullWidth
                      value={newComponentDraft.slotLabel}
                      onChange={(event) =>
                        setNewComponentDraft((current) => ({ ...current, slotLabel: event.target.value }))
                      }
                    />
                    <IconButton
                      aria-label="Save new component"
                      onClick={handleAddExistingComponent}
                      disabled={!isCompleteDraft(newComponentDraft) || addComponentState.isLoading}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label="Cancel new component" onClick={resetComponentEditingState}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : (
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setAddingComponent(true)}
                    disabled={existingComponents.length >= MAX_COMPONENTS}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Add component
                  </Button>
                )}

                {componentActionError && <Alert severity="error">{componentActionError}</Alert>}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={
              !form.name.trim() ||
              mutationState.isLoading ||
              (editingId === null && draftComponents.some((row) => !isCompleteDraft(row)))
            }
          >
            {editingId ? "Save" : "Add Super Product"}
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
