import { useState } from "react";
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
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, CheckCircle as CheckCircleIcon, Delete as DeleteIcon, Visibility as VisibilityIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { useCreateInvoiceMutation, useListInvoicesPaginatedQuery, useUpdateInvoiceStatusMutation } from "./invoicesApi";
import type { Invoice, LineItemInput } from "./invoicesApi";

const ALL_RETAILERS = "";
const ALL_STATUSES = "";

interface LineItemFormRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_LINE_ITEM: LineItemFormRow = { description: "", quantity: "1", unitPrice: "" };

function isValidLineItemRow(row: LineItemFormRow): boolean {
  return row.description.trim().length > 0 && Number(row.quantity) > 0 && row.unitPrice.trim() !== "" && Number(row.unitPrice) >= 0;
}

function toLineItemInputs(rows: LineItemFormRow[]): LineItemInput[] {
  return rows.map((row) => ({ description: row.description.trim(), quantity: Number(row.quantity), unitPrice: Number(row.unitPrice) }));
}

/**
 * Invoicing — PHASE_6_TASKS.md Group 9, against Group 1's
 * `invoices.service.ts`/`invoices.routes.ts`. `GET /invoices` itself
 * requires `invoices.view` (unlike the open-read catalog/customers
 * convention — see that route file's doc comment on why financial data
 * gates reads more strictly), so this whole page sits behind a page-level
 * `RequirePermission` in `AppRoutes.tsx`, same as `OrderListPage.tsx`.
 * Creating an invoice and marking one paid both additionally require
 * `invoices.manage`, checked here via `useHasPermission` so a view-only
 * actor (holds `invoices.view` but not `invoices.manage`) sees the list
 * without the mutating controls — the same split `TailorsPage.tsx` uses for
 * its own two independent permission keys.
 *
 * Deliberately the least structurally novel screen in this phase per
 * `PHASE_6_TASKS.md`: a plain list + create-dialog + one status-transition
 * action, no bespoke wizard. `total`/`lineItems[].amount` displayed
 * anywhere on this page always come straight from the server response —
 * this page never sums a line item's `quantity * unitPrice` itself.
 */
