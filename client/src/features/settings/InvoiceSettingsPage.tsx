import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { resolveUploadUrl, useUploadFileMutation } from "../uploads/uploadsApi";
import { useGetInvoiceSettingsQuery, useUpdateInvoiceSettingsMutation } from "./invoiceSettingsApi";
import type { InvoiceSettings } from "./invoiceSettingsApi";

/**
 * The tenant's invoice letterhead — legacy hardcoded its company logo/address/footer text
 * directly into every PDF template (`CreateInvoice.jsx`/`InvoiceHistory.jsx`'s duplicated
 * inline JSX), which only worked because legacy served exactly one company. This rewrite is
 * multi-tenant, so it's real settings data (`tenants.logo`/`.address`/`.invoice_footer_text`)
 * with a real form, read by `server/src/services/invoicePdf.service.ts` for both the
 * single-order and grouped-retailer-invoice PDFs.
 *
 * Gated by `invoices.view`/`invoices.manage` (`AppRoutes.tsx`) — same split as `InvoicesPage.tsx`:
 * this page is reachable by anyone who can view invoices, but only saveable by whoever can
 * manage them.
 */
export function InvoiceSettingsPage() {
  const { data: settings, isLoading, isError, error } = useGetInvoiceSettingsQuery();

  return (
    <Box sx={{ p: 4, maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Invoice Settings
      </Typography>
      {isLoading && <LoadingSpinner />}
      {isError && <Alert severity="error">{getApiErrorMessage(error, "Failed to load invoice settings.")}</Alert>}
      {settings && <InvoiceSettingsForm key={settings.id} settings={settings} />}
    </Box>
  );
}

interface InvoiceSettingsFormProps {
  settings: InvoiceSettings;
}

function InvoiceSettingsForm({ settings }: InvoiceSettingsFormProps) {
  const canManage = useHasPermission("invoices.manage");
  const [updateSettings, updateState] = useUpdateInvoiceSettingsMutation();
  const [uploadFile, uploadState] = useUploadFileMutation();

  const [logo, setLogo] = useState(settings.logo ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [footerText, setFooterText] = useState(settings.invoiceFooterText ?? "");
  const [saved, setSaved] = useState(false);

  async function handleLogoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file).unwrap();
      setLogo(result.url);
    } catch {
      // surfaced below via uploadState.error
    }
  }

  async function handleSave() {
    setSaved(false);
    try {
      await updateSettings({
        logo,
        address,
        invoiceFooterText: footerText,
      }).unwrap();
      setSaved(true);
    } catch {
      // surfaced below via updateState.error
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Logo
          </Typography>
          {logo && (
            <Box
              component="img"
              src={resolveUploadUrl(logo)}
              alt="Invoice logo"
              sx={{ height: 60, display: "block", mb: 1 }}
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          {canManage && (
            <Button component="label" variant="outlined" disabled={uploadState.isLoading}>
              {uploadState.isLoading ? "Uploading…" : "Upload logo"}
              <input type="file" accept="image/*" hidden onChange={handleLogoFileChange} />
            </Button>
          )}
          {uploadState.error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {getApiErrorMessage(uploadState.error, "Failed to upload logo.")}
            </Alert>
          )}
        </Box>

        <TextField
          label="Company address"
          multiline
          minRows={3}
          fullWidth
          disabled={!canManage}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />

        <TextField
          label="Invoice footer text"
          fullWidth
          disabled={!canManage}
          placeholder="Thank You For Shopping With Us"
          value={footerText}
          onChange={(event) => setFooterText(event.target.value)}
        />

        {updateState.error && <Alert severity="error">{getApiErrorMessage(updateState.error, "Failed to save invoice settings.")}</Alert>}
        {saved && <Alert severity="success">Saved.</Alert>}

        {canManage && (
          <Box>
            <Button variant="contained" onClick={handleSave} disabled={updateState.isLoading}>
              {updateState.isLoading ? "Saving…" : "Save"}
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
