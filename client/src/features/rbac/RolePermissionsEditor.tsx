import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useAddRolePermissionMutation, useRemoveRolePermissionMutation } from "./rolesApi";
import type { PermissionRecord } from "./rolesApi";
import { useListPermissionsQuery } from "./permissionsApi";

/** Same module order as `server/src/db/seed/permissions.ts`'s catalog, and PHASE_5_TASKS.md Group 4's literal grouping list. */
const MODULE_ORDER = ["Catalog", "Tenant", "Access Control", "Retailers", "Orders", "Factory", "Invoicing", "Shipping"];

function groupByModule(catalog: PermissionRecord[]): Map<string, PermissionRecord[]> {
  const grouped = new Map<string, PermissionRecord[]>();
  for (const permission of catalog) {
    const bucket = grouped.get(permission.module);
    if (bucket) bucket.push(permission);
    else grouped.set(permission.module, [permission]);
  }
  return grouped;
}

interface RolePermissionsEditorProps {
  roleId: string;
  grantedPermissions: PermissionRecord[];
  /** The tenant's protected system role — its granted permissions can't be revoked (server rejects it, PHASE_8_TASKS.md Group 3). */
  isSystem?: boolean;
}

/**
 * The core of `RolesPage.tsx`'s edit dialog — PHASE_5_TASKS.md Group 4's
 * central acceptance surface. Renders the full 28-key catalog from
 * `GET /api/permissions`, grouped by module, as checkboxes reflecting this
 * role's current grants. Each toggle is its own already-committed
 * add/remove request against `/roles/:roleId/permissions[/:permissionId]`
 * (same "no bulk reconcile endpoint" reasoning as `FeatureStylesEditor.tsx`
 * and `SuperProductsPage.tsx`'s edit-mode component management) — there is
 * no local draft state to "save".
 */
export function RolePermissionsEditor({ roleId, grantedPermissions, isSystem = false }: RolePermissionsEditorProps) {
  const { data: catalog, isLoading } = useListPermissionsQuery();
  const [addPermission] = useAddRolePermissionMutation();
  const [removePermission] = useRemoveRolePermissionMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const grantedIds = new Set(grantedPermissions.map((permission) => permission.id));
  const grouped = groupByModule(catalog ?? []);

  async function handleToggle(permission: PermissionRecord, checked: boolean) {
    setActionError(null);
    try {
      if (checked) {
        await addPermission({ roleId, permissionId: permission.id }).unwrap();
      } else {
        await removePermission({ roleId, permissionId: permission.id }).unwrap();
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err, `Failed to ${checked ? "grant" : "revoke"} permission "${permission.key}".`));
    }
  }

  if (isLoading) {
    return <Typography color="text.secondary">Loading permissions…</Typography>;
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Permissions ({grantedPermissions.length})
      </Typography>
      <Stack spacing={1.5}>
        {MODULE_ORDER.filter((module) => (grouped.get(module) ?? []).length > 0).map((module) => (
          <Box key={module}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              {module}
            </Typography>
            <FormGroup>
              {(grouped.get(module) ?? []).map((permission) => {
                const granted = grantedIds.has(permission.id);
                const locked = isSystem && granted;
                return (
                  <Tooltip key={permission.id} title={locked ? "This tenant's system role can't have permissions revoked." : ""}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={granted}
                          disabled={locked}
                          onChange={(event) => handleToggle(permission, event.target.checked)}
                        />
                      }
                      label={`${permission.key} — ${permission.description}`}
                    />
                  </Tooltip>
                );
              })}
            </FormGroup>
          </Box>
        ))}
      </Stack>
      {actionError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {actionError}
        </Alert>
      )}
    </Box>
  );
}
