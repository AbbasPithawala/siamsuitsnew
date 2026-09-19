import { useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import type { SuperProduct } from "../catalog/superProductsApi";
import {
  CustomerFormFields,
  EMPTY_CUSTOMER_FORM_VALUE,
  customerFormValueToCreateInput,
  isCustomerFormValid,
} from "../customers/CustomerFormFields";
import type { CustomerFormValue } from "../customers/CustomerFormFields";
import { useCreateCustomerMutation, useUpdateCustomerMutation } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { LineItemMeasurementsPanel } from "./LineItemMeasurementsPanel";
import type {
  LineItemComponentMeasurementDraft,
  LineItemMeasurementsDraft,
} from "./LineItemMeasurementsPanel";
import type { LineItemDraft } from "./OrderCartStep";

function customerName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

function customerToFormValue(customer: Customer): CustomerFormValue {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName ?? "",
    gender: customer.gender ?? "",
    email: customer.email ?? "",
    contactNumber: customer.contactNumber ?? "",
    image: customer.image ?? "",
    imageNote: customer.imageNote ?? "",
  };
}

export interface GroupOrderManageCustomerPanelProps {
  retailerId: string;
  /** The slot's currently assigned customer, if any — pre-fills the form/Autocomplete when re-opening an already-managed row. */
  customerId: string | null;
  /** Already filtered by the parent to exclude customers assigned to a *different* slot in this same group (this slot's own current pick, if any, stays included). */
  customerOptions: Customer[];
  customersLoading: boolean;
  /**
   * Matches this page's pre-existing `canManageCustomers` gate
   * (`useHasPermission("customers.manage")`) — without it, this panel only
   * lets the admin pick and assign an already-existing customer (no profile
   * create/edit), same real restriction the old split "New Customer" button
   * enforced.
   */
  canManageCustomers: boolean;
  lineItems: LineItemDraft[];
  superProducts: SuperProduct[];
  measurementsByLineItem: Record<string, LineItemMeasurementsDraft>;
  onChangeMeasurements: (
    lineItemId: string,
    componentId: string,
    next: LineItemComponentMeasurementDraft
  ) => void;
  onClose: () => void;
  /** Persists the picked/created/updated customer onto this slot and returns to the Customers list. */
  onSaved: (customerId: string) => void;
}

/**
 * The Customers step's "Manage Customer" screen — combines what used to be a
 * separate `CustomerQuickCreateDialog` (create-only) plus an always-expanded
 * inline measurements card into the one screen legacy's real
 * `Group/newCustomer/NewCustomer.jsx` used: search/pick an existing customer
 * OR fill in a new registration, plus this slot's shared-line-item
 * measurement forms, plus a single Save/Update button
 * (`existingCustomer`-gated, exactly like legacy's own `existingCustomer`
 * state) that persists the profile and returns to the Customers list.
 *
 * Renders as plain in-flow content that takes over `NewGroupOrderPage`'s
 * entire Customers-step output — never a `Dialog` overlay — the same
 * "takes over this component's entire rendered output" pattern
 * `OrderCartStep.tsx`'s own focused Fabric & Styling/Measurements panel
 * already established (see that file's doc comment): it stays inside the app
 * shell's `<main>` content area like every other page, and "Cancel" just
 * clears the parent's `manageTargetKey`, bringing the customers table right
 * back.
 *
 * Measurement values themselves are NOT persisted here — same architecture
 * this page already had before this rework: `onChangeMeasurements` lifts
 * every keystroke straight into the parent's `customers` state, which is
 * only ever sent to the server at final "Place Group Order" time
 * (`NewGroupOrderPage.tsx`'s `handleSubmit`). Leaving this screen (Save/
 * Update, or Cancel) never loses that draft — only assigns/clears which
 * `customerId` this slot is currently attached to.
 *
 * The parent mounts this fresh (via `key`) per customer slot it opens
 * "Manage" on, so this component's own local state (`selectedCustomer`/
 * `form`/`existingCustomer`) only ever needs to initialize once, from props,
 * exactly like this project's own established `ManageLinkedItemsDialog`
 * key-remount precedent (`LineItemMeasurementsPanel.tsx`'s doc comment on
 * why *that* component uses a `useEffect` instead — this screen owns a real
 * local edited copy with an explicit Save moment, so the key-remount shape
 * fits here).
 */