export function InvoicesPage() {
  const canManage = useHasPermission("invoices.manage");

  const [retailerFilter, setRetailerFilter] = useState(ALL_RETAILERS);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const pagination = usePagination();

  const { data: retailers } = useListRetailersQuery();
  const filter = {
    ...(retailerFilter ? { retailerId: retailerFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const { data: invoicesResponse, isLoading, isError, error } = useListInvoicesPaginatedQuery(filter);
  const invoices = invoicesResponse?.data;

  function handleRetailerFilterChange(event: SelectChangeEvent) {
    setRetailerFilter(event.target.value);
    pagination.onPageChange(1);
  }

  function handleStatusFilterChange(event: SelectChangeEvent) {
    setStatusFilter(event.target.value);
    pagination.onPageChange(1);
  }

  const [createInvoice, createState] = useCreateInvoiceMutation();
  const [updateInvoiceStatus, updateState] = useUpdateInvoiceStatusMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formRetailerId, setFormRetailerId] = useState("");
  const [lineItems, setLineItems] = useState<LineItemFormRow[]>([{ ...EMPTY_LINE_ITEM }]);
  const [discount, setDiscount] = useState("");
  const [shippingCharge, setShippingCharge] = useState("");

  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));
  const activeRetailers = (retailers ?? []).filter((retailer) => retailer.isActive);

  const isFormValid = formRetailerId.length > 0 && lineItems.length > 0 && lineItems.every(isValidLineItemRow);

  function openCreateDialog() {
    setFormRetailerId("");
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
    setDiscount("");
    setShippingCharge("");
    setDialogOpen(true);
  }

  function updateLineItem(index: number, patch: Partial<LineItemFormRow>) {
    setLineItems((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLineItem() {
    setLineItems((current) => [...current, { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    try {
      await createInvoice({
        retailerId: formRetailerId,
        lineItems: toLineItemInputs(lineItems),
        ...(discount.trim() ? { discount: Number(discount) } : {}),
        ...(shippingCharge.trim() ? { shippingCharge: Number(shippingCharge) } : {}),
      }).unwrap();
      setDialogOpen(false);
    } catch {
      // surfaced below via createState.error
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    setMarkPaidError(null);
    setPayingId(invoice.id);
    try {
      await updateInvoiceStatus({ id: invoice.id, status: "Paid" }).unwrap();
    } catch (err) {
      setMarkPaidError(getApiErrorMessage(err, "Failed to mark invoice as paid."));
    } finally {
      setPayingId(null);
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Invoices</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Create Invoice
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="invoice-retailer-filter-label">Filter by retailer</InputLabel>
          <Select
            labelId="invoice-retailer-filter-label"
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
          <InputLabel id="invoice-status-filter-label">Filter by status</InputLabel>
          <Select
            labelId="invoice-status-filter-label"
            label="Filter by status"
            value={statusFilter}
            onChange={handleStatusFilterChange}
          >
            <MenuItem value={ALL_STATUSES}>All statuses</MenuItem>
            <MenuItem value="Unpaid">Unpaid</MenuItem>
            <MenuItem value="Paid">Paid</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load invoices.")}
        </Alert>
      )}

      {markPaidError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMarkPaidError(null)}>
          {markPaidError}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Retailer</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">No invoices yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {invoices?.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.invoiceNumber}</TableCell>
                <TableCell>{retailerNameById.get(invoice.retailerId) ?? "—"}</TableCell>
                <TableCell align="right">THB {invoice.total}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={invoice.status}
                    color={invoice.status === "Paid" ? "success" : "warning"}
                  />
                </TableCell>
                <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label={`View ${invoice.invoiceNumber}`} onClick={() => setViewTarget(invoice)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  {canManage && invoice.status === "Unpaid" && (
                    <IconButton
                      aria-label={`Mark ${invoice.invoiceNumber} paid`}
                      onClick={() => handleMarkPaid(invoice)}
                      disabled={updateState.isLoading && payingId === invoice.id}
                    >
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={invoicesResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Invoice</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel id="create-invoice-retailer-label">Retailer</InputLabel>
              <Select
                labelId="create-invoice-retailer-label"
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

            <Divider />
            <Typography variant="subtitle1">Line items</Typography>

            {lineItems.map((row, index) => (
              <Stack direction="row" spacing={2} key={index} alignItems="flex-start">
                <TextField
                  label="Description"
                  required
                  fullWidth
                  value={row.description}
                  onChange={(event) => updateLineItem(index, { description: event.target.value })}
                />
                <TextField
                  label="Quantity"
                  type="number"
                  required
                  inputProps={{ min: 1, step: "1" }}
                  sx={{ minWidth: 120 }}
                  value={row.quantity}
                  onChange={(event) => updateLineItem(index, { quantity: event.target.value })}
                />
                <TextField
                  label="Unit price"
                  type="number"
                  required
                  inputProps={{ min: 0, step: "0.01" }}
                  sx={{ minWidth: 140 }}
                  value={row.unitPrice}
                  onChange={(event) => updateLineItem(index, { unitPrice: event.target.value })}
                />
                <IconButton
                  aria-label={`Remove line item ${index + 1}`}
                  onClick={() => removeLineItem(index)}
                  disabled={lineItems.length === 1}
                  sx={{ mt: 1 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            <Button onClick={addLineItem} sx={{ alignSelf: "flex-start" }}>
              Add line item
            </Button>

            <Divider />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Discount"
                type="number"
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
              <TextField
                label="Shipping charge"
                type="number"
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
                value={shippingCharge}
                onChange={(event) => setShippingCharge(event.target.value)}
              />
            </Stack>

            {createState.error && <Alert severity="error">{getApiErrorMessage(createState.error, "Failed to create invoice.")}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid || createState.isLoading}>
            {createState.isLoading ? "Creating…" : "Create Invoice"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewTarget !== null} onClose={() => setViewTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>{viewTarget?.invoiceNumber}</DialogTitle>
        <DialogContent>
          {viewTarget && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit price</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewTarget.lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">THB {item.unitPrice}</TableCell>
                      <TableCell align="right">THB {item.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Divider />
              <Table size="small" sx={{ maxWidth: 320 }}>
                <TableBody>
                  <TableRow>
                    <TableCell>Discount</TableCell>
                    <TableCell align="right">THB {viewTarget.discount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Shipping charge</TableCell>
                    <TableCell align="right">THB {viewTarget.shippingCharge}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      THB {viewTarget.total}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Chip
                size="small"
                sx={{ alignSelf: "flex-start" }}
                label={viewTarget.status}
                color={viewTarget.status === "Paid" ? "success" : "warning"}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
