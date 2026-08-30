import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see LoginPage.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { useListMeasurementDefinitionsQuery } from "./measurementDefinitionsApi";
import { useProductMeasurementsQuery, useSetProductMeasurementsMutation } from "../measurements/measurementsApi";
import { useListFeaturesQuery, useListProductFeaturesQuery, useSetProductFeaturesMutation } from "./featuresApi";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ManageLinkedItemsDialog } from "./ManageLinkedItemsDialog";
import {
  useCreateProductMutation,
  useDeleteProductMutation,
  useListProductsPaginatedQuery,
  useUpdateProductMutation,
} from "./productsApi";
import type { Product, ProductInput } from "./productsApi";
import { resolveUploadUrl } from "../uploads/uploadsApi";
import "../../styles/legacyAdmin/App.css";
import "../../styles/legacyAdmin/admin.css";

const EMPTY_FORM: ProductInput = { name: "", thaiName: "", description: "", image: "", measurementDiagramImage: "" };

/** `.custom-btn` (App.css) is sized for page-level actions (12px 24px padding) — too large
 * inside a table row. Same background/color/radius, scaled down for an inline cell action. */
const TABLE_MANAGE_BTN_STYLE = { padding: "4px 14px", fontSize: "0.8125rem" };
const DESCRIPTION_SNIPPET_LENGTH = 60;

function descriptionSnippet(description: string | null): string {
  if (!description) return "—";
  return description.length > DESCRIPTION_SNIPPET_LENGTH
    ? `${description.slice(0, DESCRIPTION_SNIPPET_LENGTH)}…`
    : description;
}

function toBody(form: ProductInput): ProductInput {
  const body: ProductInput = { name: form.name.trim() };
  const thaiName = form.thaiName?.trim();
  if (thaiName) body.thaiName = thaiName;
  const description = form.description?.trim();
  if (description) body.description = description;
  const image = form.image?.trim();
  if (image) body.image = image;
  const measurementDiagramImage = form.measurementDiagramImage?.trim();
  if (measurementDiagramImage) body.measurementDiagramImage = measurementDiagramImage;
  return body;
}

/**
 * The "Manage Measurements" dialog for one product — data-fetching wrapper around
 * `ManageLinkedItemsDialog`. Deliberately does not render the inner dialog until both
 * queries have resolved: `ManageLinkedItemsDialog`'s `orderedIds` state is seeded once,
 * on mount, from the `linkedIds` prop (see its own doc comment on why — no effect-based
 * resync). Rendering it early with `linked` still `undefined` (RTK Query's loading state)
 * would permanently lock in an empty list for any product that actually has real linked
 * measurements — caught via an actual live-browser check, not by the unit/integration
 * tests, which only ever exercised a brand-new product with nothing linked yet.
 */
function ProductMeasurementsDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: allDefinitions } = useListMeasurementDefinitionsQuery();
  const { data: linked } = useProductMeasurementsQuery(product.id);
  const [setProductMeasurements, { isLoading }] = useSetProductMeasurementsMutation();

  if (!allDefinitions || !linked) {
    return (
      <Dialog open onClose={onClose}>
        <DialogContent>
          <LoadingSpinner />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ManageLinkedItemsDialog
      open
      onClose={onClose}
      title={product.name}
      columnLabel="Measurement Name"
      allItems={allDefinitions.map((definition) => ({
        id: definition.id,
        label: definition.thaiName ? `${definition.name} | ${definition.thaiName}` : definition.name,
      }))}
      linkedIds={linked.map((link) => link.measurementDefinitionId)}
      isSaving={isLoading}
      onSave={async (orderedIds) => {
        await setProductMeasurements({ productId: product.id, measurementDefinitionIds: orderedIds }).unwrap();
      }}
    />
  );
}

/** The "Manage Styling" dialog for one product — same shape and same loading-gate reasoning as `ProductMeasurementsDialog`, against the unified `features` model. */
function ProductFeaturesDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: allFeatures } = useListFeaturesQuery();
  const { data: linked } = useListProductFeaturesQuery(product.id);
  const [setProductFeatures, { isLoading }] = useSetProductFeaturesMutation();

  if (!allFeatures || !linked) {
    return (
      <Dialog open onClose={onClose}>
        <DialogContent>
          <LoadingSpinner />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ManageLinkedItemsDialog
      open
      onClose={onClose}
      title={product.name}
      columnLabel="Style Option"
      allItems={allFeatures.map((feature) => ({
        id: feature.id,
        label: feature.thaiName ? `${feature.name} | ${feature.thaiName}` : feature.name,
      }))}
      linkedIds={linked.map((feature) => feature.id)}
      isSaving={isLoading}
      onSave={async (orderedIds) => {
        await setProductFeatures({ productId: product.id, featureIds: orderedIds }).unwrap();
      }}
    />
  );
}

