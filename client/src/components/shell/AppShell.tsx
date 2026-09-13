import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { styled } from "@mui/material/styles";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
// Named barrel import — see LoginPage.tsx's comment: this project's Vite dep
// optimizer mis-transforms `@mui/icons-material/X` deep imports at runtime.
import {
  ArrowForwardIosSharp as ExpandArrowIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import type { AppDispatch, RootState } from "../../app/store";
import { logout } from "../../features/auth/authSlice";
import { resolveUploadUrl } from "../../features/uploads/uploadsApi";
import { navGroups } from "./navConfig";
import "../../styles/legacyAdmin/sidebar.css";

const DRAWER_WIDTH = 235; // legacy sidebar.css `.sidebar` width
const SIDEBAR_OPEN_STORAGE_KEY = "siam.sidebarOpen";

/**
 * Same `styled(Accordion)`/`styled(AccordionSummary)` wrapper legacy's
 * `Sidebar.jsx` uses (disableGutters/elevation=0/square, `ArrowForwardIosSharpIcon`
 * as the expand affordance) — the visual accordion shape comes from `sidebar.css`'s
 * `.Accrodian-main`/`.sidebarmenu`/`.Mui-expanded` rules (copied verbatim into
 * `styles/legacyAdmin/sidebar.css`, diff-able against the legacy source), not
 * reinvented here.
 */
const StyledAccordion = styled((props: React.ComponentProps<typeof Accordion>) => (
  <Accordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": { borderBottom: 0 },
  "&:before": { display: "none" },
}));

