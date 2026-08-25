import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { useMeQuery } from "../api/baseApi";
import type { RootState } from "../app/store";

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
}

/**
 * Must be nested inside `RequireAuth` — it assumes `me` has already
 * resolved and only decides permission, not authentication. Renders an
 * inline "not authorized" message rather than redirecting: the user IS
 * authenticated, so bouncing them to `/login` would be wrong, and there's
 * no single obviously-correct fallback route to send them to instead.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const token = useSelector((state: RootState) => state.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });

  if (!me?.permissions.includes(permission)) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">You do not have permission to view this page.</Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
