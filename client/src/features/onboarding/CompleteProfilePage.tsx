import { useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useMeQuery } from "../../api/baseApi";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { resolveUploadUrl, useUploadFileMutation } from "../uploads/uploadsApi";
import { useGetInvoiceSettingsQuery, useUpdateInvoiceSettingsMutation } from "../settings/invoiceSettingsApi";
import type { InvoiceSettings } from "../settings/invoiceSettingsApi";

/**
 * PHASE_11_TASKS.md Workstream G Group 0 — reached via `RequireProfileComplete`'s
 * `profileCompleted` redirect. Per Decision D3, this is a thin wrapper around the *existing*
 * `invoiceSettingsApi.ts` query/mutation (no new client API file) — the same `logo`/`address`/
 * `invoiceFooterText` fields `InvoiceSettingsPage.tsx` edits later, just framed here as
 * "finish setting up your business" onboarding copy rather than "invoice settings" copy, and
 * navigating into the app on save instead of showing an inline "Saved" message.
 */
export function CompleteProfilePage() {
  const { data: settings, isLoading, isError, error } = useGetInvoiceSettingsQuery();

  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: { xs: 2, sm: 4 },
        backgroundColor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 560, p: { xs: 3, sm: 4 }, mt: { xs: 2, sm: 6 } }}>
        <Typography variant="h5" gutterBottom>
          Finish Setting Up Your Business
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Tell us a bit about your business — this appears on your invoices and can be changed any
          time later from Invoice Settings.
        </Typography>
        {isLoading && <LoadingSpinner />}
        {isError && (
          <Alert severity="error">{getApiErrorMessage(error, "Failed to load your business profile.")}</Alert>
        )}
        {settings && <CompleteProfileForm key={settings.id} settings={settings} />}
      </Card>
    </Box>
  );
}

interface CompleteProfileFormProps {
  settings: InvoiceSettings;
}

/**
 * Keyed by `settings.id` in the parent (same pattern `InvoiceSettingsPage.tsx`'s own
 * `InvoiceSettingsForm` uses) so the initial field values come from `useState`'s initializer,
 * not a `useEffect` — the query resolves exactly once per mount here, so there's no ongoing
 * external state to synchronize via an effect in the first place.
 *
 * Requires at least one field before Save is enabled — the backend only flips
 * `profile_completed` when at least one of the three is present (D3's own no-op-safe rule), so
 * submitting nothing would silently fail to clear the redirect and leave the owner stuck here
 * with no visible reason why.
 */
function CompleteProfileForm({ settings }: CompleteProfileFormProps) {
  const navigate = useNavigate();
  const [updateSettings, updateState] = useUpdateInvoiceSettingsMutation();
  const [uploadFile, uploadState] = useUploadFileMutation();
  const { refetch: refetchMe } = useMeQuery();

  const [logo, setLogo] = useState(settings.logo ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [footerText, setFooterText] = useState(settings.invoiceFooterText ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file).unwrap();
      setLogo(result.url);
    } catch {
      // surfaced below via uploadState.error
    }
  }

  const canSubmit = logo.trim().length > 0 || address.trim().length > 0 || footerText.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await updateSettings({
        ...(logo.trim() ? { logo: logo.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(footerText.trim() ? { invoiceFooterText: footerText.trim() } : {}),
      }).unwrap();
      await refetchMe();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, "Failed to save your business profile."));
    }
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Logo
        </Typography>
        {logo && (
          <Box
            component="img"
            src={resolveUploadUrl(logo)}
            alt="Business logo"
            sx={{ height: 60, display: "block", mb: 1 }}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <Button component="label" variant="outlined" disabled={uploadState.isLoading}>
          {uploadState.isLoading ? "Uploading…" : "Upload logo"}
          <input type="file" accept="image/*" hidden onChange={handleLogoFileChange} />
        </Button>
        {uploadState.error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {getApiErrorMessage(uploadState.error, "Failed to upload logo.")}
          </Alert>
        )}
      </Box>

      <TextField
        label="Business address"
        multiline
        minRows={3}
        fullWidth
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />

      <TextField
        label="Invoice footer text"
        fullWidth
        placeholder="Thank You For Shopping With Us"
        value={footerText}
        onChange={(event) => setFooterText(event.target.value)}
      />

      {submitError && <Alert severity="error">{submitError}</Alert>}
      {!canSubmit && (
        <Typography variant="body2" color="text.secondary">
          Fill in at least one field to continue.
        </Typography>
      )}

      <Box>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || updateState.isLoading}>
          {updateState.isLoading ? "Saving…" : "Save and Continue"}
        </Button>
      </Box>
    </Stack>
  );
}
