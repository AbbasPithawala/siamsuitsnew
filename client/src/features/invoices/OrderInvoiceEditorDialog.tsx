import { Fragment, memo, useCallback, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's Vite dep optimizer
// mis-transforming `@mui/icons-material/X` deep imports.
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { resolveUploadUrl } from "../uploads/uploadsApi";
import {
  useGenerateOrderInvoicePdfMutation,
  useGetOrderInvoiceQuery,
  useSaveOrderInvoiceMutation,
} from "./invoicesApi";
import type { OrderInvoice, OrderInvoiceLine } from "./invoicesApi";

interface EditableLine extends OrderInvoiceLine {
  /** Local-only key for React list identity — server lines have a real `id` once saved, but a freshly-added charge line (or every line in an unsaved draft) doesn't. */
  key: string;
}

let chargeLineCounter = 0;
function nextChargeKey(): string {
  chargeLineCounter += 1;
  return `charge-${chargeLineCounter}`;
}

function toEditableLines(orderInvoice: OrderInvoice): EditableLine[] {
  return orderInvoice.lines.map((line, index) => ({ ...line, key: line.id ?? `line-${index}` }));
}

/** Groups the flat `lines` array back into per-item sections for rendering — same `groupLabel` grouping `invoicePdf.service.ts#groupOrderInvoiceLines` uses server-side, so what's shown here (and the "Add charge" placement below) matches how the generated PDF itself groups these same lines. */
function groupLinesByItem(lines: EditableLine[]): [string, EditableLine[]][] {
  const byGroup = new Map<string, EditableLine[]>();
  for (const line of lines) {
    const group = byGroup.get(line.groupLabel) ?? [];
    group.push(line);
    byGroup.set(line.groupLabel, group);
  }
  return [...byGroup.entries()];
}

export interface OrderInvoiceEditorDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onClose: () => void;
}

