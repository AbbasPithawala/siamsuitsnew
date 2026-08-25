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
// Named imports from the `@mui/icons-material` barrel, not the usual
// `import X from "@mui/icons-material/X"` deep-import default. This
// project's Vite 8 (Rolldown) dep optimizer mis-transforms those deep CJS
// icon files' `export default` as the whole `{ __esModule, default }`
// wrapper instead of unwrapping it, so `<XIcon />` throws "Element type is
// invalid" at runtime (verified live via the dev server; type-checks fine,
// only fails at render). The barrel's named exports don't hit this bug.
import {
  Business as BusinessIcon,
  Key as KeyIcon,
  Login as LoginIcon,
  PersonOutline as PersonOutlineIcon,
} from "@mui/icons-material";
import type { AppDispatch } from "../../app/store";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useLoginMutation } from "./authApi";
import { loginSucceeded } from "./authSlice";

/**
 * Layout/markup adapted from the legacy `siamClient/src/components/login/Login.jsx`
 * + `login.css` (centered rounded card, icon-adorned fields, primary submit
 * button) per the "reuse, don't redesign" rule, rebuilt with MUI components
 * instead of the legacy's react-bootstrap `Container`/`Col` mix. A "Tenant"
 * field is new — the legacy app was single-tenant and had no equivalent.
 */
export function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const [tenant, setTenant] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login({ tenant, username, password })
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
          Login
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Tenant"
            fullWidth
            required
            margin="normal"
            value={tenant}
            onChange={(event) => setTenant(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BusinessIcon />
                </InputAdornment>
              ),
            }}
          />
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
