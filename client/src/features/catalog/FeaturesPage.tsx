import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
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
import { useHasPermission } from "../auth/useHasPermission";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { FeatureStylesEditor } from "./FeatureStylesEditor";
import {
  useCreateFeatureMutation,
  useDeleteFeatureMutation,
  useListFeaturesPaginatedQuery,
  useListProductFeaturesQuery,
  useSetFeatureProductsMutation,
  useUpdateFeatureMutation,
} from "./featuresApi";
import type { FeatureType, ProductFeature } from "./featuresApi";
import { useListProcessesQuery } from "./processesApi";
import { useListProductsQuery } from "./productsApi";

const FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: "choice", label: "Choice" },
  { value: "text", label: "Text" },
  { value: "structured", label: "Structured" },
];

interface FeatureFormState {
  name: string;
  thaiName: string;
  type: FeatureType;
  processId: string;
  productIds: string[];
  isAdditional: boolean;
}

const EMPTY_FORM: FeatureFormState = {
  name: "",
  thaiName: "",
  type: "choice",
  processId: "",
  productIds: [],
  isAdditional: false,
};

function toFeatureBody(form: FeatureFormState) {
  const body: { name: string; thaiName?: string; type: FeatureType; processId?: string; isAdditional: boolean } = {
    name: form.name.trim(),
    type: form.type,
    isAdditional: form.isAdditional,
  };
  const thaiName = form.thaiName.trim();
  if (thaiName) body.thaiName = thaiName;
  if (form.processId) body.processId = form.processId;
  return body;
}

/**
 * Features & Styles catalog admin — PHASE_5_TASKS.md Group 3. This is the
 * admin/write counterpart to `featureSelector/`'s read-only, customer-facing
 * `<FeatureSelector>` (Group 6): same `features`/`feature_products`/`styles`/
 * `style_options` data model, different consumption side. Same
 * page-level-open, button-level-gated pattern as the other Group 1/2 catalog
 * pages: `GET /features[/:id]` requires only `authenticate`
 * (`server/src/routes/features.routes.ts`), so reads are open to any
 * authenticated user; every write (`POST/PATCH/DELETE /features`, the
 * `/features/:id/products` link-set replace, and all style/style-option
 * endpoints) requires `catalog.features.manage`, gated here via
 * `useHasPermission` on the mutating buttons rather than the whole page.
 *
 * The products multi-select (not a single dropdown) is the literal point of
 * this screen: `feature_products` is many-to-many specifically so a feature
 * like Piping/Lining/Monogram can apply to a genuine subset of a tenant's
 * products, not all-or-nothing the way the legacy's one-`product_id`-per-
 * Feature model forced.
 *
 * The nested styles/style-options builder (`FeatureStylesEditor`) only
 * appears in the edit dialog for a persisted `type: "choice"` feature —
 * there's no bulk "create feature with styles" endpoint the way super
 * products accept inline components on create, so a brand-new choice
 * feature is created first (name/type/process/products), then reopened via
 * Edit to add its styles, mirroring `SuperProductsPage.tsx`'s edit-only
 * component-management path for the same reason.
 */
