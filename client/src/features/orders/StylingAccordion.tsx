import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiAccordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
// Named barrel import — this project's Vite dep optimizer mis-transforms
// `@mui/icons-material/X` deep imports at runtime (see AppShell.tsx/LoginPage.tsx).
import { ArrowForwardIosSharp as ExpandArrowIcon, CloudUpload as CloudUploadIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { FeatureSelector } from "../featureSelector/FeatureSelector";
import { useProductFeaturesQuery } from "../featureSelector/featuresApi";
import type { FeatureValue, ProductFeature } from "../featureSelector/featuresApi";
import type { MonogramStructuredValue } from "../featureSelector/MonogramFeatureField";
import type { SuperProductComponent } from "../catalog/superProductsApi";
import { resolveUploadUrl, useUploadFileMutation } from "../uploads/uploadsApi";
import "../../styles/legacyAdmin/App.css";
import "../../styles/legacyAdmin/MissingFabric.css";

/**
 * One super-product component's per-unit styling draft — exactly the three
 * per-unit fields `order_item_components` actually has (PHASE_9_TASKS.md
 * Decision 5/Group 2): `features` (the same `FeatureValue[]` shape
 * `<FeatureSelector>` already emits, including its inline fabric/lining/
 * monogram entries — those are just `type: "text"`/`"structured"` features),
 * `stylingNote`, `referenceImage` (the URL `POST /api/uploads` returns).
 * Measurements/`measurementNote`/Shoulder Type are deliberately absent —
 * Group 6's concern, shared once per line item, never per unit.
 */
export interface ComponentStylingDraft {
  features: FeatureValue[];
  stylingNote: string;
  referenceImage: string | null;
  /**
   * PHASE_10_TASKS.md Workstream E Group 6.3b — the real `order_item_components.id`
   * this unit's draft was pre-filled from, present only when `OrderBuilderPage.tsx`'s
   * edit mode seeds this draft from a real order (`GET /orders/:id`) — always absent
   * during ordinary order creation. Submitted back on save so the edit route
   * (`PATCH /orders/:id`) updates this exact row in place instead of creating a
   * duplicate; never read/written by this component itself beyond preserving it
   * through `handleCopyToggle` below.
   */
  id?: string;
  /** Sibling to `id` above — the real `order_items.id` this unit belongs to, same edit-mode-only provenance. */
  orderItemId?: string;
}

export function emptyComponentStylingDraft(): ComponentStylingDraft {
  return { features: [], stylingNote: "", referenceImage: null };
}

/** One physical unit's styling, keyed by `SuperProductComponent.id` (not `productId` — two components can share a product). */
export type UnitStylingDraft = Record<string, ComponentStylingDraft>;

export function emptyUnitStylingDraft(components: SuperProductComponent[]): UnitStylingDraft {
  return Object.fromEntries(components.map((component) => [component.id, emptyComponentStylingDraft()]));
}

function withUnitAt(
  value: UnitStylingDraft[],
  quantity: number,
  components: SuperProductComponent[],
  index: number,
  unitDraft: UnitStylingDraft
): UnitStylingDraft[] {
  const next = Array.from({ length: quantity }, (_, i) => value[i] ?? emptyUnitStylingDraft(components));
  next[index] = unitDraft;
  return next;
}

export interface StylingAccordionProps {
  /** The super product's real components (1–3), e.g. jacket+pant for a Suit — never hardcoded per super product. */
  components: SuperProductComponent[];
  /** How many physical units (accordions) to render, e.g. "Suit #1".."Suit #N". */
  quantity: number;
  /** Controlled: one entry per unit, index-aligned with `quantity`. A short/sparse array is tolerated — missing entries render as empty drafts. */
  value: UnitStylingDraft[];
  onChange: (value: UnitStylingDraft[]) => void;
  /** Group 7's concern to actually remove the unit + re-sequence; this component only ever asks. */
  onDeleteUnit: (index: number) => void;
}

const StyledAccordion = styled((props: React.ComponentProps<typeof MuiAccordion>) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": { borderBottom: 0 },
  "&:before": { display: "none" },
}));

/**
 * Per-unit Styling accordion + sticky summary panel — the generic
 * replacement for legacy `MissingFabric.jsx`'s per-garment-type accordion
 * blocks (PHASE_9_TASKS.md Group 5). Renders `quantity` accordions, each
 * internally mapping over the super product's real `components`, exactly the
 * same "iterate over whichever components this super product has" pattern
 * `OrderComponentStep.tsx` already established for measurements.
 *
 * Fully controlled — no internal state duplicates `value`. The only local
 * state here is transient UI (which accordion/unit is expanded, the "copy
 * previous" checkbox's checked-ness, a pending-but-not-yet-uploaded file per
 * component) — none of it is order data a parent needs to persist.
 *
 * Self-contained by design (PHASE_9_TASKS.md Group 5's scope boundary): not
 * wired into `OrderBuilderPage.tsx` here — Group 7 composes this alongside
 * Group 6's per-line-item Measurements panel once both exist.
 */