/** Loads the order's invoice (draft or saved) and, once loaded, mounts `OrderInvoiceEditorForm` — split out so the form's local editable state can be seeded directly from the query result at construction time (`useState(() => ...)`) rather than via a `useEffect`, which this codebase's lint config flags as a cascading-render risk for "copy a loaded value into local state" (`react-hooks/set-state-in-effect`). */
export function OrderInvoiceEditorDialog({ orderId, orderNumber, open, onClose }: OrderInvoiceEditorDialogProps) {
  const { data: orderInvoice, isLoading, isError, error } = useGetOrderInvoiceQuery(orderId, { skip: !open });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Invoice for Order {orderNumber}</DialogTitle>
      {isLoading && (
        <DialogContent>
          <LoadingSpinner />
        </DialogContent>
      )}
      {isError && (
        <DialogContent>
          <Alert severity="error">{getApiErrorMessage(error, "Failed to load order invoice.")}</Alert>
        </DialogContent>
      )}
      {orderInvoice && <OrderInvoiceEditorForm orderId={orderId} orderInvoice={orderInvoice} onClose={onClose} />}
      {(isLoading || isError) && (
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

interface OrderInvoiceEditorFormProps {
  orderId: string;
  orderInvoice: OrderInvoice;
  onClose: () => void;
}

/**
 * Legacy `CreateInvoice.jsx`'s per-order invoice editor (`handleClickOpen`'s dialog) — one
 * server-auto-generated, read-only-labeled priced line per component (`kind: "unit"`,
 * `orderInvoices.service.ts#buildDraftLines`), plus any number of ad-hoc `kind: "charge"`
 * lines staff add/remove freely by hand (legacy's own "+" button — a plain name + amount,
 * nothing auto-populated from the order's selected styles/features: real feedback was that
 * auto-generating a priced sub-line per selected button/pocket/stitching style was noise, not
 * useful default pricing). `total` shown here is always recomputed from the current line
 * prices client-side for live feedback, but the value actually persisted (and the one every
 * other screen trusts) is `saveOrderInvoice`'s own server-computed sum.
 *
 * `orderInvoice` seeds `lines`/`note` once, at construction — this component has no `key`
 * of its own, but its parent only ever renders it once `orderInvoice` first becomes
 * available, and `OrderInvoiceEditorDialog`'s own `open`/`orderId`-driven query lifecycle
 * (plus `key={priceOrderTarget.id}` at `InvoicesPage.tsx`'s call site) means a genuinely
 * different order's data is never swapped into an already-mounted instance of this form.
 */
function OrderInvoiceEditorForm({ orderId, orderInvoice, onClose }: OrderInvoiceEditorFormProps) {
  const [saveOrderInvoice, saveState] = useSaveOrderInvoiceMutation();
  const [generatePdf, generatePdfState] = useGenerateOrderInvoicePdfMutation();
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [lines, setLines] = useState<EditableLine[]>(() => toEditableLines(orderInvoice));
  const [note, setNote] = useState(orderInvoice.note ?? "");

  const total = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);

  // `useCallback` with an empty dep array (not `[lines]`) — each only ever uses the
  // functional `setLines(current => ...)` form, so none actually closes over `lines`
  // directly. That's what makes them referentially stable across every keystroke, which in
  // turn is what lets `React.memo` on `InvoiceLineRow` below actually skip re-rendering
  // every *other* row's `TextField` while the user types into just one — a real reported
  // perf bug (typing lag) when the line count was large, same root cause and same fix shape
  // as `StylingAccordion.tsx`'s own `handleComponentChange`.
  const updatePrice = useCallback((key: string, price: string) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, price } : line)));
  }, []);

  const updateChargeLabel = useCallback((key: string, label: string) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, label } : line)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  // Legacy `CreateInvoice.jsx`'s own `handleListAdd(i, name)` adds a charge under item `i`
  // specifically, not to one flat shared list — same behavior here: a new charge line is
  // stamped with whichever item's own `groupLabel` its "+ Add charge" button was clicked
  // under, so it renders (and prints on the PDF, `invoicePdf.service.ts#groupOrderInvoiceLines`
  // groups by this exact same field) directly beneath that item, not lumped in elsewhere.
  const addCharge = useCallback((groupLabel: string) => {
    setLines((current) => [
      ...current,
      { key: nextChargeKey(), id: null, groupLabel, kind: "charge", label: "", price: "0", sortOrder: current.length },
    ]);
  }, []);

  async function handleSave() {
    try {
      await saveOrderInvoice({
        orderId,
        body: {
          ...(note.trim() ? { note: note.trim() } : {}),
          lines: lines.map((line) => ({
            groupLabel: line.groupLabel,
            kind: line.kind,
            label: line.label,
            price: Number(line.price) || 0,
          })),
        },
      }).unwrap();
    } catch {
      // surfaced below via saveState.error
    }
  }

  async function handleGeneratePdf() {
    setPdfError(null);
    try {
      const { path } = await generatePdf(orderId).unwrap();
      window.open(resolveUploadUrl(path), "_blank", "noopener,noreferrer");
    } catch (err) {
      setPdfError(getApiErrorMessage(err, "Failed to generate PDF."));
    }
  }

  const isValid = lines.every((line) => line.label.trim().length > 0 && Number(line.price) >= 0);

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {groupLinesByItem(lines).map(([groupLabel, groupLines]) => (
                <Fragment key={groupLabel}>
                  {groupLines.map((line) => (
                    <InvoiceLineRow
                      key={line.key}
                      line={line}
                      onPriceChange={updatePrice}
                      onLabelChange={updateChargeLabel}
                      onRemove={removeLine}
                    />
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} sx={{ borderBottom: "none", pt: 0, pb: 1 }}>
                      <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => addCharge(groupLabel)}>
                        Add charge
                      </Button>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>

          <TextField label="Note" multiline minRows={2} fullWidth value={note} onChange={(event) => setNote(event.target.value)} />

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Typography variant="subtitle1">Total: THB {total.toFixed(2)}</Typography>
          </Box>

          {saveState.error && <Alert severity="error">{getApiErrorMessage(saveState.error, "Failed to save invoice.")}</Alert>}
          {pdfError && <Alert severity="error">{pdfError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {!orderInvoice.isDraft && (
          <Button onClick={handleGeneratePdf} disabled={generatePdfState.isLoading}>
            {generatePdfState.isLoading ? "Generating…" : "View PDF"}
          </Button>
        )}
        <Button variant="contained" onClick={handleSave} disabled={!isValid || saveState.isLoading}>
          {saveState.isLoading ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </>
  );
}

interface InvoiceLineRowProps {
  line: EditableLine;
  onPriceChange: (key: string, price: string) => void;
  onLabelChange: (key: string, label: string) => void;
  onRemove: (key: string) => void;
}

/**
 * `React.memo`'d: effective only because `onPriceChange`/`onLabelChange`/`onRemove` are
 * stable (`useCallback` with an empty dep array in the parent) and `line` keeps its old
 * object identity for every row except the one just edited — without both, typing into one
 * row's price re-rendered every other row's `TextField` too, the reported typing-lag bug.
 */
const InvoiceLineRow = memo(function InvoiceLineRow({ line, onPriceChange, onLabelChange, onRemove }: InvoiceLineRowProps) {
  return (
    <TableRow>
      <TableCell>
        {line.kind === "charge" ? (
          <TextField
            size="small"
            fullWidth
            placeholder="Charge description"
            value={line.label}
            onChange={(event) => onLabelChange(line.key, event.target.value)}
          />
        ) : (
          <Typography variant="body2">{line.label}</Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ width: 140 }}>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          value={line.price}
          onChange={(event) => onPriceChange(line.key, event.target.value)}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: 48 }}>
        {line.kind === "charge" && (
          <IconButton size="small" aria-label="Remove charge" onClick={() => onRemove(line.key)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
});
