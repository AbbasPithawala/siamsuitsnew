import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useGetRetailerQuery, useUpdateRetailerMutation } from "./retailersApi";
import type { Retailer, RetailerInput } from "./retailersApi";

interface ProfileFormState {
  name: string;
  ownerName: string;
  logo: string;
  address: string;
  phone: string;
}

function toFormState(retailer: Retailer): ProfileFormState {
  return {
    name: retailer.name,
    ownerName: retailer.ownerName ?? "",
    logo: retailer.logo ?? "",
    address: retailer.address ?? "",
    phone: retailer.phone ?? "",
  };
}

/**
 * Self-service "My Profile" page for a `retailer_users`-linked session — the real
 * counterpart to legacy `siamClient/src/components/retailerAdmin/retailerPages/
 * RetailerProfile/RetailerProfile.jsx`'s "Edit Retailer Profile Photo" form.
 *
 * Deliberately narrower than legacy's field list: legacy conflated "retailer" (the
 * business entity) with "login" (username/password/email) into one row, but this
 * rewrite separates them — `retailers` has no login credentials of its own, those
 * live on `users`. This page edits only real `retailers` columns (name, owner name,
 * logo, address, phone — the last two added alongside this page, closing a real,
 * previously-flagged schema gap). "Email"/"Country"/"Password" from legacy's form
 * have no equivalent field on `retailers` today and are out of scope here — a
 * self-service password change is a separate `users`-level concern, not built yet.
 *
 * `PATCH /retailers/:id` already allows a retailer-linked actor to edit its OWN
 * retailer (`retailers.routes.ts`'s `assertCanUpdateRetailer`, Workstream E Group 2)
 * without holding `retailers.manage` — this page is the first real UI consumer of
 * that self-edit allowance.
 */
export function RetailerProfilePage() {
  const { data: me } = useMeQuery();
  const retailerId = me?.retailerId ?? null;
  const {
    data: retailer,
    isLoading,
    isError,
    error,
  } = useGetRetailerQuery(retailerId ?? "", { skip: !retailerId });

  if (!me) return <LoadingSpinner />;

  if (!retailerId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">This account isn&apos;t linked to a retailer, so there&apos;s no retailer profile to edit here.</Alert>
      </Box>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError || !retailer) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{getApiErrorMessage(error, "Failed to load your retailer profile.")}</Alert>
      </Box>
    );
  }

  // Keyed by `retailer.id` — a fresh local copy per retailer identity, matching this
  // codebase's established "derive initial state from a fetched value" convention
  // (key/`useState(initialValue)` remount, not a `setState`-in-effect).
  return <ProfileForm key={retailer.id} retailer={retailer} retailerId={retailerId} />;
}

function ProfileForm({ retailer, retailerId }: { retailer: Retailer; retailerId: string }) {
  const [updateRetailer, updateState] = useUpdateRetailerMutation();
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(retailer));
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    setSaved(false);
    const body: RetailerInput = { name: form.name.trim(), code: retailer.code };
    const ownerName = form.ownerName.trim();
    if (ownerName) body.ownerName = ownerName;
    const logo = form.logo.trim();
    if (logo) body.logo = logo;
    const address = form.address.trim();
    if (address) body.address = address;
    const phone = form.phone.trim();
    if (phone) body.phone = phone;

    try {
      await updateRetailer({ id: retailerId, body }).unwrap();
      setSaved(true);
    } catch {
      // updateState.error below already surfaces the message
    }
  }

  const isFormValid = form.name.trim().length > 0;

  return (
    <Box sx={{ p: 4, maxWidth: 560 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        My Profile
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Retailer Name"
            required
            fullWidth
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            label="Owner Name"
            fullWidth
            value={form.ownerName}
            onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
          />
          <TextField
            label="Address"
            fullWidth
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          />
          <TextField
            label="Cell Phone"
            fullWidth
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <TextField
            label="Logo URL"
            fullWidth
            value={form.logo}
            onChange={(event) => setForm((current) => ({ ...current, logo: event.target.value }))}
          />
          {form.logo && (
            <Box component="img" src={form.logo} alt="Retailer logo preview" sx={{ height: 80, width: 80, objectFit: "contain" }} />
          )}
          {updateState.error && <Alert severity="error">{getApiErrorMessage(updateState.error, "Failed to save profile.")}</Alert>}
          {saved && !updateState.error && <Alert severity="success">Profile updated.</Alert>}
          <Box>
            <Button variant="contained" disabled={!isFormValid || updateState.isLoading} onClick={handleSubmit}>
              Save
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
