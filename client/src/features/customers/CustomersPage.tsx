import { useRef, useState } from "react";
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
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import { useListRetailersQuery } from "../retailers/retailersApi";
import {
  CustomerFormFields,
  EMPTY_CUSTOMER_FORM_VALUE,
  customerFormValueToCreateInput,
  isCustomerFormValid,
} from "./CustomerFormFields";
import type { CustomerFormValue } from "./CustomerFormFields";
import {
  useCreateCustomerMutation,
  useDeleteCustomerMutation,
  useListCustomersPaginatedQuery,
  useUpdateCustomerMutation,
} from "./customersApi";
import type { Customer, CustomerCreateInput } from "./customersApi";

const ALL_RETAILERS = "";

interface CustomerFormState extends CustomerFormValue {
  retailerId: string;
}

const EMPTY_FORM: CustomerFormState = { ...EMPTY_CUSTOMER_FORM_VALUE, retailerId: "" };

function customerName(customer: Customer): string {
  return customer.lastName ? `${customer.firstName} ${customer.lastName}` : customer.firstName;
}

/**
 * Customers admin — PHASE_6_TASKS.md Group 5, the complementary full
 * management view for browsing/editing existing customers outside the
 * order-builder wizard's inline quick-create (`CustomerQuickCreateDialog.tsx`,
 * Phase 5 Group 7, which stays as-is). Same underlying `customersApi.ts` and
 * `Customer` shape as that dialog — a customer created here is immediately
 * usable in the wizard's picker and vice versa.
 *
 * `GET /customers` only requires `authenticate` (confirmed in
 * `customers.routes.ts`), so the page itself is open like the Phase 5
 * catalog screens; `customers.manage` gates the mutations only, checked here
 * via `useHasPermission` to hide the Add/Edit/Delete controls, matching how
 * `ProductsPage.tsx` et al. gate their own buttons internally for backend
 * reads that aren't gated (rather than a page-level `RequirePermission`,
 * which would incorrectly hide the whole page from read-only users). There's
 * no `isActive` column on `customers` (unlike `retailers`/`tailors`), so
 * "deactivate" is just the soft-delete action, same as `RetailersPage.tsx`'s
 * Delete button.
 */
export function CustomersPage() {
  const canManage = useHasPermission("customers.manage");
  const { data: me } = useMeQuery();
  // A retailer-linked session can only ever manage its own customers (server-side row-level
  // isolation force-overrides any client-supplied retailerId on reads) — so the retailer
  // picker/filter is meaningless for that session and hidden entirely, matching
  // `OrderListPage.tsx`'s/`OrderBuilderPage.tsx`'s identical retailer-lock pattern.
  const isRetailerLinked = Boolean(me?.retailerId);
  const { data: retailers } = useListRetailersQuery(undefined, { skip: isRetailerLinked });
  const [retailerFilter, setRetailerFilter] = useState<string>(ALL_RETAILERS);
  const pagination = usePagination();

  const {
    data: customersResponse,
    isLoading,
    isError,
    error,
  } = useListCustomersPaginatedQuery({
    ...(retailerFilter ? { retailerId: retailerFilter } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const customers = customersResponse?.data;

  function handleRetailerFilterChange(event: SelectChangeEvent) {
    setRetailerFilter(event.target.value);
    pagination.onPageChange(1);
  }

  const [createCustomer, createState] = useCreateCustomerMutation();
  const [updateCustomer, updateState] = useUpdateCustomerMutation();
  const [deleteCustomer, deleteState] = useDeleteCustomerMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  // See `CustomerQuickCreateDialog.tsx`'s identical guard: `mutationState.isLoading` only
  // disables the submit button once React commits a re-render, which a fast double-click (or a
  // duplicate synthetic click) can outrun and cause two customers to be created from one click.
  const submittingRef = useRef(false);

  const mutationState = editingId ? updateState : createState;
  const isFormValid = isCustomerFormValid(form) && form.retailerId.length > 0;

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));

  function openCreateDialog() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, retailerId: isRetailerLinked ? me!.retailerId! : retailerFilter || "" });
    setSubmitAttempted(false);
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      retailerId: customer.retailerId,
      firstName: customer.firstName,
      lastName: customer.lastName ?? "",
      gender: customer.gender ?? "",
      email: customer.email ?? "",
      contactNumber: customer.contactNumber ?? "",
      image: customer.image ?? "",
      imageNote: customer.imageNote ?? "",
    });
    setSubmitAttempted(false);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitAttempted(true);
    if (!isFormValid) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const input: CustomerCreateInput = { retailerId: form.retailerId, ...customerFormValueToCreateInput(form) };

      if (editingId) {
        await updateCustomer({ id: editingId, body: input }).unwrap();
      } else {
        await createCustomer(input).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // see ProductsPage.tsx's identical comment
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Customers</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Customer
          </Button>
        )}
      </Stack>

      {!isRetailerLinked && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 240 }}>
          <InputLabel id="customer-retailer-filter-label">Filter by retailer</InputLabel>
          <Select
            labelId="customer-retailer-filter-label"
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
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load customers.")}
        </Alert>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                {!isRetailerLinked && <TableCell>Retailer</TableCell>}
                <TableCell>Gender</TableCell>
                <TableCell>Contact</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {customers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(isRetailerLinked ? 3 : 4) + (canManage ? 1 : 0)}>
                    <Typography color="text.secondary">No customers yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customerName(customer)}</TableCell>
                  {!isRetailerLinked && <TableCell>{retailerNameById.get(customer.retailerId) ?? "—"}</TableCell>}
                  <TableCell>{customer.gender ?? "—"}</TableCell>
                  <TableCell>{customer.contactNumber ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <IconButton aria-label={`Edit ${customerName(customer)}`} onClick={() => openEditDialog(customer)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label={`Delete ${customerName(customer)}`} onClick={() => setDeleteTarget(customer)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls total={customersResponse?.pagination.total ?? 0} {...pagination} />
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Customer" : "Add Customer"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {!isRetailerLinked && (
              <FormControl required fullWidth>
                <InputLabel id="customer-retailer-label">Retailer</InputLabel>
                <Select
                  labelId="customer-retailer-label"
                  label="Retailer"
                  value={form.retailerId}
                  onChange={(event: SelectChangeEvent) => setForm((current) => ({ ...current, retailerId: event.target.value }))}
                >
                  {retailers?.map((retailer) => (
                    <MenuItem key={retailer.id} value={retailer.id}>
                      {retailer.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <CustomerFormFields
              value={form}
              onChange={(next) => setForm((current) => ({ ...current, ...next }))}
              submitAttempted={submitAttempted}
            />
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save customer.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid || mutationState.isLoading}>
            {editingId ? "Save" : "Add Customer"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        itemLabel={deleteTarget ? customerName(deleteTarget) : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        isDeleting={deleteState.isLoading}
      />
    </Box>
  );
}
