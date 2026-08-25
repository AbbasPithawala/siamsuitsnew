import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";

export interface LinkedItemOption {
  id: string;
  label: string;
}

interface ManageLinkedItemsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Product name, rendered uppercase — matches legacy `ManageProduct.jsx`'s `dialog-title-head`. */
  title: string;
  columnLabel: string;
  allItems: LinkedItemOption[];
  linkedIds: string[];
  onSave: (orderedIds: string[]) => Promise<void>;
  isSaving: boolean;
}

/**
 * The "Manage Measurements" / "Manage Styling" dialog from legacy `ManageProduct.jsx` —
 * markup/CSS (`modal-box-NM`, `modal-inner-content`, `append-inputs-btn`, the draggable
 * `Chip` row) ported verbatim from `admin.css`, extended to also add/remove items (legacy's
 * version only reordered an already-fixed list — PHASE_8_TASKS.md Group 1 found there was
 * no way to link/unlink a measurement or feature to a product anywhere in this rewrite at
 * all, so this dialog now does both in one place rather than needing a second screen).
 *
 * Callers must remount this per product (e.g. `key={product.id}`, see `ProductsPage.tsx`)
 * rather than relying on an effect to reset `orderedIds` when a different product opens —
 * this project's lint rules flag synchronous `setState`-in-effect as the anti-pattern it is.
 */
export function ManageLinkedItemsDialog({
  open,
  onClose,
  title,
  columnLabel,
  allItems,
  linkedIds,
  onSave,
  isSaving,
}: ManageLinkedItemsDialogProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>(linkedIds);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const itemById = new Map(allItems.map((item) => [item.id, item]));
  const unlinkedItems = allItems.filter((item) => !orderedIds.includes(item.id));

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragEnter(index: number) {
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    setOrderedIds((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = index;
  }

  function handleRemove(id: string) {
    setOrderedIds((current) => current.filter((existing) => existing !== id));
  }

  function handleAdd(item: LinkedItemOption | null) {
    if (!item) return;
    setOrderedIds((current) => [...current, item.id]);
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await onSave(orderedIds);
      onClose();
    } catch (err) {
      setSaveError(getApiErrorMessage(err, "Failed to save."));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle className="dialog-title-head">{title.toUpperCase()}</DialogTitle>
      <DialogContent>
        <div className="modal-box-NM">
          <div className="modal-inner-content">
            <table>
              <thead>
                <tr>
                  <th>Step ID</th>
                  <th>{columnLabel}</th>
                </tr>
              </thead>
              <tbody>
                {orderedIds.length === 0 && (
                  <tr>
                    <td colSpan={2}>
                      <Typography color="text.secondary" sx={{ py: 1 }}>
                        Nothing linked yet — add one below.
                      </Typography>
                    </td>
                  </tr>
                )}
                {orderedIds.map((id, index) => {
                  const item = itemById.get(id);
                  return (
                    <tr key={id}>
                      <td>
                        <p>{index + 1}</p>
                      </td>
                      <td>
                        <Stack
                          direction="row"
                          spacing={1}
                          draggable
                          data-testid="linked-item-drag-handle"
                          onDragStart={() => handleDragStart(index)}
                          onDragEnter={() => handleDragEnter(index)}
                          onDragOver={(event) => event.preventDefault()}
                        >
                          <Chip
                            label={item?.label ?? id}
                            color="primary"
                            variant="outlined"
                            onDelete={() => handleRemove(id)}
                            style={{ fontSize: "16px", cursor: "grab" }}
                          />
                        </Stack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <Autocomplete
              options={unlinkedItems}
              getOptionLabel={(item) => item.label}
              onChange={(_event, item) => handleAdd(item)}
              value={null}
              renderInput={({ InputLabelProps: _InputLabelProps, ...params }) => (
                // MUI's `AutocompleteRenderInputParams.InputLabelProps.className` is typed
                // `string | undefined`, which trips this project's `exactOptionalPropertyTypes`
                // — dropping it is safe, MUI derives the label styling from `TextField`'s own
                // props regardless.
                <TextField {...params} label={`Add ${columnLabel.toLowerCase()}`} size="small" />
              )}
              sx={{ mt: 2 }}
            />

            {saveError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {saveError}
              </Alert>
            )}

            <div className="append-inputs-btn">
              <input type="submit" className="custom-btn" onClick={handleSave} value={isSaving ? "Saving…" : "Save"} disabled={isSaving} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
