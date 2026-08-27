import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { useListFeaturesQuery } from "../catalog/featuresApi";
import { useListMeasurementDefinitionsQuery } from "../catalog/measurementDefinitionsApi";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useListProductsQuery } from "../catalog/productsApi";
import { useListSuperProductsQuery } from "../catalog/superProductsApi";
import { useGetCustomerQuery } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { resolveUploadUrl } from "../uploads/uploadsApi";
import {
  useGenerateOrderPdfMutation,
  useGetOrderQuery,
  useReassignOrderRetailerMutation,
  useSetOrderStatusMutation,
} from "./ordersApi";
import type { ManufacturingStepStatus, OrderDetailComponent } from "./ordersApi";

function customerName(customer: Customer): string {
  return customer.lastName ? `${customer.firstName} ${customer.lastName}` : customer.firstName;
}

function stepChipColor(status: ManufacturingStepStatus): "default" | "warning" | "success" {
  if (status === "complete") return "success";
  if (status === "assigned") return "warning";
  return "default";
}

/**
 * Order detail — PHASE_6_TASKS.md Group 6. Renders the full nested structure
 * `GET /orders/:id` already returns (items -> components -> measurements/
 * features/manufacturingSteps, `orders.service.ts`'s `assembleOrderDetail`)
 * with no super-product-specific branching, same generic-rendering principle
 * `orderPdf.service.ts`'s `renderComponentSection` already established for
 * the PDF.
 *
 * Display names (product/measurement-definition/feature/style/process) are
 * resolved client-side against the existing open-read catalog list
 * endpoints (`useListProductsQuery` etc.) rather than a bespoke "order
 * display" backend endpoint — those lists are small, tenant-wide catalogs
 * already fetched elsewhere in the app and cached by RTK Query. Customer is
 * the one exception: `listCustomers` is mandatorily paginated (Workstream C)
 * and this tenant now has hundreds of real customers, so an unfiltered list
 * fetch would silently miss whichever customer isn't on page 1 — fetched by
 * id instead via `useGetCustomerQuery`.
 */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canRepeat = useHasPermission("orders.repeat");
  /** PHASE_10_TASKS.md Workstream E Group 6.3d — gates the edit-wizard entry point and the status/cancel/reassign actions below, all real second-order mutations distinct from `orders.create`/`orders.view`. */
  const canEdit = useHasPermission("orders.edit");

  const { data: order, isLoading, isError, error } = useGetOrderQuery(id ?? "", { skip: !id });
  const { data: retailers } = useListRetailersQuery();
  const { data: customer } = useGetCustomerQuery(order?.customerId ?? "", { skip: !order?.customerId });
  const { data: superProducts } = useListSuperProductsQuery();
  const { data: products } = useListProductsQuery();
  const { data: measurementDefinitions } = useListMeasurementDefinitionsQuery();
  const { data: features } = useListFeaturesQuery();
  const { data: processes } = useListProcessesQuery();

  const [generatePdf, generatePdfState] = useGenerateOrderPdfMutation();
  const [pdfResult, setPdfResult] = useState<{ path: string } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [setOrderStatus, setOrderStatusState] = useSetOrderStatusMutation();
  const [reassignOrderRetailer, reassignState] = useReassignOrderRetailerMutation();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignRetailerId, setReassignRetailerId] = useState("");

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));
  const superProductNameById = new Map((superProducts ?? []).map((sp) => [sp.id, sp.name]));
  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const measurementDefById = new Map((measurementDefinitions ?? []).map((def) => [def.id, def]));
  const featureById = new Map((features ?? []).map((feature) => [feature.id, feature]));
  const processNameById = new Map((processes ?? []).map((process) => [process.id, process.name]));

  async function handleGeneratePdf() {
    if (!id) return;
    setPdfError(null);
    setPdfResult(null);
    try {
      const result = await generatePdf(id).unwrap();
      setPdfResult({ path: result.path });
    } catch (err) {
      setPdfError(getApiErrorMessage(err, "Failed to generate PDF."));
    }
  }

  function handleRepeatOrder() {
    if (!id) return;
    navigate(`/orders/new?repeatOfOrderId=${id}`);
  }

  function handleEditOrder() {
    if (!id) return;
    navigate(`/orders/${id}/edit`);
  }

  async function handleCancelOrder() {
    if (!id) return;
    setStatusError(null);
    try {
      await setOrderStatus({ id, status: "Cancelled" }).unwrap();
    } catch (err) {
      setStatusError(getApiErrorMessage(err, "Failed to cancel order."));
    }
  }

  async function handleMarkModified() {
    if (!id) return;
    setStatusError(null);
    try {
      await setOrderStatus({ id, status: "Modified" }).unwrap();
    } catch (err) {
      setStatusError(getApiErrorMessage(err, "Failed to update order status."));
    }
  }

  function openReassignDialog() {
    setReassignRetailerId(order?.retailerId ?? "");
    setStatusError(null);
    setReassignDialogOpen(true);
  }

  async function handleReassignRetailer() {
    if (!id || !reassignRetailerId) return;
    setStatusError(null);
    try {
      await reassignOrderRetailer({ id, retailerId: reassignRetailerId }).unwrap();
      setReassignDialogOpen(false);
    } catch (err) {
      setStatusError(getApiErrorMessage(err, "Failed to reassign retailer."));
    }
  }

  function renderFeatureValue(feature: OrderDetailComponent["features"][number]): string {
    const def = featureById.get(feature.featureId);
    if (def?.type === "choice") {
      const style = def.styles?.find((s) => s.id === feature.styleId);
      const option = style?.options.find((o) => o.id === feature.styleOptionId);
      return [style?.name, option?.name].filter((v): v is string => Boolean(v)).join(" / ") || "—";
    }
    if (def?.type === "text") {
      return feature.textValue ?? "—";
    }
    return feature.structuredValue ? JSON.stringify(feature.structuredValue) : "—";
  }

  function componentProgress(component: OrderDetailComponent): string {
    const total = component.manufacturingSteps.length;
    const complete = component.manufacturingSteps.filter((s) => s.status === "complete").length;
    return `${complete} of ${total} steps complete`;
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError || !order) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{getApiErrorMessage(error, "Failed to load order.")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5">Order {order.orderNumber}</Typography>
          <Typography color="text.secondary">
            Retailer: {retailerNameById.get(order.retailerId) ?? "—"} &middot; Customer:{" "}
            {customer ? customerName(customer) : "—"}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" label={order.status} />
            {order.isRush && <Chip size="small" color="warning" label="Rush" />}
            {order.isRepeat && <Chip size="small" color="info" label="Repeat" />}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {canRepeat && (
            <Button variant="outlined" onClick={handleRepeatOrder}>
              Repeat this order
            </Button>
          )}
          {/*
           * PHASE_10_TASKS.md Workstream E Group 6.3d — all four gated on
           * `orders.edit` alone (Retailer never holds it, per Group 5), no
           * button-level split beyond that single check: the edit wizard and
           * the three smaller status/reassign actions are all real second-order
           * mutations against an existing order, none of them `orders.create`.
           */}
          {canEdit && (
            <Button variant="outlined" onClick={handleEditOrder}>
              Edit Order
            </Button>
          )}
          {canEdit && (
            <Button variant="outlined" onClick={handleMarkModified} disabled={setOrderStatusState.isLoading}>
              Mark Modified
            </Button>
          )}
          {canEdit && (
            <Button variant="outlined" color="error" onClick={handleCancelOrder} disabled={setOrderStatusState.isLoading}>
              Cancel Order
            </Button>
          )}
          {canEdit && (
            <Button variant="outlined" onClick={openReassignDialog}>
              Reassign Retailer
            </Button>
          )}
          <Button variant="contained" onClick={handleGeneratePdf} disabled={generatePdfState.isLoading}>
            {generatePdfState.isLoading ? "Generating…" : "Generate PDF"}
          </Button>
        </Stack>
      </Stack>

      {statusError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {statusError}
        </Alert>
      )}
      {order.lastModifiedAt && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Modified on: {new Date(order.lastModifiedAt).toLocaleString()}
        </Alert>
      )}
      {pdfError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pdfError}
        </Alert>
      )}
      {pdfResult && (
        <Alert severity="success" sx={{ mb: 2 }}>
          PDF generated and stored on the server at:{" "}
          <a href={resolveUploadUrl(pdfResult.path)} target="_blank" rel="noopener noreferrer">
            {pdfResult.path}
          </a>
        </Alert>
      )}
      {!pdfResult && order.pdfPath && (
        <Alert severity="info" sx={{ mb: 2 }}>
          A PDF was previously generated for this order, stored on the server at:{" "}
          <a href={resolveUploadUrl(order.pdfPath)} target="_blank" rel="noopener noreferrer">
            {order.pdfPath}
          </a>
        </Alert>
      )}

      <Divider sx={{ mb: 3 }} />

      <Stack spacing={3}>
        {order.items.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {superProductNameById.get(item.superProductId) ?? "Item"} <Typography component="span" color="text.secondary">#{item.sequence}</Typography>
            </Typography>

            <Stack spacing={2}>
              {item.components.map((component) => (
                <Paper key={component.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1">
                      {component.slotLabel} ({productNameById.get(component.productId) ?? component.productId})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {componentProgress(component)}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
                    {component.manufacturingSteps.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No manufacturing steps defined.
                      </Typography>
                    )}
                    {component.manufacturingSteps.map((step) => (
                      <Chip
                        key={step.id}
                        size="small"
                        color={stepChipColor(step.status)}
                        label={`${processNameById.get(step.processId) ?? step.processId}: ${step.status}`}
                      />
                    ))}
                  </Stack>

                  {component.manualSizeImage && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Manual Size
                      </Typography>
                      <img
                        src={resolveUploadUrl(component.manualSizeImage)}
                        alt="Manual Size annotation"
                        style={{ maxWidth: 240, border: "1px solid #ddd" }}
                      />
                    </Box>
                  )}

                  <Typography variant="subtitle2" gutterBottom>
                    Measurements
                  </Typography>
                  {component.measurements.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No measurements recorded.
                    </Typography>
                  ) : (
                    <TableContainer sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Measurement</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell>Adj.</TableCell>
                            <TableCell>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {component.measurements.map((measurement) => (
                            <TableRow key={measurement.id}>
                              <TableCell>
                                {measurementDefById.get(measurement.measurementDefinitionId)?.name ?? measurement.measurementDefinitionId}
                              </TableCell>
                              <TableCell>{measurement.value ?? "—"}</TableCell>
                              <TableCell>{measurement.adjustmentValue ?? "—"}</TableCell>
                              <TableCell>{measurement.totalValue ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  <Typography variant="subtitle2" gutterBottom>
                    Features
                  </Typography>
                  {component.features.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No features selected.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Feature</TableCell>
                            <TableCell>Selection</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {component.features.map((feature) => (
                            <TableRow key={feature.id}>
                              <TableCell>{featureById.get(feature.featureId)?.name ?? feature.featureId}</TableCell>
                              <TableCell>{renderFeatureValue(feature)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Dialog open={reassignDialogOpen} onClose={() => setReassignDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reassign Retailer</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="reassign-retailer-label">Retailer</InputLabel>
            <Select
              labelId="reassign-retailer-label"
              label="Retailer"
              value={reassignRetailerId}
              onChange={(event) => setReassignRetailerId(event.target.value)}
            >
              {(retailers ?? []).map((retailer) => (
                <MenuItem key={retailer.id} value={retailer.id}>
                  {retailer.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleReassignRetailer}
            disabled={!reassignRetailerId || reassignState.isLoading}
          >
            {reassignState.isLoading ? "Saving…" : "Reassign"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
