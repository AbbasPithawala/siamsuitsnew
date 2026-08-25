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
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import { useListRetailersQuery } from "../retailers/retailersApi";
import {
  useCreateCustomerMutation,
  useDeleteCustomerMutation,
  useListCustomersPaginatedQuery,
  useUpdateCustomerMutation,
} from "./customersApi";
import type { Customer, CustomerCreateInput } from "./customersApi";

const ALL_RETAILERS = "";

interface CustomerFormState {
  retailerId: string;
  firstName: string;
  lastName: string;
  gender: string;
  contactNumber: string;
  image: string;
}

const EMPTY_FORM: CustomerFormState = { retailerId: "", firstName: "", lastName: "", gender: "", contactNumber: "", image: "" };

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
  const { data: retailers } = useListRetailersQuery();
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
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const mutationState = editingId ? updateState : createState;
  const isFormValid = form.firstName.trim().length > 0 && form.retailerId.length > 0;

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));

  function openCreateDialog() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, retailerId: retailerFilter || "" });
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      retailerId: customer.retailerId,
      firstName: customer.firstName,
      lastName: customer.lastName ?? "",
      gender: customer.gender ?? "",
      contactNumber: customer.contactNumber ?? "",
      image: customer.image ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      const input: CustomerCreateInput = { retailerId: form.retailerId, firstName: form.firstName.trim() };
      const lastName = form.lastName.trim();
      const gender = form.gender.trim();
      const contactNumber = form.contactNumber.trim();
      const image = form.image.trim();
      if (lastName) input.lastName = lastName;
      if (gender) input.gender = gender;
      if (contactNumber) input.contactNumber = contactNumber;
      if (image) input.image = image;

      if (editingId) {
        await updateCustomer({ id: editingId, body: input }).unwrap();
      } else {
        await createCustomer(input).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
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
                <TableCell>Retailer</TableCell>
                <TableCell>Gender</TableCell>
                <TableCell>Contact</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {customers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4}>
                    <Typography color="text.secondary">No customers yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customerName(customer)}</TableCell>
                  <TableCell>{retailerNameById.get(customer.retailerId) ?? "—"}</TableCell>
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
            <TextField
              label="First name"
              required
              fullWidth
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            />
            <TextField
              label="Last name"
              fullWidth
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            />
            <TextField
              label="Gender"
              fullWidth
              value={form.gender}
              onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
            />
            <TextField
              label="Contact number"
              fullWidth
              value={form.contactNumber}
              onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))}
            />
            <TextField
              label="Image URL"
              fullWidth
              value={form.image}
              onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))}
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