const StyledAccordionDetails = styled(AccordionDetails)(({ theme }) => ({
  padding: theme.spacing(0.5),
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

/**
 * The one shell for every authenticated route, replacing the legacy's
 * separate staff (`Header`/`Sidebar`) and retailer (`RetailerHeader`/
 * `RetailerSidebar`) pairs — see PHASE_4_TASKS.md Group 6. Sits between
 * `RequireAuth` and the page routes in `AppRoutes.tsx`, so it only ever
 * mounts once a session is confirmed valid; `useMeQuery` here is a cache
 * hit off the same request `RequireAuth` already made.
 *
 * Sidebar rebuilt in PHASE_8_TASKS.md (the sidebar-grouping task) to match
 * legacy `Sidebar.jsx`'s accordion-grouped structure — `sidebar.css` copied
 * byte-for-byte from the legacy source rather than approximated in MUI's
 * theme, same verbatim-reuse approach as `ProductsPage.tsx`. Legacy's
 * `.Mui-expanded ... .css-<hash>-MuiSvgIcon-root` rule (meant to turn the
 * category icon/expand-arrow white against the dark-blue expanded header)
 * can't survive the copy — that hash is a CRA/emotion build artifact specific
 * to the legacy bundle, not a stable selector — so the same *visual* result
 * is reproduced here via an `sx` color keyed off `expanded`, not pure CSS.
 * Section icons are MUI equivalents of legacy's FontAwesome glyphs (see
 * `navConfig.ts`'s doc comment) — this client has no FontAwesome dependency.
 */
export function AppShell() {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });
  const location = useLocation();

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          entries: group.entries.filter((entry) => {
            if (entry.permission && !me?.permissions.includes(entry.permission)) return false;
            if (entry.requiresRetailerLink && !me?.retailerId) return false;
            return true;
          }),
        }))
        .filter((group) => group.entries.length > 0),
    [me]
  );

  const initialExpanded = useMemo(
    () =>
      visibleGroups.find((group) =>
        group.entries.some((entry) => location.pathname.startsWith(entry.path))
      )?.key ?? false,
    // Only ever used as the initial value below — re-deriving on every navigation would
    // fight the user if they deliberately collapse/switch panels mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [expanded, setExpanded] = useState<string | false>(initialExpanded);

  // Persisted so the collapsed/expanded choice survives a page reload, not just
  // in-session navigation (this shell mounts once per session either way).
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY) !== "false"
  );
  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  // `height: "100vh"` + `overflow: "hidden"` below matter, not just cosmetic: with the
  // previous `minHeight: "100vh"`, this flex container was free to grow taller than the
  // viewport on any page with enough content, and since the Drawer is a normal (non-fixed)
  // flex sibling in `variant="permanent"` mode, it grew and scrolled right along with the
  // whole document — the reported "sidebar scrolls away with the page" bug, reproducible on
  // every page, not page-specific. Pinning the outer container to exactly the viewport height
  // and clipping its own overflow means only `<main>` (its own `overflowY: auto` below) and
  // the Drawer's own `MuiDrawer-paper` (already `overflowY: auto`) scroll independently — the
  // header and sidebar frame stay put. A real, visible layout bug, invisible to jsdom-based
  // tests (they don't compute layout), only caught by an actual live-browser check.
  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              color="inherit"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <MenuIcon />
            </IconButton>
            {me?.logo ? (
              <Box
                component="img"
                src={resolveUploadUrl(me.logo)}
                alt="Logo"
                sx={{ height: 40, maxWidth: 200, objectFit: "contain" }}
              />
            ) : (
              <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
                Siam Suits
              </Typography>
            )}
          </Box>
          {me && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2">
                {me.name} ({me.username})
              </Typography>
              <IconButton aria-label="logout" color="inherit" onClick={() => dispatch(logout())}>
                <LogoutIcon />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      {sidebarOpen && (
        <Drawer
          variant="permanent"
          className="sidebar"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              overflowY: "auto",
            },
          }}
        >
          <Toolbar />
          {/* Legacy's `.nano` relied on the nanoScroller.js plugin (not ported — a real,
            visible bug caught only by an actual live-browser check, not the tests) for a
            custom-styled scrollbar on overflowing nav content; a native scrolling
            `MuiDrawer-paper` (set above) achieves the same functional outcome without it. */}
          <Box component="nav" aria-label="Main navigation">
            <div id="leftside-navigation" className="nano">
              {visibleGroups.map((group) => {
                const isExpanded = expanded === group.key;
                const GroupIcon = group.icon;
                return (
                  <StyledAccordion
                    key={group.key}
                    expanded={isExpanded}
                    onChange={(_event, next) => setExpanded(next ? group.key : false)}
                    className="Accrodian-main"
                  >
                    <AccordionSummary
                      className="sidebarmenu"
                      aria-controls={`${group.key}-content`}
                      id={`${group.key}-header`}
                      expandIcon={
                        <ExpandArrowIcon
                          sx={{ fontSize: "0.8rem", color: isExpanded ? "#fff" : "#242424" }}
                        />
                      }
                    >
                      <GroupIcon
                        sx={{ fontSize: 14, color: isExpanded ? "#fff" : "#242424", mr: 1 }}
                      />
                      <span>{group.label}</span>
                    </AccordionSummary>
                    <StyledAccordionDetails>
                      <ul>
                        {group.entries.map((entry) => (
                          <li key={entry.path}>
                            <NavLink
                              to={entry.path}
                              className={({ isActive }) => (isActive ? "activeList" : "notActive")}
                            >
                              {entry.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </StyledAccordionDetails>
                  </StyledAccordion>
                );
              })}
            </div>
          </Box>
        </Drawer>
      )}
      {/* `minWidth: 0` overrides a flex item's default `min-width: auto`, which otherwise
          refuses to shrink below its content's natural width — without it, any page with a
          wide table (e.g. Extra Payment Categories) blows out the whole page's horizontal
          scroll instead of letting that one table scroll internally via its own
          `overflow-x`. A page-layout-level fix, not per-page, since every page under this
          shell shares the same flex parent. */}
      <Box
        component="main"
        className="app-scroll-area"
        sx={{ flexGrow: 1, minWidth: 0, height: "100%", overflowY: "auto", p: 3 }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
