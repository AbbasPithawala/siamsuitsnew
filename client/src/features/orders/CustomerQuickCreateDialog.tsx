import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useCreateCustomerMutation } from "../customers/customersApi";
import type { Customer, CustomerCreateInput } from "../customers/customersApi";

interface CustomerQuickCreateDialogProps {
  open: boolean;
  retailerId: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

interface CustomerFormState {
  firstName: string;
  lastName: string;
  gender: string;
  contactNumber: string;
}

const EMPTY_FORM: CustomerFormState = { firstName: "", lastName: "", gender: "", contactNumber: "" };

/**
 * Inline quick-create for the order-builder wizard's customer step — the
 * "no dedicated customer admin screen" simplification from
 * `PHASE_5_TASKS.md`'s scope boundary. Only `firstName` is required per
 * `createCustomerSchema` in `server/src/routes/customers.routes.ts`;
 * everything else is optional there too.
 */
export function CustomerQuickCreateDialog({ open, retailerId, onClose, onCreated }: CustomerQuickCreateDialogProps) {
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [createCustomer, { isLoading, error }] = useCreateCustomerMutation();

  async function handleSubmit() {
    try {
      const input: CustomerCreateInput = { retailerId, firstName: form.firstName.trim() };
      const lastName = form.lastName.trim();
      const gender = form.gender.trim();
      const contactNumber = form.contactNumber.trim();
      if (lastName) input.lastName = lastName;
      if (gender) input.gender = gender;
      if (contactNumber) input.contactNumber = contactNumber;

      const customer = await createCustomer(input).unwrap();
      setForm(EMPTY_FORM);
      onCreated(customer);
    } catch {
      // surfaced below via `error`
    }
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New Customer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
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
          {error && <Alert severity="error">{getApiErrorMessage(error, "Failed to create customer.")}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!form.firstName.trim() || isLoading}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