export function StylingAccordion({ components, quantity, value, onChange, onDeleteUnit }: StylingAccordionProps) {
  const [expandedUnit, setExpandedUnit] = useState<number | null>(0);
  const [copyChecked, setCopyChecked] = useState<Record<number, boolean>>({});

  const unitIndexes = useMemo(() => Array.from({ length: quantity }, (_, i) => i), [quantity]);

  const updateUnit = (index: number, unitDraft: UnitStylingDraft) => {
    onChange(withUnitAt(value, quantity, components, index, unitDraft));
  };

  /**
   * `withOwnIdsPreserved` re-attaches `index`'s own `id`/`orderItemId` (its real,
   * already-persisted `order_item_components.id`/`order_items.id`, edit-mode only —
   * see `ComponentStylingDraft`'s doc comment) onto whichever content is about to
   * replace its draft. Without this, checking "copy previous" (or unchecking it,
   * which resets to an empty draft) would silently overwrite unit `index`'s real
   * identity with unit `index - 1`'s (or discard it to `undefined`), and the next
   * save would update the wrong row — a real correctness bug in edit mode, a no-op
   * in create mode where every unit's `id`/`orderItemId` is already `undefined`.
   */
  const withOwnIdsPreserved = (index: number, sourceUnit: UnitStylingDraft): UnitStylingDraft => {
    const current = value[index] ?? emptyUnitStylingDraft(components);
    const merged: UnitStylingDraft = {};
    for (const component of components) {
      const sourceComponentDraft = sourceUnit[component.id] ?? emptyComponentStylingDraft();
      // Only the content fields travel from `sourceUnit` — its own `id`/`orderItemId`
      // (if any, e.g. cloned from a real previous unit) is deliberately never spread in.
      const { features, stylingNote, referenceImage } = sourceComponentDraft;
      const ownId = current[component.id]?.id;
      const ownOrderItemId = current[component.id]?.orderItemId;
      merged[component.id] = {
        features,
        stylingNote,
        referenceImage,
        ...(ownId !== undefined ? { id: ownId } : {}),
        ...(ownOrderItemId !== undefined ? { orderItemId: ownOrderItemId } : {}),
      };
    }
    return merged;
  };

  const handleCopyToggle = (index: number, checked: boolean) => {
    setCopyChecked((prev) => ({ ...prev, [index]: checked }));
    if (checked) {
      const previous = value[index - 1] ?? emptyUnitStylingDraft(components);
      updateUnit(index, withOwnIdsPreserved(index, JSON.parse(JSON.stringify(previous)) as UnitStylingDraft));
    } else {
      updateUnit(index, withOwnIdsPreserved(index, emptyUnitStylingDraft(components)));
    }
  };

  return (
    <Box>
      {unitIndexes.map((index) => {
        const unitDraft = value[index] ?? emptyUnitStylingDraft(components);
        return (
          <Box key={index} sx={{ mb: 2 }}>
            <button type="button" className="delete-Btn" onClick={() => onDeleteUnit(index)}>
              Delete
            </button>
            <StyledAccordion
              className="Accrodian-main"
              expanded={expandedUnit === index}
              onChange={(_event, isExpanded) => setExpandedUnit(isExpanded ? index : null)}
            >
              <AccordionSummary
                className="fabric_infoNM"
                aria-controls={`unit-${index}-content`}
                id={`unit-${index}-header`}
                expandIcon={<ExpandArrowIcon sx={{ fontSize: "0.8rem", color: "#242424" }} />}
              >
                <span>
                  Fabric Information for <strong>Item {index + 1}</strong>
                </span>
              </AccordionSummary>
              <AccordionDetails className="information-accrodian" id={`unit-${index}-content`}>
                {/* Legacy `MissingFabric.jsx`'s real structure: the form (`fabric-left`)
                    and the live summary (`fabric-right`) both live inside THIS unit's
                    own accordion content — not a single panel shared across every
                    unit — so each item's summary reflects only its own data. */}
                <Box className="missing-fabric-wrapperMain" sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
                  <Box className="fabric-left" sx={{ flex: 1, minWidth: 0 }}>
                    {index > 0 && (
                      <div className="copyCheckDiv">
                        <input
                          type="checkbox"
                          id={`copy-check-${index}`}
                          checked={copyChecked[index] ?? false}
                          onChange={(event) => handleCopyToggle(index, event.target.checked)}
                        />
                        <label htmlFor={`copy-check-${index}`}>
                          <strong>Copy Styles of the previous Item.</strong>
                        </label>
                      </div>
                    )}
                    {components.map((component) => (
                      <ComponentStylingPanel
                        key={component.id}
                        unitIndex={index}
                        component={component}
                        showHeading={components.length > 1}
                        draft={unitDraft[component.id] ?? emptyComponentStylingDraft()}
                        onChange={(patch) => {
                          const currentDraft = unitDraft[component.id] ?? emptyComponentStylingDraft();
                          updateUnit(index, { ...unitDraft, [component.id]: { ...currentDraft, ...patch } });
                        }}
                      />
                    ))}
                  </Box>

                  <Box className="fabric-right" sx={{ position: "sticky", top: 16 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Summary — Item {index + 1}
                    </Typography>
                    <div className="fabric-customer-info">
                      <div className="fabric-accrodian-box">
                        {components.map((component) => (
                          <ComponentSummaryCard
                            key={component.id}
                            component={component}
                            draft={unitDraft[component.id] ?? emptyComponentStylingDraft()}
                          />
                        ))}
                      </div>
                    </div>
                  </Box>
                </Box>
              </AccordionDetails>
            </StyledAccordion>
          </Box>
        );
      })}
    </Box>
  );
}

interface ComponentStylingPanelProps {
  unitIndex: number;
  component: SuperProductComponent;
  showHeading: boolean;
  draft: ComponentStylingDraft;
  onChange: (patch: Partial<ComponentStylingDraft>) => void;
}

/**
 * One component's `<FeatureSelector>` (covers fabric/lining/monogram inline
 * fields + the choice-feature tab bars) plus the two per-unit fields
 * `<FeatureSelector>` doesn't own: the styling note and the reference-image
 * upload (legacy `MissingFabric.jsx`'s `handleImageUpload`'s real two-step
 * shape — pick a file locally, preview it immediately via
 * `URL.createObjectURL`, only actually upload on a separate button click).
 */
function ComponentStylingPanel({ unitIndex, component, showHeading, draft, onChange }: ComponentStylingPanelProps) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputId = `reference-image-${unitIndex}-${component.id}`;

  const previewUrl = useMemo(() => (pendingFile ? URL.createObjectURL(pendingFile) : null), [pendingFile]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploadError(null);
    try {
      const result = await uploadFile(pendingFile).unwrap();
      onChange({ referenceImage: result.url });
      setPendingFile(null);
    } catch (err) {
      setUploadError(getApiErrorMessage(err, "Failed to upload reference image."));
    }
  };

  const displaySrc = previewUrl ?? (draft.referenceImage ? resolveUploadUrl(draft.referenceImage) : null);

  return (
    <Box sx={{ mb: 3 }}>
      {showHeading && (
        <Typography variant="subtitle1" gutterBottom>
          {component.slotLabel}
        </Typography>
      )}
      <FeatureSelector productId={component.productId} value={draft.features} onChange={(features) => onChange({ features })} />

      <div className="form-group pd-top-15p">
        <label htmlFor={`styling-note-${unitIndex}-${component.id}`}>
          <h3>Note</h3>
        </label>
        <textarea
          id={`styling-note-${unitIndex}-${component.id}`}
          className="searchinput"
          placeholder="Special note (if any)"
          value={draft.stylingNote}
          onChange={(event) => onChange({ stylingNote: event.target.value })}
        />
      </div>

      <div className="form-group">
        <div className="title-fabrics">
          <h3>Reference Image</h3>
        </div>
        <label htmlFor={fileInputId} style={{ cursor: "pointer", display: "inline-block" }}>
          {displaySrc ? (
            <img
              src={displaySrc}
              alt=""
              className="uploaded-image"
              style={{ width: 200, height: 200, borderRadius: "50%", objectFit: "cover" }}
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Box
              sx={{
                width: 200,
                height: 200,
                border: "2px dashed #ccc",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f9f9f9",
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: "#999", mb: 1 }} />
              <Typography variant="body2" color="text.secondary" align="center" sx={{ px: 1 }}>
                Click to upload image
              </Typography>
            </Box>
          )}
        </label>
        <input
          type="file"
          id={fileInputId}
          accept="image/*"
          className="inputfile-button"
          style={{ display: "none" }}
          onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
        />
        <Box>
          <Button onClick={handleUpload} disabled={!pendingFile || isUploading}>
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </Box>
        {uploadError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {uploadError}
          </Alert>
        )}
      </div>
    </Box>
  );
}