/**
 * Products catalog admin — PHASE_5_TASKS.md Group 1, rebuilt in PHASE_8_TASKS.md Group 1
 * to close a real, user-reported gap: this page had no way at all to manage which
 * measurements/features apply to a product (let alone the order they're entered in on a
 * real order), and its table/buttons used generic MUI defaults instead of the legacy
 * admin's actual look. The list markup and CSS classes below (`content-wrapper`,
 * `order-table manage-page`, `top-heading-title`, `custom-btn`, `manage-btn`, `table`) are
 * ported verbatim from `siamClient/src/components/superAdmin/pages/admin/ManageProduct.jsx`
 * and its `admin.css`/`App.css` (copied byte-for-byte into `styles/legacyAdmin/` — diff
 * against the legacy source to confirm) — not re-derived/approximated in MUI, so the visual
 * result is verifiable by eye against the real legacy screen. Legacy's own `main-panel`/
 * `Main-page-body-wrapper-complussry` outer chrome is deliberately NOT used here — this
 * project's `AppShell` (Phase 4) already provides that (same 235px sidebar width), and
 * nesting legacy's own `width: calc(100% - 235px)` rule inside it would double-offset the
 * content. The Add/Edit Product dialog (name/Thai name/description/image) keeps the
 * existing MUI dialog from before this rewrite — that wasn't the reported gap and legacy's
 * own version lives on a separate page (`/admin/addProduct`), not inline in this file.
 */
export function ProductsPage() {
  const canManage = useHasPermission("catalog.products.manage");
  const pagination = usePagination();
  const { data: productsResponse, isLoading, isError, error } = useListProductsPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const products = productsResponse?.data;
  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [deleteProduct, deleteState] = useDeleteProductMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [measurementsTarget, setMeasurementsTarget] = useState<Product | null>(null);
  const [stylingTarget, setStylingTarget] = useState<Product | null>(null);

  const mutationState = editingId ? updateState : createState;

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      thaiName: product.thaiName ?? "",
      description: product.description ?? "",
      image: product.image ?? "",
      measurementDiagramImage: product.measurementDiagramImage ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toBody(form);
    try {
      if (editingId) {
        await updateProduct({ id: editingId, body }).unwrap();
      } else {
        await createProduct(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id).unwrap();
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
    <Box sx={{ p: 4 }}>
      {/* Matches `ProcessesPage.tsx`'s outer layout: heading + actions sit above the
          table in their own row (not merged into one continuous legacy-CSS box) — a
          real, reported visual bug where `top-heading-title`/`order-table manage-page`
          made the heading bar and table read as one seamless block with no separation,
          unlike every other catalog admin page. The table itself keeps its legacy
          `.table` markup/styling (`admin.css`/`App.css`, byte-for-byte from
          `ManageProduct.jsx`) — only the outer wrapper changed, not the row/cell look. */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Manage Product</Typography>
        <Stack direction="row" spacing={1}>
          {canManage && (
            <button onClick={openCreateDialog} className="custom-btn">
              <AddIcon fontSize="small" style={{ verticalAlign: "middle", marginRight: 4 }} />
              Add New Product
            </button>
          )}
          <RouterLink to="/catalog/processes" className="custom-btn" style={{ display: "inline-block" }}>
            Manage Processes
          </RouterLink>
        </Stack>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load products.")}
        </Alert>
      )}

      <Paper variant="outlined">
        <table className="table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>DESCRIPTION</th>
              <th>IMAGE</th>
              <th>MEASUREMENTS</th>
              <th>STYLING</th>
              <th>FITTINGS</th>
              {canManage && <th>ACTIONS</th>}
            </tr>
          </thead>
          <tbody>
            {products?.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6}>No products yet.</td>
              </tr>
            )}
            {products?.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                </td>
                <td>{descriptionSnippet(product.description)}</td>
                <td>
                  {product.image ? (
                    <img
                      src={resolveUploadUrl(product.image)}
                      alt={product.name}
                      style={{ width: "50px", height: "50px", borderRadius: "50%", margin: "4px", objectFit: "cover" }}
                    />
                  ) : (
                    "No Image"
                  )}
                </td>
                <td>
                  <button className="custom-btn" style={TABLE_MANAGE_BTN_STYLE} onClick={() => setMeasurementsTarget(product)}>
                    Manage
                  </button>
                </td>
                <td>
                  <button className="custom-btn" style={TABLE_MANAGE_BTN_STYLE} onClick={() => setStylingTarget(product)}>
                    Manage
                  </button>
                </td>
                <td>
                  {/* `.custom-btn` (App.css) only resets `<button>` chrome, not an anchor's
                      default blue/underline — this cell is a real navigation so it has to be
                      an `<a>`; `textDecoration: "none"` covers what the class doesn't. */}
                  <RouterLink
                    to={`/catalog/products/${product.id}/fittings`}
                    className="custom-btn"
                    style={{ ...TABLE_MANAGE_BTN_STYLE, textDecoration: "none", display: "inline-block" }}
                  >
                    Manage
                  </RouterLink>
                </td>
                {canManage && (
                  <td>
                    <IconButton aria-label={`Edit ${product.name}`} onClick={() => openEditDialog(product)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${product.name}`} onClick={() => setDeleteTarget(product)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls total={productsResponse?.pagination.total ?? 0} {...pagination} />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle className="dialog-title-head">{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
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
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={form.description ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
            <TextField
              label="Image URL"
              fullWidth
              value={form.image ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))}
            />
            <TextField
              label="Measurement Diagram Image URL"
              helperText="Rendered as the annotation background in the Manual Size editor (Order edit surface)."
              fullWidth
              value={form.measurementDiagramImage ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, measurementDiagramImage: event.target.value }))}
            />
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save product.")}</Alert>
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
            {editingId ? "Save" : "Add Product"}
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

      {measurementsTarget && (
        <ProductMeasurementsDialog
          key={measurementsTarget.id}
          product={measurementsTarget}
          onClose={() => setMeasurementsTarget(null)}
        />
      )}
      {stylingTarget && (
        <ProductFeaturesDialog key={stylingTarget.id} product={stylingTarget} onClose={() => setStylingTarget(null)} />
      )}
    </Box>
  );
}
