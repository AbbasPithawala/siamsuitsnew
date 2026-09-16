import type { ChangeEvent } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { getApiErrorMessage } from "../../api/errorUtils";
import { resolveUploadUrl, useUploadFileMutation } from "../uploads/uploadsApi";
import type { CustomerCreateInput } from "./customersApi";

/**
 * The customer field set/required-ness this form shares between
 * `CustomerQuickCreateDialog.tsx` (order-builder inline quick-create) and
 * `CustomersPage.tsx`'s admin Add/Edit dialog — both previously wrote their
 * own inconsistent inline `TextField`s. Matches legacy `siamClient/src/
 * components/retailerAdmin/retailerPages/newCustomer/NewCustomer.jsx`'s real
 * field set/required-ness (firstname/lastname/gender required, email/phone/
 * image/imageNote optional), translated into this app's MUI/RTK-Query
 * idioms rather than copied verbatim.
 */
export interface CustomerFormValue {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  contactNumber: string;
  image: string;
  imageNote: string;
}

export const EMPTY_CUSTOMER_FORM_VALUE: CustomerFormValue = {
  firstName: "",
  lastName: "",
  gender: "",
  email: "",
  contactNumber: "",
  image: "",
  imageNote: "",
};

const GENDER_OPTIONS = ["Male", "Female", "Other"];

/**
 * `firstName`/`lastName`/`gender` non-empty (trimmed) — the same three
 * fields legacy's `validator.isEmpty` gate checks, no others (email/phone/
 * image/imageNote all stay optional).
 */
export function isCustomerFormValid(value: CustomerFormValue): boolean {
  return value.firstName.trim().length > 0 && value.lastName.trim().length > 0 && value.gender.trim().length > 0;
}

interface CustomerFormFieldsProps {
  value: CustomerFormValue;
  onChange: (value: CustomerFormValue) => void;
  /** Gates the required-field error states, mirroring legacy's `validationError` — errors only surface after a submit attempt, not while first filling the form in. */
  submitAttempted: boolean;
}

export function CustomerFormFields({ value, onChange, submitAttempted }: CustomerFormFieldsProps) {
  const [uploadFile, uploadState] = useUploadFileMutation();

  function set<K extends keyof CustomerFormValue>(key: K, next: CustomerFormValue[K]) {
    onChange({ ...value, [key]: next });
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const result = await uploadFile(file).unwrap();
      set("image", result.url);
    } catch {
      // surfaced below via uploadState.error
    }
  }

  const firstNameError = submitAttempted && value.firstName.trim().length === 0;
  const lastNameError = submitAttempted && value.lastName.trim().length === 0;
  const genderError = submitAttempted && value.gender.trim().length === 0;

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar {...(value.image ? { src: resolveUploadUrl(value.image) } : {})} sx={{ width: 96, height: 96 }} />
        <Button component="label" variant="outlined" disabled={uploadState.isLoading}>
          {uploadState.isLoading ? "Uploading…" : "Add Photo"}
          <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
        </Button>
      </Stack>
      {uploadState.error && <Alert severity="error">{getApiErrorMessage(uploadState.error, "Failed to upload photo.")}</Alert>}

      <TextField
        label="First name"
        required
        fullWidth
        value={value.firstName}
        onChange={(event) => set("firstName", event.target.value)}
        error={firstNameError}
        helperText={firstNameError ? "First name is required." : undefined}
      />
      <TextField
        label="Last name"
        required
        fullWidth
        value={value.lastName}
        onChange={(event) => set("lastName", event.target.value)}
        error={lastNameError}
        helperText={lastNameError ? "Last name is required." : undefined}
      />
      <FormControl required fullWidth error={genderError}>
        <InputLabel id="customer-form-gender-label">Gender</InputLabel>
        <Select
          labelId="customer-form-gender-label"
          label="Gender"
          value={value.gender}
          onChange={(event: SelectChangeEvent) => set("gender", event.target.value)}
        >
          {GENDER_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
        {genderError && <FormHelperText>Gender is required.</FormHelperText>}
      </FormControl>
      <TextField
        label="Email"
        type="email"
        fullWidth
        value={value.email}
        onChange={(event) => set("email", event.target.value)}
      />
      <TextField
        label="Contact number"
        fullWidth
        value={value.contactNumber}
        onChange={(event) => set("contactNumber", event.target.value)}
      />
      <TextField
        label="Customer Image Note"
        multiline
        minRows={2}
        fullWidth
        value={value.imageNote}
        onChange={(event) => set("imageNote", event.target.value)}
      />
    </Stack>
  );
}

/**
 * Trims and drops empty-optional fields, matching this codebase's established
 * "only send non-empty optional fields" convention (`CustomerQuickCreateDialog.tsx`'s/
 * `CustomersPage.tsx`'s prior inline `handleSubmit`s, `RetailerProfilePage.tsx`'s
 * `ProfileForm`). Callers merge `retailerId` in themselves since it isn't part of
 * this shared form value.
 */
export function customerFormValueToCreateInput(value: CustomerFormValue): Omit<CustomerCreateInput, "retailerId"> {
  const trimmed = {
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    gender: value.gender.trim(),
    email: value.email.trim(),
    contactNumber: value.contactNumber.trim(),
    image: value.image.trim(),
    imageNote: value.imageNote.trim(),
  };
  const input: Omit<CustomerCreateInput, "retailerId"> = { firstName: trimmed.firstName };
  if (trimmed.lastName) input.lastName = trimmed.lastName;
  if (trimmed.gender) input.gender = trimmed.gender;
  if (trimmed.email) input.email = trimmed.email;
  if (trimmed.contactNumber) input.contactNumber = trimmed.contactNumber;
  if (trimmed.image) input.image = trimmed.image;
  if (trimmed.imageNote) input.imageNote = trimmed.imageNote;
  return input;
}