interface SummaryField {
  label: string;
  value: string;
}

function summarizeInlineFeature(feature: ProductFeature, values: FeatureValue[]): SummaryField[] {
  const entry = values.find((v) => v.featureId === feature.id);
  if (feature.type === "text") {
    return entry?.textValue ? [{ label: feature.name, value: entry.textValue }] : [];
  }
  const structured = (entry?.structuredValue ?? {}) as MonogramStructuredValue;
  const subFields: [keyof MonogramStructuredValue, string][] = [
    ["text", `${feature.name} Tag`],
    ["text2", `${feature.name} Tag Optional`],
    ["font", `${feature.name} Font`],
    ["color", `${feature.name} Color`],
  ];
  return subFields.filter(([key]) => structured[key]).map(([key, label]) => ({ label, value: structured[key] as string }));
}

function summarizeChoiceFeature(feature: ProductFeature, values: FeatureValue[]): SummaryField | null {
  const entry = values.find((v) => v.featureId === feature.id);
  if (!entry?.styleId) return null;
  const style = feature.styles?.find((s) => s.id === entry.styleId);
  if (!style) return null;
  const option = entry.styleOptionId ? style.options.find((o) => o.id === entry.styleOptionId) : undefined;
  return { label: feature.name, value: option ? `${style.name} – ${option.name}` : style.name };
}