export function FeaturesPage() {
  const canManage = useHasPermission("catalog.features.manage");
  const [productFilter, setProductFilter] = useState("");
  const pagination = usePagination();
  const {
    data: allFeaturesResponse,
    isLoading: allLoading,
    isError: allError,
    error: allErrorObj,
  } = useListFeaturesPaginatedQuery(
    { page: pagination.page, pageSize: pagination.pageSize },
    { skip: productFilter !== "" }
  );
  const allFeatures = allFeaturesResponse?.data;
  const {
    data: filteredFeatures,
    isLoading: filteredLoading,
    isError: filteredError,
    error: filteredErrorObj,
  } = useListProductFeaturesQuery(productFilter, { skip: productFilter === "" });
  const features = productFilter ? filteredFeatures : allFeatures;
  const isLoading = productFilter ? filteredLoading : allLoading;
  const isError = productFilter ? filteredError : allError;
  const error = productFilter ? filteredErrorObj : allErrorObj;
  const { data: products } = useListProductsQuery();

  function handleProductFilterChange(value: string) {
    setProductFilter(value);
    pagination.onPageChange(1);
  }
  const { data: processes } = useListProcessesQuery();

  const [createFeature, createState] = useCreateFeatureMutation();
  const [updateFeature, updateState] = useUpdateFeatureMutation();
  const [deleteFeature, deleteState] = useDeleteFeatureMutation();
  const [setFeatureProducts, setProductsState] = useSetFeatureProductsMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeatureFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ProductFeature | null>(null);

  const mutationState = editingId ? updateState : createState;
  const combinedError = mutationState.error ?? (editingId ? setProductsState.error : undefined);
  const isSaving = mutationState.isLoading || (editingId ? setProductsState.isLoading : false);

  const editingFeature = editingId ? (features?.find((feature) => feature.id === editingId) ?? null) : null;

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(feature: ProductFeature) {
    setEditingId(feature.id);
    setForm({
      name: feature.name,
      thaiName: feature.thaiName ?? "",
      type: feature.type,
      processId: feature.processId ?? "",
      productIds: feature.products.map((product) => product.id),
      isAdditional: feature.isAdditional,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toFeatureBody(form);
    try {
      if (editingId) {
        await updateFeature({ id: editingId, body }).unwrap();
        await setFeatureProducts({ id: editingId, productIds: form.productIds }).unwrap();
      } else {
        const createBody = form.productIds.length > 0 ? { ...body, productIds: form.productIds } : body;
        await createFeature(createBody).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via combinedError
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteFeature(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // see ProductsPage.tsx's identical comment
    }
  }

  function handleProductsChange(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setForm((current) => ({ ...current, productIds: typeof value === "string" ? value.split(",") : value }));
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Features &amp; Styles</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Feature
          </Button>
        )}
      </Stack>

      <FormControl size="small" sx={{ mb: 2, minWidth: 240 }}>
        <InputLabel id="feature-product-filter-label">Filter by product</InputLabel>
        <Select
          labelId="feature-product-filter-label"
          label="Filter by product"
          value={productFilter}
          onChange={(event) => handleProductFilterChange(event.target.value)}
        >
          <MenuItem value="">
            <em>All Products</em>
          </MenuItem>
          {products?.map((product) => (
            <MenuItem key={product.id} value={product.id}>
              {product.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load features.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Thai name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Products</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {features?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4}>
                  <Typography color="text.secondary">No features yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {features?.map((feature) => (
              <TableRow key={feature.id}>
                <TableCell>{feature.name}</TableCell>
                <TableCell>{feature.thaiName ?? "—"}</TableCell>
                <TableCell>{feature.type}</TableCell>
                <TableCell>
                  {feature.products.length === 0
                    ? "0"
                    : `${feature.products.length} (${feature.products.map((p) => p.name).join(", ")})`}
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    <IconButton aria-label={`Edit ${feature.name}`} onClick={() => openEditDialog(feature)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${feature.name}`} onClick={() => setDeleteTarget(feature)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Pagination only applies to the unfiltered "All Products" branch — the
            product-filtered branch (Workstream A) stays fully unpaginated, always,
            per PHASE_10_TASKS.md Workstream C Group 4's scope boundary. */}
        {!productFilter && <PaginationControls total={allFeaturesResponse?.pagination.total ?? 0} {...pagination} />}
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Feature" : "Add Feature"}</DialogTitle>
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
            <FormControl fullWidth>
              <InputLabel id="feature-type-label">Type</InputLabel>
              <Select
                labelId="feature-type-label"
                label="Type"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FeatureType }))}
              >
                {FEATURE_TYPES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="feature-process-label">Process</InputLabel>
              <Select
                labelId="feature-process-label"
                label="Process"
                value={form.processId}
                onChange={(event) => setForm((current) => ({ ...current, processId: event.target.value }))}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {processes?.map((process) => (
                  <MenuItem key={process.id} value={process.id}>
                    {process.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isAdditional}
                  onChange={(event) => setForm((current) => ({ ...current, isAdditional: event.target.checked }))}
                />
              }
              label="Additional (shown in the PDF's secondary styling section, not the main icon grid)"
            />
            <FormControl fullWidth>
              <InputLabel id="feature-products-label">Products</InputLabel>
              <Select
                labelId="feature-products-label"
                label="Products"
                multiple
                value={form.productIds}
                onChange={handleProductsChange}
                renderValue={(selected) =>
                  products
                    ?.filter((product) => selected.includes(product.id))
                    .map((product) => product.name)
                    .join(", ") ?? ""
                }
              >
                {products?.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    <Checkbox checked={form.productIds.includes(product.id)} />
                    <ListItemText primary={product.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {combinedError && <Alert severity="error">{getApiErrorMessage(combinedError, "Failed to save feature.")}</Alert>}

            {editingFeature?.type === "choice" && (
              <>
                <Divider />
                <FeatureStylesEditor featureId={editingFeature.id} styles={editingFeature.styles ?? []} />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.name.trim() || isSaving}>
            {editingId ? "Save" : "Add Feature"}
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
