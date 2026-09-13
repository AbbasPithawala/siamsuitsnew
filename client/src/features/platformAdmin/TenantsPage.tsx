import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
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
// Named barrel import — see AppShell.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Edit as EditIcon } from "@mui/icons-material";
import { getApiErrorCode, getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import {
  useCreateTenantMutation,
  useListPlatformTenantsQuery,
  useSetTenantActiveMutation,
  useUpdateTenantMutation,
} from "./platformTenantsApi";
import type { CreateTenantResult, PlatformTenant } from "./platformTenantsApi";

const EMPTY_FORM = {
  businessName: "",
  slug: "",
  ownerName: "",
  ownerEmail: "",
  plan: "",
  logo: "",
  address: "",
  invoiceFooterText: "",
};

/** The `TENANT_SLUG_TAKEN` code both create/edit endpoints share — surfaced against the Slug
 * field specifically rather than just a generic dialog-level alert, the same "attribute a
 * known error code to the field it's actually about" approach the manufacturing screens use
 * for their own per-code copy (`manufacturingErrors.ts`). */
function isSlugTakenError(error: unknown): boolean {
  return getApiErrorCode(error) === "TENANT_SLUG_TAKEN";
}

/**
 * PHASE_11_TASKS.md Workstream F Group 2 — every provisioned tenant, cross-tenant, superadmin
 * view. The active/inactive switch is the platform-level lockout control (C Group 2's backend
 * decision): flipping it off 401s every subsequent login attempt for that tenant's users.
 * Extended here with direct tenant creation (bypassing the request-access queue entirely —
 * `TenantRequestsPage.tsx`'s approve flow is the other route to the same `provisionTenant()`
 * outcome) and an edit dialog for the business-profile fields.
 *
 * One dialog, one form-state shape, and `editingId ? update : create` — the same
 * single-dialog-two-modes convention `ProductsPage.tsx`/`MeasurementDefinitionsPage.tsx`
 * already use, rather than two separate dialog components with their own duplicated form
 * state. `ownerName`/`ownerEmail` only apply (and only render) in create mode, since editing
 * an existing tenant has no "owner" concept on this endpoint.
 */
export function TenantsPage() {
  const pagination = usePagination();
  const {
    data: tenantsResponse,
    isLoading,
    isError,
    error,
  } = useListPlatformTenantsQuery({ page: pagination.page, pageSize: pagination.pageSize });
  const tenants = tenantsResponse?.data;

  const [setTenantActive, setActiveState] = useSetTenantActiveMutation();
  const [createTenant, createState] = useCreateTenantMutation();
  const [updateTenant, updateState] = useUpdateTenantMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createResult, setCreateResult] = useState<CreateTenantResult | null>(null);

  const mutationState = editingId ? updateState : createState;

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(tenant: PlatformTenant) {
    setEditingId(tenant.id);
    setForm({
      businessName: tenant.name,
      slug: tenant.slug,
      ownerName: "",
      ownerEmail: "",
      plan: tenant.plan,
      logo: tenant.logo ?? "",
      address: tenant.address ?? "",
      invoiceFooterText: tenant.invoiceFooterText ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      if (editingId) {
        await updateTenant({
          id: editingId,
          body: {
            name: form.businessName.trim(),
            slug: form.slug.trim(),
            ...(form.plan.trim() ? { plan: form.plan.trim() } : {}),
            // Empty string, not omitted — see `UpdateTenantInput`'s doc comment (`platformTenantsApi.ts`)
            // on why this, not `null`/omission, is the correct "clear this field" signal here.
            logo: form.logo.trim(),
            address: form.address.trim(),
            invoiceFooterText: form.invoiceFooterText.trim(),
          },
        }).unwrap();
        setDialogOpen(false);
      } else {
        const result = await createTenant({
          businessName: form.businessName.trim(),
          slug: form.slug.trim(),
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
          ...(form.plan.trim() ? { plan: form.plan.trim() } : {}),
          ...(form.logo.trim() ? { logo: form.logo.trim() } : {}),
          ...(form.address.trim() ? { address: form.address.trim() } : {}),
          ...(form.invoiceFooterText.trim() ? { invoiceFooterText: form.invoiceFooterText.trim() } : {}),
        }).unwrap();
        setDialogOpen(false);
        setCreateResult(result);
      }
    } catch {
      // surfaced below via mutationState.error
    }
  }

  const requiredFilled = editingId
    ? form.businessName.trim() && form.slug.trim()
    : form.businessName.trim() && form.slug.trim() && form.ownerName.trim() && form.ownerEmail.trim();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Tenants
          </Typography>
          <Typography color="text.secondary">
            Every tenant provisioned on this platform. Deactivating a tenant immediately blocks login
            for all of its users.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Tenant
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load tenants.")}
        </Alert>
      )}
      {setActiveState.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(setActiveState.error, "Failed to update tenant status.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Profile</TableCell>
              <TableCell align="right">Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">No tenants yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {tenants?.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                onToggleActive={setTenantActive}
                isSaving={setActiveState.isLoading}
                onEdit={() => openEditDialog(tenant)}
              />
            ))}
          </TableBody>
        </Table>
        <PaginationControls total={tenantsResponse?.pagination.total ?? 0} {...pagination} />
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit Tenant" : "Add Tenant"}</DialogTitle>
        <DialogContent>
          {!editingId && (
            <DialogContentText sx={{ mb: 2 }}>
              Business name, slug, and owner contact are required. The rest is optional — leave
              blank to let the new owner complete their own business profile on first login.
            </DialogContentText>
          )}
          <Stack spacing={2} sx={{ mt: editingId ? 1 : 0 }}>
            <TextField
              label="Business name"
              required
              fullWidth
              value={form.businessName}
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
            />
            <TextField
              label="Slug"
              required
              fullWidth
              error={isSlugTakenError(mutationState.error)}
              helperText={isSlugTakenError(mutationState.error) ? "That slug is already taken by another tenant." : undefined}
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            />
            {!editingId && (
              <>
                <TextField
                  label="Owner name"
                  required
                  fullWidth
                  value={form.ownerName}
                  onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                />
                <TextField
                  label="Owner email"
                  required
                  type="email"
                  fullWidth
                  value={form.ownerEmail}
                  onChange={(event) => setForm((current) => ({ ...current, ownerEmail: event.target.value }))}
                />
              </>
            )}
            <TextField
              label="Plan"
              fullWidth
              value={form.plan}
              onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
            />
            <TextField
              label="Logo URL"
              fullWidth
              value={form.logo}
              onChange={(event) => setForm((current) => ({ ...current, logo: event.target.value }))}
            />
            <TextField
              label="Business address"
              fullWidth
              multiline
              minRows={2}
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
            <TextField
              label="Invoice footer text"
              fullWidth
              value={form.invoiceFooterText}
              onChange={(event) => setForm((current) => ({ ...current, invoiceFooterText: event.target.value }))}
            />
            {mutationState.error && !isSlugTakenError(mutationState.error) && (
              <Alert severity="error">{getApiErrorMessage(mutationState.error, "Failed to save tenant.")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!requiredFilled || mutationState.isLoading}>
            {mutationState.isLoading ? "Saving…" : editingId ? "Save" : "Add Tenant"}
          </Button>
        </DialogActions>
      </Dialog>

      <TenantCreatedResultDialog result={createResult} onClose={() => setCreateResult(null)} />
    </Box>
  );
}

