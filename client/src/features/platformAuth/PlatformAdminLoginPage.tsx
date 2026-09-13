import { useState } from "react";
import type { FormEvent } from "react";
import { useDispatch } from "react-redux";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see LoginPage.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Key as KeyIcon, Login as LoginIcon, PersonOutline as PersonOutlineIcon } from "@mui/icons-material";
import type { AppDispatch } from "../../app/store";
import { getApiErrorMessage } from "../../api/errorUtils";
import { usePlatformAdminLoginMutation } from "./platformAdminAuthApi";
import { loginSucceeded } from "../auth/authSlice";

/**
 * Platform-admin counterpart to `tailorAuth/TailorLoginPage.tsx` — identical
 * layout, minus the tenant-slug input (platform admins aren't tenant
 * members), posting to `usePlatformAdminLoginMutation`
 * (`POST /api/platform/login`) but reusing the exact same
 * `authSlice`/`loginSucceeded` token storage: it's the same JWT mechanism
 * end to end, only the actor type differs.
 */
export function PlatformAdminLoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = usePlatformAdminLoginMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login({ username, password })
      .unwrap()
      .then(({ token }) => {
        dispatch(loginSucceeded(token));
      })
      .catch(() => {
        // surfaced below via the mutation's `error` field
      });
  };

  return (
    <Box
      component="section"
      className="login-section"
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
      <Card
        className="form-width-nav"
        sx={{ width: "100%", maxWidth: 410, p: { xs: 3, sm: 5 }, borderRadius: "30px" }}
      >
        <Typography variant="h4" align="center" gutterBottom>
          Platform Admin Login
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Username"
            fullWidth
            required
            autoFocus
            margin="normal"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <KeyIcon />
                </InputAdornment>
              ),
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {getApiErrorMessage(error, "Login failed. Please try again.")}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={<LoginIcon />}
            sx={{ mt: 3 }}
          >
            Login
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
