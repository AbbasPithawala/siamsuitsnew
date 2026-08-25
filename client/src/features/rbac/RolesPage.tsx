import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import { RolePermissionsEditor } from "./RolePermissionsEditor";
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetRoleQuery,
  useListRolesPaginatedQuery,
  useUpdateRoleMutation,
} from "./rolesApi";
import type { Role, RoleInput } from "./rolesApi";

const EMPTY_FORM: RoleInput = { name: "" };

function toBody(form: RoleInput): RoleInput {
  return { name: form.name.trim() };
}

interface RoleTableRowProps {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

/**
 * `GET /roles` (the list) doesn't return permission counts — only
 * `GET /roles/:id` nests a role's granted permissions (see
 * `rolesApi.ts`'s doc comment). So each row fetches its own detail via
 * `useGetRoleQuery`, which shares the exact same `{Role, id}` cache entry
 * `RolePermissionsEditor` reads/invalidates inside the edit dialog — a
 * grant/revoke there updates this row's count with no extra plumbing.
 */
function RoleTableRow({ role, onEdit, onDelete }: RoleTableRowProps) {
  const { data: detail } = useGetRoleQuery(role.id);
  return (
    <TableRow>
      <TableCell>
        {role.name}
        {role.isSystem && <Chip label="System" size="small" sx={{ ml: 1 }} />}
      </TableCell>
      <TableCell>{detail ? detail.permissions.length : "…"}</TableCell>
      <TableCell align="right">
        <IconButton aria-label={`Edit ${role.name}`} onClick={() => onEdit(role)}>
          <EditIcon fontSize="small" />
        </IconButton>
        <Tooltip title={role.isSystem ? "This tenant's system role can't be deleted." : ""}>
          <span>
            <IconButton aria-label={`Delete ${role.name}`} onClick={() => onDelete(role)} disabled={role.isSystem}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

/**
 * Roles RBAC admin — PHASE_5_TASKS.md Group 4. Unlike the Group 1-3 catalog
 * pages, this page is wrapped in `RequirePermission permission="rbac.roles.manage"`
 * at the route level (`AppRoutes.tsx`), even though `GET /roles[/:id]` itself
 * only requires `authenticate` (confirmed directly in `roles.routes.ts` —
 * reads are just as open as the catalog resources' at the API layer). The
 * page-level gate here is a deliberate frontend choice for this admin
 * surface (defense in depth on a screen that lists every tenant role and
 * its full permission grants), matching the existing `/retailers` precedent
 * rather than the catalog pages' button-level-only pattern — so no
 * `useHasPermission` checks are needed inside the page itself.
 */
export function RolesPage() {
  const pagination = usePagination();
  const { data: rolesResponse, isLoading, isError, error } = useListRolesPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const roles = rolesResponse?.data;

  const [createRole, createState] = useCreateRoleMutation();
  const [updateRole, updateState] = useUpdateRoleMutation();
  const [deleteRole, deleteState] = useDeleteRoleMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const mutationState = editingId ? updateState : createState;
  const { data: editingRoleDetail } = useGetRoleQuery(editingId ?? "", { skip: !editingId });

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(role: Role) {
    setEditingId(role.id);
    setForm({ name: role.name });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const body = toBody(form);
    try {
      if (editingId) {
        await updateRole({ id: editingId, body }).unwrap();
      } else {
        await createRole(body).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteRole(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // Unlike ProductsPage.tsx's identical-looking catch, this one has a real failure
      // mode (SYSTEM_ROLE_PROTECTED, PHASE_8_TASKS.md Group 3) — normally pre-empted by
      // the disabled Delete button on system roles, but surfaced here too as a fallback.
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Roles</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Role
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load roles.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary">No roles yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {roles?.map((role) => (
              <RoleTableRow key={role.id} role={role} onEdit={openEditDialog} onDelete={setDeleteTarget} />
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={rolesResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Role" : "Add Role"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save role.")}</Alert>
            )}

            {editingId && (
              <>
                <Divider />
                {editingRoleDetail ? (
                  <RolePermissionsEditor
                    roleId={editingId}
                    grantedPermissions={editingRoleDetail.permissions}
                    isSystem={editingRoleDetail.isSystem}
                  />
                ) : (
                  <Typography color="text.secondary">Loading permissions…</Typography>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.name.trim() || mutationState.isLoading}>
            {editingId ? "Save" : "Add Role"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        itemLabel={deleteTarget?.name ?? ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        isDeleting={deleteState.isLoading}
        errorMessage={deleteState.error ? getApiErrorMessage(deleteState.error, "Failed to delete role.") : null}
      />
    </Box>
  );
}
