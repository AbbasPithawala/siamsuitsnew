import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import { useListFeaturesQuery } from "../catalog/featuresApi";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useListProductsQuery } from "../catalog/productsApi";
import { useHasPermission } from "../auth/useHasPermission";
import {
  useCreateExtraPaymentCategoryMutation,
  useDeleteExtraPaymentCategoryMutation,
  useListExtraPaymentCategoriesPaginatedQuery,
  useUpdateExtraPaymentCategoryMutation,
} from "./extraPaymentCategoriesApi";
import type { ExtraPaymentCategory } from "./extraPaymentCategoriesApi";

interface CategoryFormState {
  productId: string;
  processId: string;
  featureId: string;
  styleId: string;
  name: string;
  thaiName: string;
  cost: string;
}

const EMPTY_FORM: CategoryFormState = { productId: "", processId: "", featureId: "", styleId: "", name: "", thaiName: "", cost: "" };

function toCategoryBody(form: CategoryFormState) {
  const body: {
    productId: string;
    processId: string;
    featureId?: string;
    styleId?: string;
    name: string;
    thaiName?: string;
    cost?: string;
  } = {
    productId: form.productId,
    processId: form.processId,
    name: form.name.trim(),
  };
  if (form.featureId) body.featureId = form.featureId;
  if (form.styleId) body.styleId = form.styleId;
  const thaiName = form.thaiName.trim();
  if (thaiName) body.thaiName = thaiName;
  const cost = form.cost.trim();
  if (cost) body.cost = cost;
  return body;
}

/**
 * Extra Payment Categories admin — PHASE_6_TASKS.md Group 7, the UI for
 * Group 0's `extraPaymentCategories.routes.ts` CRUD (a real blocking gap
 * found while scoping Phase 6: the extra-payments feature Phase 3 Group 5
 * built had a `categoryId` foreign key with nothing on the write side to
 * create a category to reference). Same page-open/button-gated convention
 * as the Group 1-3 catalog screens (`GET /extra-payment-categories` takes
 * only `authenticate`; every write requires `factory.extra_payments.manage`,
 * the same key Phase 3 Group 5 used for creating an actual extra payment —
 * see that route file's doc comment).
 *
 * The optional feature/style pair narrows a category down to "this exact
 * style choice on this product during this process" (e.g. a stitching
 * bonus that only applies when a specific lapel style was picked) — see
 * `extra-payments.service.ts`'s `createExtraPayment` for how that pair is
 * enforced server-side against what was actually selected on the order.
 */
export function ExtraPaymentCategoriesPage() {
  const canManage = useHasPermission("factory.extra_payments.manage");
  const pagination = usePagination();
  const {
    data: categoriesResponse,
    isLoading,
    isError,
    error,
  } = useListExtraPaymentCategoriesPaginatedQuery({ page: pagination.page, pageSize: pagination.pageSize });
  const categories = categoriesResponse?.data;
  const { data: products } = useListProductsQuery();
  const { data: processes } = useListProcessesQuery();
  const { data: features } = useListFeaturesQuery();

  const [createCategory, createState] = useCreateExtraPaymentCategoryMutation();
  const [updateCategory, updateState] = useUpdateExtraPaymentCategoryMutation();
  const [deleteCategory, deleteState] = useDeleteExtraPaymentCategoryMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ExtraPaymentCategory | null>(null);

  const mutationState = editingId ? updateState : createState;

  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const processNameById = new Map((processes ?? []).map((process) => [process.id, process.name]));
  const featureById = new Map((features ?? []).map((feature) => [feature.id, feature]));

  const selectedFeature = form.featureId ? featureById.get(form.featureId) : undefined;
  const availableStyles = selectedFeature?.type === "choice" ? (selectedFeature.styles ?? []) : [];

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(category: ExtraPaymentCategory) {
    setEditingId(category.id);
    setForm({
      productId: category.productId,
      processId: category.processId,
      featureId: category.featureId ?? "",
      styleId: category.styleId ?? "",
      name: category.name,
      thaiName: category.thaiName ?? "",
      cost: category.cost,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toCategoryBody(form);
    try {
      if (editingId) {
        await updateCategory({ id: editingId, body }).unwrap();
      } else {
        await createCategory(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // see ProductsPage.tsx's identical comment
    }
  }

  function handleFeatureChange(featureId: string) {
    setForm((current) => ({ ...current, featureId, styleId: "" }));
  }

  const isFormValid = form.productId.length > 0 && form.processId.length > 0 && form.name.trim().length > 0;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Extra Payment Categories</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Category
          </Button>
        )}
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load extra payment categories.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Process</TableCell>
              <TableCell>Feature / Style</TableCell>
              <TableCell align="right">Cost</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5}>
                  <Typography color="text.secondary">No extra payment categories yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {categories?.map((category) => {
              const feature = category.featureId ? featureById.get(category.featureId) : undefined;
              const style = feature?.styles?.find((s) => s.id === category.styleId);
              return (
                <TableRow key={category.id}>
                  <TableCell>
                    {category.name}
                    {category.thaiName ? ` / ${category.thaiName}` : ""}
                  </TableCell>
                  <TableCell>{productNameById.get(category.productId) ?? category.productId}</TableCell>
                  <TableCell>{processNameById.get(category.processId) ?? category.processId}</TableCell>
                  <TableCell>{feature ? `${feature.name}${style ? ` / ${style.name}` : ""}` : "—"}</TableCell>
                  <TableCell align="right">{category.cost}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <IconButton aria-label={`Edit ${category.name}`} onClick={() => openEditDialog(category)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label={`Delete ${category.name}`} onClick={() => setDeleteTarget(category)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <PaginationControls total={categoriesResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Extra Payment Category" : "Add Extra Payment Category"}</DialogTitle>
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
              value={form.thaiName}
              onChange={(event) => setForm((current) => ({ ...current, thaiName: event.target.value }))}
            />
            <FormControl fullWidth required>
              <InputLabel id="epc-product-label">Product</InputLabel>
              <Select
                labelId="epc-product-label"
                label="Product"
                value={form.productId}
                onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}
              >
                {products?.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel id="epc-process-label">Process</InputLabel>
              <Select
                labelId="epc-process-label"
                label="Process"
                value={form.processId}
                onChange={(event) => setForm((current) => ({ ...current, processId: event.target.value }))}
              >
                {processes?.map((process) => (
                  <MenuItem key={process.id} value={process.id}>
                    {process.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="epc-feature-label">Feature (optional)</InputLabel>
              <Select
                labelId="epc-feature-label"
                label="Feature (optional)"
                value={form.featureId}
                onChange={(event) => handleFeatureChange(event.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {features?.map((feature) => (
                  <MenuItem key={feature.id} value={feature.id}>
                    {feature.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {availableStyles.length > 0 && (
              <FormControl fullWidth>
                <InputLabel id="epc-style-label">Style (optional)</InputLabel>
                <Select
                  labelId="epc-style-label"
                  label="Style (optional)"
                  value={form.styleId}
                  onChange={(event) => setForm((current) => ({ ...current, styleId: event.target.value }))}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {availableStyles.map((style) => (
                    <MenuItem key={style.id} value={style.id}>
                      {style.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label="Cost"
              fullWidth
              value={form.cost}
              onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
              helperText="THB, e.g. 50.00"
            />

            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save extra payment category.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid || mutationState.isLoading}>
            {editingId ? "Save" : "Add Category"}
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
