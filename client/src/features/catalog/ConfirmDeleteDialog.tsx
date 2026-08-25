import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  itemLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  /** Set when a delete attempt was rejected with a real validation error (e.g. PHASE_8_TASKS.md Group 3's system-role/last-admin protections) — most callers never fail here, so this stays unset for them. */
  errorMessage?: string | null;
}

/**
 * Shared across the three Phase 5 Group 1 catalog admin screens (Products,
 * Processes, Measurement definitions) rather than duplicated per-page.
 * Copy/structure ("Confirmation?" / "Are you sure you want to delete?" /
 * Cancel-Yes) matches the legacy admin screens' real `Dialog`-based
 * confirmation (e.g. `ManageMeasurements.jsx`), not a `window.confirm` —
 * see PHASE_5_TASKS.md's "reuse, don't redesign" rule.
 */
export function ConfirmDeleteDialog({ open, itemLabel, onCancel, onConfirm, isDeleting, errorMessage }: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Confirmation?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete &quot;{itemLabel}&quot;?
        </DialogContentText>
        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting ?? false}>
          Cancel
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus disabled={isDeleting ?? false}>
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
