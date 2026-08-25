import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useAssignUserRoleMutation, useUnassignUserRoleMutation } from "./usersApi";
import type { RoleRef } from "./usersApi";
import { useListRolesQuery } from "./rolesApi";

interface UserRolesEditorProps {
  userId: string;
  assignedRoles: RoleRef[];
}

/**
 * `UsersPage.tsx`'s edit-dialog counterpart to `RolePermissionsEditor.tsx` —
 * a checkbox per real tenant role (from `GET /api/roles`), reflecting this
 * user's current assignments, each toggle its own committed request against
 * `/users/:userId/roles[/:roleId]`. Same "no bulk reconcile, no local draft"
 * reasoning as that component.
 */
export function UserRolesEditor({ userId, assignedRoles }: UserRolesEditorProps) {
  const { data: allRoles, isLoading } = useListRolesQuery();
  const [assignRole] = useAssignUserRoleMutation();
  const [unassignRole] = useUnassignUserRoleMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const assignedIds = new Set(assignedRoles.map((role) => role.id));

  async function handleToggle(roleId: string, roleName: string, checked: boolean) {
    setActionError(null);
    try {
      if (checked) {
        await assignRole({ userId, roleId }).unwrap();
      } else {
        await unassignRole({ userId, roleId }).unwrap();
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err, `Failed to ${checked ? "assign" : "unassign"} role "${roleName}".`));
    }
  }

  if (isLoading) {
    return <Typography color="text.secondary">Loading roles…</Typography>;
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Roles ({assignedRoles.length})
      </Typography>
      {allRoles?.length === 0 ? (
        <Typography color="text.secondary">No roles exist yet.</Typography>
      ) : (
        <FormGroup>
          {allRoles?.map((role) => (
            <FormControlLabel
              key={role.id}
              control={
                <Checkbox
                  checked={assignedIds.has(role.id)}
                  onChange={(event) => handleToggle(role.id, role.name, event.target.checked)}
                />
              }
              label={role.name}
            />
          ))}
        </FormGroup>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {actionError}
        </Alert>
      )}
    </Box>
  );
}
