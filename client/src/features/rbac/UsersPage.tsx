import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { ConfirmDeleteDialog } from "../catalog/ConfirmDeleteDialog";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { UserRolesEditor } from "./UserRolesEditor";
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUserQuery,
  useListUsersPaginatedQuery,
  useUpdateUserMutation,
} from "./usersApi";
import type { User, UserDetail } from "./usersApi";

const MIN_PASSWORD_LENGTH = 8;
const NO_RETAILER = "";

interface UserFormState {
  name: string;
  username: string;
  password: string;
  isActive: boolean;
  /**
   * Undefined = not yet known (edit dialog still loading `editingUserDetail`) — omitted from
   * the submit body so an admin who saves before it loads can never accidentally wipe an
   * existing link. `null` = explicitly no retailer. See `handleSubmit`/the sync effect below.
   */
  retailerId: string | null | undefined;
}

const EMPTY_FORM: UserFormState = { name: "", username: "", password: "", isActive: true, retailerId: null };

/**
 * Users RBAC admin — PHASE_5_TASKS.md Group 4. Same page-level
 * `RequirePermission permission="tenant.users.manage"` gate as
 * `RolesPage.tsx` (see its doc comment for why this diverges from the
 * Group 1-3 catalog pages' button-level-only pattern) — `GET /users[/:id]`
 * itself only requires `authenticate` per `users.routes.ts`.
 *
 * The password field only exists in the create form: `createUserSchema` in
 * `users.routes.ts` requires it (min 8 chars, hashed server-side), while
 * `updateUserSchema` accepts it as optional but this page deliberately
 * doesn't wire a "reset password" control (PHASE_5_TASKS.md calls that an
 * optional bonus, not required) — the edit dialog sends name/username/
 * isActive plus `retailerId` (PHASE_10_TASKS.md Workstream E Group 1/2 —
 * `retailerId` only, omitted entirely if the edit dialog's retailer field
 * hasn't finished loading its current value from the server yet, so a save
 * can never accidentally wipe an existing link — see `UserFormState`).
 */
export function UsersPage() {
  const pagination = usePagination();
  const { data: usersResponse, isLoading, isError, error } = useListUsersPaginatedQuery({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const users = usersResponse?.data;
  const { data: retailers } = useListRetailersQuery();

  const [createUser, createState] = useCreateUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();
  const [deleteUser, deleteState] = useDeleteUserMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const mutationState = editingId ? updateState : createState;
  const { data: editingUserDetail } = useGetUserQuery(editingId ?? "", { skip: !editingId });

  // Pre-fills the retailer picker from the server exactly once per edit-dialog session, rather
  // than on every `editingUserDetail` refetch, so an in-progress selection is never clobbered
  // by a background revalidation while the dialog is still open. Uses React's "adjust state
  // during render" pattern (comparing against the last-synced object reference, reset in
  // `openEditDialog`) instead of `useEffect`, per `react-hooks/set-state-in-effect` — an
  // `editingId`-keyed effect wouldn't re-fire when re-opening the dialog for the *same* user
  // within the same page session, since `editingId` itself doesn't change on re-open.
  const [lastSyncedUserDetail, setLastSyncedUserDetail] = useState<UserDetail | null>(null);
  if (editingId && editingUserDetail && editingUserDetail !== lastSyncedUserDetail) {
    setLastSyncedUserDetail(editingUserDetail);
    setForm((current) => ({ ...current, retailerId: editingUserDetail.retailerId }));
  }

  const isFormValid =
    form.name.trim().length > 0 &&
    form.username.trim().length > 0 &&
    (editingId !== null || form.password.length >= MIN_PASSWORD_LENGTH);

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(user: User) {
    setEditingId(user.id);
    setLastSyncedUserDetail(null);
    setForm({ name: user.name, username: user.username, password: "", isActive: user.isActive, retailerId: undefined });
    setDialogOpen(true);
  }

  function handleRetailerChange(event: SelectChangeEvent) {
    setForm((current) => ({ ...current, retailerId: event.target.value === NO_RETAILER ? null : event.target.value }));
  }

  async function handleSubmit() {
    try {
      if (editingId) {
        await updateUser({
          id: editingId,
          body: {
            name: form.name.trim(),
            username: form.username.trim(),
            isActive: form.isActive,
            ...(form.retailerId !== undefined ? { retailerId: form.retailerId } : {}),
          },
        }).unwrap();
      } else {
        await createUser({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password,
          retailerId: form.retailerId ?? null,
        }).unwrap();
      }
      setDialogOpen(false);
    } catch {
      // surfaced below via mutationState.error
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // Unlike ProductsPage.tsx's identical-looking catch, this one has a real failure
      // mode (LAST_SYSTEM_ROLE_HOLDER, PHASE_8_TASKS.md Group 3) — dialog stays open and
      // surfaces it via `deleteState.error` below, rather than being empty by design.
    }
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Users</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add User
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load users.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">No users yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={user.isActive ? "Active" : "Inactive"}
                    color={user.isActive ? "success" : "default"}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton aria-label={`Edit ${user.name}`} onClick={() => openEditDialog(user)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label={`Delete ${user.name}`} onClick={() => setDeleteTarget(user)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={usersResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit User" : "Add User"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <TextField
              label="Username"
              required
              fullWidth
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            />
            {editingId === null && (
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            )}
            {editingId !== null && (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                }
                label="Active"
              />
            )}
            {editingId !== null && form.retailerId === undefined ? (
              <Typography color="text.secondary">Loading retailer…</Typography>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="user-retailer-label">Retailer</InputLabel>
                <Select
                  labelId="user-retailer-label"
                  label="Retailer"
                  value={form.retailerId ?? NO_RETAILER}
                  onChange={handleRetailerChange}
                >
                  <MenuItem value={NO_RETAILER}>None / Staff</MenuItem>
                  {retailers?.map((retailer) => (
                    <MenuItem key={retailer.id} value={retailer.id}>
                      {retailer.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {mutationState.error && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save user.")}</Alert>
            )}

            {editingId && (
              <>
                <Divider />
                {editingUserDetail ? (
                  <UserRolesEditor userId={editingId} assignedRoles={editingUserDetail.roles} />
                ) : (
                  <Typography color="text.secondary">Loading roles…</Typography>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid || mutationState.isLoading}>
            {editingId ? "Save" : "Add User"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        itemLabel={deleteTarget?.name ?? ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        isDeleting={deleteState.isLoading}
        errorMessage={deleteState.error ? getApiErrorMessage(deleteState.error, "Failed to delete user.") : null}
      />
    </Box>
  );
}
