import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { getApiErrorMessage } from "../../api/errorUtils";
import {
  CustomerFormFields,
  EMPTY_CUSTOMER_FORM_VALUE,
  customerFormValueToCreateInput,
  isCustomerFormValid,
} from "../customers/CustomerFormFields";
import type { CustomerFormValue } from "../customers/CustomerFormFields";
import { useCreateCustomerMutation } from "../customers/customersApi";
import type { Customer, CustomerCreateInput } from "../customers/customersApi";

interface CustomerQuickCreateDialogProps {
  open: boolean;
  retailerId: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

/**
 * Inline quick-create for the order-builder wizard's customer step — the
 * "no dedicated customer admin screen" simplification from
 * `PHASE_5_TASKS.md`'s scope boundary. Field set/required-ness now shared
 * with `CustomersPage.tsx`'s admin dialog via `CustomerFormFields`, matching
 * legacy `NewCustomer.jsx`'s real requirements (firstName/lastName/gender
 * required; everything else optional).
 */
export function CustomerQuickCreateDialog({ open, retailerId, onClose, onCreated }: CustomerQuickCreateDialogProps) {
  const [form, setForm] = useState<CustomerFormValue>(EMPTY_CUSTOMER_FORM_VALUE);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [createCustomer, { isLoading, error }] = useCreateCustomerMutation();
  // `isLoading` only disables the "Create" button once React commits a re-render — a second
  // click/submit that lands before that commit (rapid double-click, or a duplicate synthetic
  // click some browsers/trackpads emit) would otherwise slip through and create a second
  // customer. A ref updates synchronously, so this closes the race regardless of trigger.
  const submittingRef = useRef(false);

  async function handleSubmit() {
    setSubmitAttempted(true);
    if (!isCustomerFormValid(form)) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const input: CustomerCreateInput = { retailerId, ...customerFormValueToCreateInput(form) };
      const customer = await createCustomer(input).unwrap();
      setForm(EMPTY_CUSTOMER_FORM_VALUE);
      setSubmitAttempted(false);
      onCreated(customer);
    } catch {
      // surfaced below via `error`
    } finally {
      submittingRef.current = false;
    }
  }

  function handleClose() {
    setForm(EMPTY_CUSTOMER_FORM_VALUE);
    setSubmitAttempted(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New Customer</DialogTitle>
      <DialogContent>
        <CustomerFormFields value={form} onChange={setForm} submitAttempted={submitAttempted} />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {getApiErrorMessage(error, "Failed to create customer.")}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isCustomerFormValid(form) || isLoading}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
