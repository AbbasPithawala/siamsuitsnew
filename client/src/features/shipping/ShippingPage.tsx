import { useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon, Inventory as InventoryIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useListProductsQuery } from "../catalog/productsApi";
import { getManufacturingErrorMessage } from "../manufacturing/manufacturingErrors";
import { useGetComponentDetailQuery } from "../manufacturing/manufacturingApi";
import type { ManufacturingStepStatus } from "../manufacturing/manufacturingApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { resolveUploadUrl } from "../uploads/uploadsApi";
import { getShippingErrorMessage } from "./shippingErrors";
import {
  useAddShippingBoxItemMutation,
  useCloseShippingBoxMutation,
  useCreateShippingBoxMutation,
  useGenerateItemSlipPdfMutation,
  useGetShippingBoxQuery,
  useListShippingBoxesPaginatedQuery,
  useRemoveShippingBoxItemMutation,
} from "./shippingApi";

const ALL_RETAILERS = "";
const ALL_STATUSES = "";

function stepChipColor(status: ManufacturingStepStatus): "default" | "warning" | "success" {
  if (status === "complete") return "success";
  if (status === "assigned") return "warning";
  return "default";
}

/**
 * Same hidden-iframe + `contentWindow.print()` mechanism as legacy
 * `OrderStatusBarcoding.jsx`'s `generateQR`, so the slip "opens exactly like
 * it is opening in the legacy" (auto-print, not a new tab the user has to
 * print from manually — the other PDF actions on this codebase's other
 * pages all `window.open` instead, but this one feature was called out
 * specifically to match legacy's own printer-dispatch behavior).
 *
 * Legacy generated the PDF client-side, so its `URL.createObjectURL` blob
 * was always same-origin. This PDF is fetched from the API server — a
 * different origin than the client dev server — and a cross-origin
 * `<iframe>` can neither be framed past `helmet()`'s default
 * `frame-ancestors 'self'` CSP nor have `.print()` called on it (`print` is
 * not in the browser's small cross-origin-safe Window property allowlist,
 * unlike `close`/`focus`/`postMessage`). Fetching the PDF bytes first and
 * printing from a locally-created blob URL keeps the iframe same-origin,
 * exactly reproducing legacy's approach instead of framing the remote URL
 * directly.
 */
async function printPdfInHiddenIframe(url: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.onload = () => {
    iframe.contentWindow?.print();
  };
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
}

/**
 * Shipping — PHASE_6_TASKS.md Group 10, the last group of Phase 6, against
 * Group 2's `shipping.service.ts`/`shipping.routes.ts`. One screen covers
 * the whole workflow (create a box → pack it by component id → close it),
 * same "one page per continuous workflow" shape `JobAssignmentPage.tsx`
 * (Group 7) established for the factory floor, rather than separate
 * list/detail routes.
 *
 * Packing reuses Group 7's manual-id-lookup pattern verbatim, including the
 * *same* `GET /manufacturing/components/:id` read
 * (`useGetComponentDetailQuery`, already built for `JobAssignmentPage.tsx`)
 * to preview a component's manufacturing-step status before attempting to
 * pack it — not a new endpoint, and not a second implementation of the
 * "is this component fully manufactured" question. The preview is a UX
 * nicety only: the actual gate is server-side (`addItemToBox`'s
 * `requireCompleteManufacturing`), so clicking "Add to box" on a component
 * the preview already flagged as incomplete still round-trips to the server
 * and shows that real rejection, exactly as it would if the preview had
 * been skipped entirely (e.g. by pasting an id no preview was ever run for).
 */
