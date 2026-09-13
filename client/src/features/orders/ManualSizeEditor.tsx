import { useMemo, useRef, useState } from "react";
import Draggable from "react-draggable";
import { toPng } from "html-to-image";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — this project's Vite dep optimizer mis-transforms
// `@mui/icons-material/X` deep imports at runtime (see StylingAccordion.tsx).
import { Close as CloseIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { resolveUploadUrl, useUploadFileMutation } from "../uploads/uploadsApi";
import {
  JacketGarmentLayout,
  PantGarmentLayout,
  ShirtGarmentLayout,
  VestGarmentLayout,
  resolveLegacyGarmentLayout,
} from "./legacyManualSizeGarments";

interface ManualSizeLabel {
  id: string;
  /** The raw text the admin typed — displayed verbatim for a free-text label. */
  raw: string;
  /** Set only when `raw` parsed as a plain non-negative number (see `formatFraction` below) — the reduced-mixed-fraction rendering the legacy tool produced. */
  fraction: { whole: number; numerator: number; denominator: number } | null;
  x: number;
  y: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Mirrors `editOrderWithManualSize.jsx`'s real `toFraction` behavior
 * (`siamClient/src/components/superAdmin/pages/order/editOrderWithManualSize.jsx`):
 * a plain numeric entry like "1.5" becomes a reduced mixed fraction (whole=1,
 * 5/10 reduced to 1/2) rather than being stored as a decimal — legacy
 * rendered this as `1<sup>1</sup>&frasl;<sub>2</sub>`, reproduced here via
 * the same whole/numerator/denominator triple so the label component can
 * render the identical `<sup>`/`<sub>` markup. A whole number with no
 * fractional part (or a value that doesn't parse as numeric at all) has no
 * `fraction` — it's rendered as plain text instead, exactly like legacy's
 * free-text item branch.
 */
function parseNumericLabel(raw: string): ManualSizeLabel["fraction"] {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [wholeStr, decimalStr] = trimmed.split(".");
  const whole = Number(wholeStr ?? "0");
  if (!decimalStr) return { whole, numerator: 0, denominator: 1 };
  const numerator = Number(decimalStr);
  const denominator = 10 ** decimalStr.length;
  if (numerator === 0) return { whole, numerator: 0, denominator: 1 };
  const divisor = gcd(denominator, numerator);
  return { whole, numerator: numerator / divisor, denominator: denominator / divisor };
}

function LabelContent({ label }: { label: ManualSizeLabel }) {
  if (!label.fraction) return <span>{label.raw}</span>;
  const { whole, numerator, denominator } = label.fraction;
  if (numerator === 0) return <span>{whole}</span>;
  return (
    <span>
      {whole > 0 ? whole : ""}
      <sup>{numerator}</sup>&frasl;<sub>{denominator}</sub>
    </span>
  );
}

export interface ManualSizeEditorProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title context — e.g. "Jacket (Suit Jacket)". */
  title: string;
  /** `SuperProductComponent.product.name` — resolved through `resolveLegacyGarmentLayout` to pick a hardcoded legacy garment layout (jacket/pant/shirt/vest) when one exists for this exact product name; falls back to the generic single-diagram canvas otherwise. */
  productName: string;
  /** `SuperProductComponent.product.measurementDiagramImage` — only used by the generic fallback canvas (no legacy layout matched `productName`); `null` there renders a "no diagram set" message instead. */
  diagramImageUrl: string | null;
  /** Called with the rasterized-and-uploaded image's URL once the admin saves — the caller (e.g. `OrderBuilderPage.tsx`) writes it into the relevant draft's `manualSizeImage`; this component has no save action of its own beyond producing that URL. */
  onSave: (url: string) => void;
}

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 620;

/**
 * PHASE_10_TASKS.md Workstream E Group 6.3c — generic Manual Size annotation
 * editor, since extended to also reproduce legacy's hardcoded per-garment
 * overlay fields exactly (`legacyManualSizeGarments.tsx`): unlike the rest of
 * this rewrite's "generalized products" architecture, `editOrderWithManualSize.jsx`
 * hardcoded one specific JSX layout per garment *name* (jacket/pant/shirt/vest),
 * each with its own bundled diagram images and, for jacket, three fixed Thai
 * dropdown fields (shoulder support / fabric lining / tailor) plus four fixed
 * "type here" input boxes positioned at exact pixel offsets — not data the
 * admin could otherwise enter anywhere else in this system. Reproducing that
 * required literally the same per-garment-name branching legacy used, kept
 * isolated in `legacyManualSizeGarments.tsx` so it doesn't leak into the rest
 * of the order-building flow: any product name outside that fixed set (i.e.
 * every custom product an admin creates through the generalized catalog)
 * still gets the fully generic `diagramImageUrl`-driven canvas below.
 *
 * Free-text and number labels are added via one text field (legacy's
 * `newitem`/`keyPress` "Enter" flow), dragged into place with
 * `react-draggable` (legacy's real `Draggable`/`updatePos` mechanism,
 * reproduced 1:1 including default-position offsets), and deleted via each
 * label's own "x" button — this part applies identically on top of *either*
 * canvas, exactly like legacy re-includes the same drag mechanism inside
 * every one of its per-garment blocks. On Save, the whole annotated canvas
 * (background image(s) + any overlay fields + every positioned label) is
 * rasterized client-side via `html-to-image`'s `toPng` (legacy's
 * `takeScreenShot`), uploaded through the existing generic `POST /api/uploads`
 * (`useUploadFileMutation`, already used by `StylingAccordion.tsx`'s
 * reference-image upload — no new upload endpoint), and the resulting URL is
 * handed back to the caller via `onSave`.
 *
 * Re-opening this dialog always starts from a blank label set (matching
 * legacy's own behavior — `items` never round-trips out of a previously
 * saved raster back into editable draggable labels, since the saved artifact
 * is a flattened PNG, not label data): an existing `manualSizeImage` is
 * shown as a small preview only, not decoded back into labels to keep
 * editing.
 */
export function ManualSizeEditor({ open, onClose, title, productName, diagramImageUrl, onSave }: ManualSizeEditorProps) {
  const [labels, setLabels] = useState<ManualSizeLabel[]>([]);
  const [draftText, setDraftText] = useState("");
  const [uploadFile, { isLoading: isSaving }] = useUploadFileMutation();
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const legacyLayout = resolveLegacyGarmentLayout(productName);
  const hasCanvas = legacyLayout !== null || Boolean(diagramImageUrl);

  // react-draggable (v4) finds its DOM node via the now-removed
  // `ReactDOM.findDOMNode` unless given an explicit `nodeRef` — under React
  // 19 that lookup returns null, so the very first drag throws "<DraggableCore>
  // not mounted on DragStart!". A per-label ref is the standard fix
  // (https://github.com/react-grid-layout/react-draggable#draggable-with-nested-elements),
  // but hooks can't run inside `.map()`, and this project's lint config
  // forbids mutating a `useRef`/`useMemo` value after the fact
  // (`react-hooks/refs`, `react-hooks/immutability`) — the usual
  // get-or-create-lazily pattern trips both. Instead, a fresh, fully-built
  // `Map` is derived from `labels` every render via `useMemo`; slightly more
  // allocation than caching across renders, but this dialog only ever holds
  // a handful of labels, and it's the only variant that's actually
  // read-only from render's perspective.
  const labelNodeRefs = useMemo(() => {
    const map = new Map<string, React.RefObject<HTMLDivElement | null>>();
    for (const label of labels) {
      map.set(label.id, { current: null });
    }
    return map;
  }, [labels]);

  function handleAddLabel() {
    const raw = draftText.trim();
    if (!raw) return;
    const fraction = parseNumericLabel(raw);
    setLabels((current) => [...current, { id: crypto.randomUUID(), raw, fraction, x: 40, y: 40 }]);
    setDraftText("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddLabel();
    }
  }

  function handleDeleteLabel(id: string) {
    setLabels((current) => current.filter((label) => label.id !== id));
  }

  function handleUpdatePosition(id: string, x: number, y: number) {
    setLabels((current) => current.map((label) => (label.id === id ? { ...label, x, y } : label)));
  }

  function handleClose() {
    setLabels([]);
    setDraftText("");
    setError(null);
    onClose();
  }

  async function handleSave() {
    if (!canvasRef.current) return;
    setError(null);
    try {
      const dataUrl = await toPng(canvasRef.current);
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "manual-size.png", { type: "image/png" });
      const result = await uploadFile(file).unwrap();
      onSave(result.url);
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save the Manual Size annotation."));
    }
  }

  const isWideLayout = legacyLayout === "jacket";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={isWideLayout ? false : "md"}
      fullWidth={!isWideLayout}
      {...(isWideLayout ? { sx: { "& .MuiDialog-paper": { width: "95vw", maxWidth: "1700px" } } } : {})}
    >
      <DialogTitle>
        Manual Size — {title}
        <IconButton aria-label="Close" onClick={handleClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {!hasCanvas ? (
          <Alert severity="info">
            This product has no measurement diagram set — an admin can add one from Manage Product on the Products
            page ("Measurement Diagram Image URL").
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Add label (number or text)"
                size="small"
                fullWidth
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button variant="outlined" onClick={handleAddLabel} disabled={!draftText.trim()}>
                Add
              </Button>
            </Stack>

            <Box sx={{ overflow: "auto" }}>
              <Box
                ref={canvasRef}
                sx={
                  legacyLayout
                    ? { position: "relative", width: "fit-content", mx: "auto", border: "1px solid #ddd", bgcolor: "#fff" }
                    : {
                        position: "relative",
                        width: CANVAS_WIDTH,
                        height: CANVAS_HEIGHT,
                        mx: "auto",
                        border: "1px solid #ddd",
                        backgroundImage: `url(${resolveUploadUrl(diagramImageUrl!)})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        backgroundColor: "#fff",
                        overflow: "hidden",
                      }
                }
              >
                {legacyLayout === "jacket" && <JacketGarmentLayout />}
                {legacyLayout === "pant" && <PantGarmentLayout />}
                {legacyLayout === "shirt" && <ShirtGarmentLayout />}
                {legacyLayout === "vest" && <VestGarmentLayout />}

                {labels.map((label) => {
                  const nodeRef = labelNodeRefs.get(label.id)!;
                  return (
                    <Draggable
                      key={label.id}
                      nodeRef={nodeRef}
                      defaultPosition={{ x: label.x, y: label.y }}
                      onStop={(_event, data) => handleUpdatePosition(label.id, data.x, data.y)}
                      bounds="parent"
                    >
                      <Box
                        ref={nodeRef}
                        sx={{
                          position: "absolute",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 1,
                          py: 0.25,
                          bgcolor: "#e0e0df",
                          border: "1px solid #999",
                          borderRadius: 1,
                          cursor: "move",
                          fontSize: 14,
                          zIndex: 999,
                        }}
                      >
                        <LabelContent label={label} />
                        <IconButton size="small" aria-label={`Delete label ${label.raw}`} onClick={() => handleDeleteLabel(label.id)} sx={{ p: 0.25 }}>
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    </Draggable>
                  );
                })}
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Drag labels into place, then Save — the annotated diagram is saved as a single image on this component.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!hasCanvas || isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