interface TenantRowProps {
  tenant: PlatformTenant;
  onToggleActive: ReturnType<typeof useSetTenantActiveMutation>[0];
  isSaving: boolean;
  onEdit: () => void;
}

function TenantRow({ tenant, onToggleActive, isSaving, onEdit }: TenantRowProps) {
  return (
    <TableRow>
      <TableCell>{tenant.name}</TableCell>
      <TableCell>{tenant.slug}</TableCell>
      <TableCell>{tenant.plan}</TableCell>
      <TableCell>
        <Chip
          size="small"
          label={tenant.profileCompleted ? "Complete" : "Pending onboarding"}
          color={tenant.profileCompleted ? "success" : "default"}
        />
      </TableCell>
      <TableCell align="right">
        <Switch
          checked={tenant.isActive}
          disabled={isSaving}
          onChange={(event) => onToggleActive({ id: tenant.id, isActive: event.target.checked })}
          inputProps={{ "aria-label": `Toggle ${tenant.name} active` }}
        />
      </TableCell>
      <TableCell align="right">
        <IconButton aria-label={`Edit ${tenant.name}`} onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

interface TenantCreatedResultDialogProps {
  result: CreateTenantResult | null;
  onClose: () => void;
}

/** Same result-dialog pattern as `TenantRequestsPage.tsx`'s `ApprovalResultDialog` — the
 * generated owner credentials are shown here once so the superadmin can relay them to the
 * new owner (there's no welcome-email send on this direct-creation path, unlike the
 * approve-request flow, so there's no `emailSent` branch to show). */
function TenantCreatedResultDialog({ result, onClose }: TenantCreatedResultDialogProps) {
  return (
    <Dialog open={result !== null} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Tenant provisioned</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography>
            <strong>{result?.tenant.name}</strong> ({result?.tenant.slug}) is ready.
          </Typography>
          <Typography>
            Owner username: <strong data-testid="created-tenant-owner-username">{result?.ownerUser.username}</strong>
          </Typography>
          <Typography>
            Temporary password: <strong data-testid="created-tenant-temp-password">{result?.tempPassword}</strong>
          </Typography>
          <Alert severity="warning">Relay these credentials to the new owner manually — they are shown only once.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
