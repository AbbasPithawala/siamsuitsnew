import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
// Named barrel import — see AppShell.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Logout as LogoutIcon } from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import type { AppDispatch, RootState } from "../../app/store";
import { logout } from "../../features/auth/authSlice";

const TAILOR_NAV_ENTRIES = [
  { label: "My Jobs", path: "/tailor/jobs" },
  { label: "My Payment History", path: "/tailor/payment-history" },
  { label: "My Extra Payments", path: "/tailor/extra-payments" },
];

/**
 * The tailor-portal counterpart to `AppShell.tsx` — deliberately a separate, much smaller
 * shell rather than reusing `AppShell`/`navConfig.ts` (see `TailorJobsPage.tsx`'s doc
 * comment and the plan behind this feature): `navConfig.ts` has unconditional entries with
 * no `permission` gate at all (e.g. "Customers") that would incorrectly render for a
 * tailor session if `AppShell` were reused as-is, and tailors have no RBAC permissions to
 * filter by in the first place. A flat 3-tab bar, not an accordion — there's nothing to
 * group.
 */
export function TailorPortalShell() {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });
  const location = useLocation();

  const activeTab = TAILOR_NAV_ENTRIES.find((entry) => location.pathname.startsWith(entry.path))?.path ?? false;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppBar position="static">
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            Siam Suits — Tailor Portal
          </Typography>
          {me && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2">{me.name}</Typography>
              <IconButton aria-label="logout" color="inherit" onClick={() => dispatch(logout())}>
                <LogoutIcon />
              </IconButton>
            </Box>
          )}
        </Toolbar>
        <Tabs value={activeTab} textColor="inherit" indicatorColor="secondary">
          {TAILOR_NAV_ENTRIES.map((entry) => (
            <Tab key={entry.path} label={entry.label} value={entry.path} component={NavLink} to={entry.path} />
          ))}
        </Tabs>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, overflowY: "auto" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