export function ShippingPage() {
  const [retailerFilter, setRetailerFilter] = useState(ALL_RETAILERS);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const pagination = usePagination();

  const { data: retailers } = useListRetailersQuery();
  const { data: products } = useListProductsQuery();
  const { data: processes } = useListProcessesQuery();

  const listFilter = {
    ...(retailerFilter ? { retailerId: retailerFilter } : {}),
    ...(statusFilter ? { isClosed: statusFilter === "Closed" } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const { data: boxesResponse, isLoading, isError, error } = useListShippingBoxesPaginatedQuery(listFilter);
  const boxes = boxesResponse?.data;

  function handleRetailerFilterChange(event: SelectChangeEvent) {
    setRetailerFilter(event.target.value);
    pagination.onPageChange(1);
  }

  function handleStatusFilterChange(event: SelectChangeEvent) {
    setStatusFilter(event.target.value);
    pagination.onPageChange(1);
  }

  const [createShippingBox, createState] = useCreateShippingBoxMutation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formRetailerId, setFormRetailerId] = useState("");

  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const { data: boxDetail, isFetching: isLoadingBox } = useGetShippingBoxQuery(selectedBoxId ?? "", { skip: !selectedBoxId });

  const [componentIdInput, setComponentIdInput] = useState("");
  const [lookupId, setLookupId] = useState("");
  const { data: previewComponent, isFetching: isLookingUp, isError: isLookupError, error: lookupError } = useGetComponentDetailQuery(
    lookupId,
    { skip: !lookupId }
  );

  const [addShippingBoxItem, addState] = useAddShippingBoxItemMutation();
  const [removeShippingBoxItem] = useRemoveShippingBoxItemMutation();
  const [closeShippingBox, closeState] = useCloseShippingBoxMutation();

  const [addError, setAddError] = useState<string | null>(null);
  const [addFlash, setAddFlash] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const [slipComponentId, setSlipComponentId] = useState("");
  const [generateItemSlipPdf, slipState] = useGenerateItemSlipPdfMutation();
  const [slipError, setSlipError] = useState<string | null>(null);

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));
  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const processNameById = new Map((processes ?? []).map((process) => [process.id, process.name]));
  const activeRetailers = (retailers ?? []).filter((retailer) => retailer.isActive);

  function openCreateDialog() {
    setFormRetailerId("");
    setCreateDialogOpen(true);
  }

  async function handleCreateBox() {
    try {
      const box = await createShippingBox({ retailerId: formRetailerId }).unwrap();
      setCreateDialogOpen(false);
      selectBox(box.id);
    } catch {
      // surfaced below via createState.error
    }
  }

  function selectBox(boxId: string) {
    setSelectedBoxId(boxId);
    resetPackingState();
  }

  function resetPackingState() {
    setComponentIdInput("");
    setLookupId("");
    setAddError(null);
    setAddFlash(null);
    setCloseError(null);
  }

  function handleLookupSubmit(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    setAddFlash(null);
    setLookupId(componentIdInput.trim());
  }

  async function handleAddToBox() {
    if (!selectedBoxId || !previewComponent) return;
    setAddError(null);
    setAddFlash(null);
    try {
      await addShippingBoxItem({ boxId: selectedBoxId, orderItemComponentId: previewComponent.id }).unwrap();
      setAddFlash(`Added "${previewComponent.slotLabel}" to the box.`);
      setComponentIdInput("");
      setLookupId("");
    } catch (err) {
      setAddError(getShippingErrorMessage(err, "Failed to add that component to the box."));
    }
  }

  async function handleRemoveItem(orderItemComponentId: string) {
    if (!selectedBoxId) return;
    try {
      await removeShippingBoxItem({ boxId: selectedBoxId, orderItemComponentId }).unwrap();
    } catch (err) {
      setAddError(getShippingErrorMessage(err, "Failed to remove that component from the box."));
    }
  }

  async function handleCloseBox() {
    if (!selectedBoxId) return;
    setCloseError(null);
    try {
      await closeShippingBox(selectedBoxId).unwrap();
    } catch (err) {
      setCloseError(getShippingErrorMessage(err, "Failed to close the box."));
    }
  }

  async function handlePrintSlip(event: FormEvent) {
    event.preventDefault();
    setSlipError(null);
    try {
      const path = await generateItemSlipPdf(slipComponentId.trim()).unwrap();
      await printPdfInHiddenIframe(resolveUploadUrl(path));
      setSlipComponentId("");
    } catch (err) {
      setSlipError(getShippingErrorMessage(err, "Failed to generate that item's shipping slip."));
    }
  }

  const previewIncompleteSteps = previewComponent
    ? previewComponent.manufacturingSteps.filter((step) => step.status !== "complete")
    : [];
  const previewManufacturingComplete = previewIncompleteSteps.length === 0;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Shipping</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Create Shipping Box
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="shipping-retailer-filter-label">Filter by retailer</InputLabel>
          <Select
            labelId="shipping-retailer-filter-label"
            label="Filter by retailer"
            value={retailerFilter}
            onChange={handleRetailerFilterChange}
          >
            <MenuItem value={ALL_RETAILERS}>All retailers</MenuItem>
            {retailers?.map((retailer) => (
              <MenuItem key={retailer.id} value={retailer.id}>
                {retailer.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="shipping-status-filter-label">Filter by status</InputLabel>
          <Select
            labelId="shipping-status-filter-label"
            label="Filter by status"
            value={statusFilter}
            onChange={handleStatusFilterChange}
          >
            <MenuItem value={ALL_STATUSES}>All statuses</MenuItem>
            <MenuItem value="Open">Open</MenuItem>
            <MenuItem value="Closed">Closed</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load shipping boxes.")}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }} data-testid="print-item-slip-panel">
        <Typography variant="subtitle1" gutterBottom>
          Print Item Slip
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Enter an order item component ID to print its shipping slip (order #, customer, and item) and mark the order as shipped —
          independent of the shipping boxes below.
        </Typography>
        <Box component="form" onSubmit={handlePrintSlip}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <TextField
              label="Order item component ID"
              fullWidth
              value={slipComponentId}
              onChange={(event) => setSlipComponentId(event.target.value)}
            />
            <Button type="submit" variant="contained" disabled={!slipComponentId.trim() || slipState.isLoading}>
              {slipState.isLoading ? "Printing…" : "Print Slip"}
            </Button>
          </Stack>
        </Box>
        {slipError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSlipError(null)}>
            {slipError}
          </Alert>
        )}
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tracking Code</TableCell>
              <TableCell>Retailer</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {boxes?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No shipping boxes yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {boxes?.map((box) => (
              <TableRow key={box.id} selected={box.id === selectedBoxId}>
                <TableCell>{box.trackingCode}</TableCell>
                <TableCell>{retailerNameById.get(box.retailerId) ?? "—"}</TableCell>
                <TableCell>
                  <Chip size="small" label={box.isClosed ? "Closed" : "Open"} color={box.isClosed ? "default" : "success"} />
                </TableCell>
                <TableCell>{new Date(box.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label={`Manage ${box.trackingCode}`} onClick={() => selectBox(box.id)}>
                    <InventoryIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={boxesResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      {selectedBoxId && (
        <Paper variant="outlined" sx={{ p: 3 }} data-testid="shipping-box-detail-panel">
          {isLoadingBox && !boxDetail ? (
            <LoadingSpinner />
          ) : boxDetail ? (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="h6">{boxDetail.trackingCode}</Typography>
                  <Typography color="text.secondary">Retailer: {retailerNameById.get(boxDetail.retailerId) ?? "—"}</Typography>
                </Box>
                <Chip label={boxDetail.isClosed ? "Closed" : "Open"} color={boxDetail.isClosed ? "default" : "success"} />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Packed components ({boxDetail.items.length})
              </Typography>
              {boxDetail.items.length === 0 ? (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Nothing packed yet.
                </Typography>
              ) : (
                <Table size="small" sx={{ mb: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Slot</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Component ID</TableCell>
                      {!boxDetail.isClosed && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {boxDetail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.component?.slotLabel ?? "—"}</TableCell>
                        <TableCell>{item.component ? (productNameById.get(item.component.productId) ?? item.component.productId) : "—"}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8em" }}>{item.orderItemComponentId}</TableCell>
                        {!boxDetail.isClosed && (
                          <TableCell align="right">
                            <IconButton
                              aria-label={`Remove ${item.orderItemComponentId} from box`}
                              onClick={() => handleRemoveItem(item.orderItemComponentId)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {addFlash && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAddFlash(null)}>
                  {addFlash}
                </Alert>
              )}
              {addError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAddError(null)}>
                  {addError}
                </Alert>
              )}

              {!boxDetail.isClosed && (
                <>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    Add a component by ID
                  </Typography>
                  <Box component="form" onSubmit={handleLookupSubmit} sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <TextField
                        label="Order item component ID"
                        fullWidth
                        value={componentIdInput}
                        onChange={(event) => setComponentIdInput(event.target.value)}
                      />
                      <Button type="submit" variant="outlined" disabled={!componentIdInput.trim() || isLookingUp}>
                        Look up
                      </Button>
                    </Stack>
                  </Box>

                  {isLookupError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {getManufacturingErrorMessage(lookupError, getApiErrorMessage(lookupError, "Failed to look up that component."))}
                    </Alert>
                  )}

                  {previewComponent && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle2">
                        {previewComponent.slotLabel} — {productNameById.get(previewComponent.productId) ?? previewComponent.productId}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ my: 1, flexWrap: "wrap" }}>
                        {previewComponent.manufacturingSteps.map((step) => (
                          <Chip
                            key={step.id}
                            size="small"
                            color={stepChipColor(step.status)}
                            label={`${processNameById.get(step.processId) ?? step.processId}: ${step.status}`}
                          />
                        ))}
                      </Stack>
                      {previewManufacturingComplete ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          Manufacturing complete — ready to pack.
                        </Alert>
                      ) : (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          Manufacturing isn't complete for this component yet ({previewIncompleteSteps.length} step(s) pending) — packing
                          it will be rejected until every step is finished.
                        </Alert>
                      )}
                      <Button variant="contained" onClick={handleAddToBox} disabled={addState.isLoading}>
                        {addState.isLoading ? "Adding…" : "Add to box"}
                      </Button>
                    </Paper>
                  )}
                </>
              )}

              {closeError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCloseError(null)}>
                  {closeError}
                </Alert>
              )}

              {!boxDetail.isClosed && (
                <Button variant="outlined" color="secondary" onClick={handleCloseBox} disabled={closeState.isLoading}>
                  {closeState.isLoading ? "Closing…" : "Close box"}
                </Button>
              )}
            </Box>
          ) : null}
        </Paper>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Shipping Box</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel id="create-shipping-box-retailer-label">Retailer</InputLabel>
              <Select
                labelId="create-shipping-box-retailer-label"
                label="Retailer"
                value={formRetailerId}
                onChange={(event: SelectChangeEvent) => setFormRetailerId(event.target.value)}
              >
                {activeRetailers.map((retailer) => (
                  <MenuItem key={retailer.id} value={retailer.id}>
                    {retailer.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {createState.error && <Alert severity="error">{getApiErrorMessage(createState.error, "Failed to create shipping box.")}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateBox} disabled={!formRetailerId || createState.isLoading}>
            {createState.isLoading ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
