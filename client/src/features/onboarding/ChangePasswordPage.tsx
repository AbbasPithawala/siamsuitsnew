import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useMeQuery } from "../../api/baseApi";
import { useChangePasswordMutation } from "../auth/authApi";

const MIN_PASSWORD_LENGTH = 8;

/**
 * PHASE_11_TASKS.md Workstream G Group 0 — reached via `RequireProfileComplete`'s
 * `mustChangePassword` redirect (a freshly-provisioned owner logging in with their temp
 * password for the first time), but rendered as a sibling of that guard, not nested inside it
 * (see `AppRoutes.tsx`'s comment on this) — a page whose entire purpose is clearing the
 * condition can't itself be gated by that same condition.
 *
 * On success, explicitly awaits a `/me` refetch (`useChangePasswordMutation`'s
 * `invalidatesTags: ["Me"]` only marks the cache stale — the round trip itself is still async)
 * before navigating, so `RequireProfileComplete` sees the cleared flag immediately rather than
 * momentarily bouncing back here on a stale cached `me`.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [changePassword, changePasswordState] = useChangePasswordMutation();
  const { refetch: refetchMe } = useMeQuery();

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isValid =
    currentPassword.length > 0 && newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;
    setFormError(null);
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      await refetchMe();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Failed to change password."));
    }
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
      <Card sx={{ width: "100%", maxWidth: 410, p: { xs: 3, sm: 5 }, borderRadius: "30px" }}>
        <Typography variant="h4" align="center" gutterBottom>
          Change Your Password
        </Typography>
        <Typography color="text.secondary" align="center" sx={{ mb: 2 }}>
          You're signed in with a temporary password. Set a new one to continue.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Current password"
            type="password"
            fullWidth
            required
            autoFocus
            margin="normal"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            fullWidth
            required
            margin="normal"
            helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            label="Confirm new password"
            type="password"
            fullWidth
            required
            margin="normal"
            error={mismatch}
            helperText={mismatch ? "Passwords do not match." : undefined}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {formError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {formError}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            disabled={!isValid || changePasswordState.isLoading}
            sx={{ mt: 3 }}
          >
            {changePasswordState.isLoading ? "Changing…" : "Change Password"}
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
