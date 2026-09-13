import { useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see LoginPage.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Send as SendIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useCreateTenantRequestMutation } from "./requestAccessApi";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Public, unauthenticated signup page (PHASE_11_TASKS.md Workstream E) — a
 * top-level sibling to `/login`/`/tailor/login`, reachable with or without a
 * stored token, with no route guard at all. Field list and required-ness
 * mirror `createTenantRequestSchema` in `tenantRequests.routes.ts` exactly:
 * business name/contact name/contact email/contact phone/desired slug are
 * all required, and "approx. retail locations/order volume" +
 * "how did you hear about us" are folded into the one optional free-text
 * `notes` field per the locked field list, rather than inventing extra
 * structured columns the backend doesn't have.
 */
export function RequestAccessPage() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedSlug, setRequestedSlug] = useState("");
  const [notes, setNotes] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitTenantRequest, { isLoading, error, isSuccess }] = useCreateTenantRequestMutation();

  const slugValid = requestedSlug.length > 0 && SLUG_PATTERN.test(requestedSlug);
  const slugError = slugTouched && requestedSlug.length > 0 && !slugValid;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSlugTouched(true);
    if (!slugValid) {
      return;
    }
    const trimmedNotes = notes.trim();
    submitTenantRequest({
      businessName,
      contactName,
      email,
      phone,
      requestedSlug,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    })
      .unwrap()
      .catch(() => {
        // surfaced below via the mutation's `error` field
      });
  };

  if (isSuccess) {
    return (
      <Box
        component="section"
        sx={{
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: 2,
          backgroundColor: "background.default",
        }}
      >
        <Card sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 5 }, borderRadius: "30px" }}>
          <Typography variant="h5" align="center" gutterBottom>
            Request received
          </Typography>
          <Typography variant="body1" align="center">
            Thanks — your request has been received. We&apos;ll be in touch shortly to set up your account.
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      sx={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        p: 2,
        backgroundColor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 5 }, borderRadius: "30px" }}>
        <Typography variant="h4" align="center" gutterBottom>
          Request Access
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
          Tell us about your business and we&apos;ll set up your Siam Suits account.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Business name"
            fullWidth
            required
            autoFocus
            margin="normal"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
          <TextField
            label="Contact name"
            fullWidth
            required
            margin="normal"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
          <TextField
            label="Contact email"
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Contact phone"
            fullWidth
            required
            margin="normal"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <TextField
            label="Desired slug"
            fullWidth
            required
            margin="normal"
            value={requestedSlug}
            onChange={(event) => setRequestedSlug(event.target.value)}
            onBlur={() => setSlugTouched(true)}
            error={slugError}
            helperText={
              slugError
                ? "Lowercase letters, numbers, and hyphens only (e.g. acme-tailors)."
                : "This will be part of your account's web address (e.g. acme-tailors)."
            }
          />
          <TextField
            label="Notes"
            fullWidth
            multiline
            minRows={3}
            margin="normal"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional — e.g. approximate number of retail locations/order volume, how you heard about us"
            helperText="Optional"
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {getApiErrorMessage(error, "Could not submit your request. Please try again.")}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={<SendIcon />}
            sx={{ mt: 3 }}
          >
            Submit request
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