export function GroupOrderManageCustomerPanel({
  retailerId,
  customerId,
  customerOptions,
  customersLoading,
  canManageCustomers,
  lineItems,
  superProducts,
  measurementsByLineItem,
  onChangeMeasurements,
  onClose,
  onSaved,
}: GroupOrderManageCustomerPanelProps) {
  const initialCustomer = customerId
    ? (customerOptions.find((option) => option.id === customerId) ?? null)
    : null;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer);
  const [form, setForm] = useState<CustomerFormValue>(
    initialCustomer ? customerToFormValue(initialCustomer) : EMPTY_CUSTOMER_FORM_VALUE
  );
  const [existingCustomer, setExistingCustomer] = useState(initialCustomer !== null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [createCustomer, createState] = useCreateCustomerMutation();
  const [updateCustomer, updateState] = useUpdateCustomerMutation();
  const isSaving = createState.isLoading || updateState.isLoading;
  const saveError = createState.error ?? updateState.error;

  function handleSelectExisting(option: Customer | null) {
    setSelectedCustomer(option);
    if (option) {
      setForm(customerToFormValue(option));
      setExistingCustomer(true);
    } else {
      setForm(EMPTY_CUSTOMER_FORM_VALUE);
      setExistingCustomer(false);
    }
  }

  async function handleSave() {
    setSubmitAttempted(true);
    if (!isCustomerFormValid(form)) return;
    try {
      if (existingCustomer && selectedCustomer) {
        await updateCustomer({
          id: selectedCustomer.id,
          body: customerFormValueToCreateInput(form),
        }).unwrap();
        onSaved(selectedCustomer.id);
      } else {
        const created = await createCustomer({
          retailerId,
          ...customerFormValueToCreateInput(form),
        }).unwrap();
        onSaved(created.id);
      }
    } catch {
      // surfaced below via `saveError`
    }
  }

  function handleSelectOnly() {
    if (selectedCustomer) onSaved(selectedCustomer.id);
  }

  return (
    <Box data-testid="manage-customer-panel">
      <Typography variant="h5" sx={{ mb: 3 }}>
        Manage Customer
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Search an existing customer
      </Typography>
      {/* Real search dropdown — same shape `OrderBuilderPage.tsx`'s/this
          page's own prior customer picker used (matches legacy's own
          `Group/newCustomer/NewCustomer.jsx` `Autocomplete`). */}
      <Autocomplete
        fullWidth
        size="small"
        options={customerOptions}
        loading={customersLoading}
        getOptionLabel={(option) => customerName(option)}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        value={selectedCustomer}
        onChange={(_event, option) => handleSelectExisting(option)}
        renderOption={({ key: _key, ...props }, option) => (
          <li key={option.id} {...props}>
            <ListItemText
              primary={customerName(option)}
              secondary={option.contactNumber ?? undefined}
            />
          </li>
        )}
        noOptionsText={
          canManageCustomers
            ? "No matching customers — register one below."
            : "No matching customers."
        }
        renderInput={({ InputLabelProps: _InputLabelProps, size: _size, ...params }) => (
          <TextField {...params} label="Search customers" size="small" />
        )}
        sx={{ mb: 2, maxWidth: 480 }}
      />

      {canManageCustomers ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {existingCustomer ? "Customer profile" : "Or register a new customer"}
          </Typography>
          <CustomerFormFields value={form} onChange={setForm} submitAttempted={submitAttempted} />
          {saveError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {getApiErrorMessage(saveError, "Failed to save customer.")}
            </Alert>
          )}
        </>
      ) : (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {selectedCustomer
            ? `Selected: ${customerName(selectedCustomer)}`
            : "Pick an existing customer above."}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        Measurements
      </Typography>
      <Stack spacing={2}>
        {lineItems.map((lineItem) => {
          const superProduct = superProducts.find((sp) => sp.id === lineItem.superProductId);
          if (!superProduct) return null;
          return (
            <Box key={lineItem.id}>
              <Typography variant="subtitle2" gutterBottom>
                {superProduct.name} × {lineItem.stylingDrafts.length}
              </Typography>
              <LineItemMeasurementsPanel
                components={superProduct.components}
                draft={measurementsByLineItem[lineItem.id] ?? {}}
                customerId={selectedCustomer?.id ?? null}
                onChange={(componentId, next) =>
                  onChangeMeasurements(lineItem.id, componentId, next)
                }
              />
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Stack direction="row" justifyContent="flex-end" spacing={2}>
        <Button onClick={onClose}>Cancel</Button>
        {canManageCustomers ? (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isCustomerFormValid(form) || isSaving}
          >
            {isSaving ? "Saving…" : existingCustomer ? "Update Customer" : "Save Customer"}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSelectOnly} disabled={!selectedCustomer}>
            Select Customer
          </Button>
        )}
      </Stack>
    </Box>
  );
}
