import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Placeholder proving `RequireAuth` (via the `AppShell` layout route it now
 * renders inside of) reaches a real page with no specific permission
 * required. Phase 5 replaces this with the actual dashboard. User identity
 * and logout now live in `AppShell`'s header, not here.
 */
export function DashboardPage() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5">Dashboard</Typography>
    </Box>
  );
}