interface ComponentSummaryCardProps {
  component: SuperProductComponent;
  draft: ComponentStylingDraft;
}

/**
 * Legacy `MissingFabric.jsx`'s real `.fabric_info_card`/`.fi_card_body`/
 * `.custome_row`/`.custome_col_6` structure (read-only summary of whichever
 * unit's accordion is currently expanded) — generalized to read off any
 * product's real features (fetched via the same `useProductFeaturesQuery`
 * cache key `<FeatureSelector>` already populates for this component, no
 * extra request) instead of legacy's hardcoded `fabric_code`/`lining_code`/
 * `piping`/`monogram` keys.
 */
function ComponentSummaryCard({ component, draft }: ComponentSummaryCardProps) {
  const { data: features } = useProductFeaturesQuery(component.productId);
  const visible = (features ?? []).filter((feature) => feature.renderSlot === null);
  const monogramPositionFeature = (features ?? []).find((feature) => feature.renderSlot === "monogram_position");

  const fabricFields = visible.filter((feature) => feature.type !== "choice").flatMap((feature) => summarizeInlineFeature(feature, draft.features));
  if (monogramPositionFeature) {
    const positionEntry = summarizeChoiceFeature(monogramPositionFeature, draft.features);
    if (positionEntry) fabricFields.push(positionEntry);
  }
  if (draft.stylingNote) fabricFields.push({ label: "Note", value: draft.stylingNote });

  const styleFields = visible
    .filter((feature) => feature.type === "choice")
    .map((feature) => summarizeChoiceFeature(feature, draft.features))
    .filter((field): field is SummaryField => field !== null);

  const imageSrc = draft.referenceImage ? resolveUploadUrl(draft.referenceImage) : null;

  return (
    <>
      <div className="fabric_info_card">
        <h4 className="fic_title">
          {component.slotLabel.toUpperCase()} <span style={{ marginLeft: 8 }}>Styling Reference Image</span>
        </h4>
        <div className="fi_card_body">
          <div className="custome_row">
            <div className="custome_col_6 br_0">
              <h5>Image</h5>
              <span className="blue_text">
                {imageSrc ? (
                  <img
                    width={50}
                    height={50}
                    src={imageSrc}
                    alt=""
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  "NA"
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fabric_info_card">
        <h4 className="fic_title">Fabric Information</h4>
        <div className="fi_card_body">
          <ul className="custome_row">
            {fabricFields.length > 0 ? (
              fabricFields.map((field) => (
                <li className="custome_col_6" key={field.label}>
                  <h5>{field.label.toUpperCase()}</h5>
                  <span className="blue_text">{field.value}</span>
                </li>
              ))
            ) : (
              <li className="custome_col_12">
                <span className="blue_text">NA</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="fabric_info_card">
        <h4 className="fic_title">
          {component.slotLabel.toUpperCase()} <span style={{ marginLeft: 8 }}>Styling info</span>
        </h4>
        <div className="fi_card_body">
          <ul className="custome_row">
            {styleFields.length > 0 ? (
              styleFields.map((field) => (
                <li className="custome_col_6" key={field.label}>
                  <h5>{field.label.toUpperCase()}</h5>
                  <span className="blue_text">{field.value}</span>
                </li>
              ))
            ) : (
              <li className="custome_col_12">
                <span className="blue_text">NA</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
