import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
// Named barrel import — see AppShell.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Logout as LogoutIcon } from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import type { AppDispatch, RootState } from "../../app/store";
import { logout } from "../../features/auth/authSlice";
import "../../styles/legacyAdmin/sidebar.css";

const DRAWER_WIDTH = 235; // same width as shell/AppShell.tsx's legacy sidebar.css `.sidebar`

const PLATFORM_NAV_ENTRIES = [
  { label: "Tenant Requests", path: "/platform/tenant-requests" },
  { label: "Tenants", path: "/platform/tenants" },
];

/**
 * Platform-admin counterpart to `shell/AppShell.tsx`'s sidebar. Originally a flat top tab
 * bar mirroring `tailorShell/TailorPortalShell.tsx` (PHASE_11_TASKS.md Workstream F Group 0);
 * rebuilt into the same Drawer-based sidebar the staff/retailer app already uses so a
 * platform admin's screen reads as the same kind of admin surface real users already know,
 * not a bespoke layout — a deliberate, requested visual change, not a redesign.
 *
 * No accordion grouping (unlike `AppShell.tsx`'s `navConfig.ts`): there are only two nav
 * entries and no RBAC permissions to filter them by (platform admins have no permission
 * system at all — same reasoning the original top-bar's own doc comment gave), so a flat
 * `<ul>` inside the same `#leftside-navigation`/`sidebar.css` scaffolding `AppShell` uses
 * gets the identical visual result with none of the grouping machinery.
 */
export function PlatformAdminShell() {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });
  const location = useLocation();

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            Siam Suits — Platform Admin
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
      </AppBar>
      <Drawer
        variant="permanent"
        className="sidebar"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box", overflowY: "auto" },
        }}
      >
        <Toolbar />
        <Box component="nav" aria-label="Main navigation">
          <div id="leftside-navigation" className="nano">
            <ul>
              {PLATFORM_NAV_ENTRIES.map((entry) => (
                <li key={entry.path} className={location.pathname.startsWith(entry.path) ? "active" : undefined}>
                  {/*
                   * Deliberately no `activeList`/`notActive` className here (unlike
                   * `AppShell.tsx`'s equivalent NavLink): that pair is styled for
                   * `sidebar.css`'s *nested* `ul ul li a` leaf items, which sit on a plain
                   * background. This flat list has no nesting — its items ARE the
                   * top-level `li.active > a` rule (white text, blue background). Applying
                   * `.activeList`'s `color: #1c4d8f !important` on top of that same blue
                   * background made the active item's text invisible (dark-blue-on-blue) —
                   * a real bug found live, not a hypothetical. The bare `li.active` class
                   * above already fully drives the correct active styling with nothing left
                   * to collide with.
                   */}
                  <NavLink to={entry.path}>{entry.label}</NavLink>
                </li>
              ))}
            </ul>
          </div>
        </Box>
      </Drawer>
      <Box component="main" className="app-scroll-area" sx={{ flexGrow: 1, minWidth: 0, height: "100%", overflowY: "auto", p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
