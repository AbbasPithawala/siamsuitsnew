import { useState } from "react";
import type { ChangeEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useProductMeasurementsQuery } from "./measurementsApi";
import type { ProductMeasurementLink } from "./measurementsApi";
import { useLazyGetFittingQuery, useListFittingsForProductQuery } from "../catalog/fittingsApi";
import { useProductFeaturesQuery } from "../featureSelector/featuresApi";
import type { FeatureValue } from "../featureSelector/featuresApi";
import "../../styles/legacyAdmin/App.css";
import "../../styles/legacyAdmin/admin.css";
import "../../styles/legacyAdmin/Measurements.css";

/**
 * Shape of one entry in `POST /api/orders`'s `measurements[]` field for an
 * order component — must exactly match `CreateMeasurementInput` in
 * `server/src/services/orders.service.ts` (verified against that file, not
 * inferred): `measurementDefinitionId` plus optional string `value`/
 * `adjustmentValue`.
 */
export interface MeasurementValue {
  measurementDefinitionId: string;
  value?: string;
  adjustmentValue?: string;
}

export interface MeasurementFormProps {
  productId: string;
  value: MeasurementValue[];
  onChange: (value: MeasurementValue[]) => void;
  /** PHASE_9_TASKS.md Decision 5 — distinct from the per-unit `stylingNote` Group 5 adds elsewhere. */
  measurementNote: string;
  onMeasurementNoteChange: (note: string) => void;
  /**
   * The shared `FeatureValue[]` slice for this product (Decision 3/4): not
   * measurements, but this form still needs to read/write it because the
   * Shoulder Type `choice` feature (Decision 4's `render_slot`) renders here,
   * not in `<FeatureSelector>`'s tab bar — a small, explicit prop, not a
   * hidden side channel into a store this component doesn't otherwise touch.
   */
  features: FeatureValue[];
  onFeaturesChange: (features: FeatureValue[]) => void;
}

function labelFor(link: ProductMeasurementLink): string {
  const { name, thaiName } = link.measurementDefinition;
  return thaiName ? `${name} (${thaiName})` : name;
}

function MeasurementColumnHeader() {
  return (
    <Grid item xs={12} sm={6}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          justifyContent: "space-between",
          p: "8px 15px",
          fontWeight: "bold",
          bgcolor: "#f0f0f0",
          borderRadius: "6px",
        }}
      >
        <Typography sx={{ flex: 1, fontSize: 12, fontWeight: "bold" }}>Measurement</Typography>
        <Typography sx={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "bold" }}>BodySize</Typography>
        <Typography sx={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "bold" }}>Adjustments</Typography>
        <Typography sx={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "bold" }}>Total</Typography>
      </Box>
    </Grid>
  );
}

/**
 * Mirrors `server/src/services/orders.service.ts`'s `computeTotalValue`
 * exactly, for live display only — the value that actually ships on submit
 * is always whatever the server recomputes at that time, this is never sent
 * as a "total" field itself. Unlike the server (which throws on a
 * non-numeric `value`), this returns `""` for a not-yet-numeric in-progress
 * value so the field simply shows blank while the user is still typing.
 */
/**
 * Mirrors `Measurements.jsx`'s real `handleValueChange` restriction
 * (`siamClient/src/components/Measurements/Measurements.jsx`): digits and at
 * most one decimal point only, at most 2 digits before it and 2 after —
 * applied on every keystroke, not just at submit, so an invalid character
 * never visibly lands in the field at all.
 */
function sanitizeMeasurementInput(raw: string): string {
  const digitsAndDot = raw.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1");
  const [integerPart = "", decimalPart] = digitsAndDot.split(".");
  const truncatedInteger = integerPart.slice(0, 2);
  return decimalPart !== undefined ? `${truncatedInteger}.${decimalPart.slice(0, 2)}` : truncatedInteger;
}

function computeLiveTotal(rawValue: string | undefined, rawAdjustment: string | undefined): string {
  const trimmedValue = rawValue?.trim();
  if (!trimmedValue) return "";
  const numericValue = Number(trimmedValue);
  const trimmedAdjustment = rawAdjustment?.trim();
  const numericAdjustment = trimmedAdjustment ? Number(trimmedAdjustment) : 0;
  if (Number.isNaN(numericValue) || Number.isNaN(numericAdjustment)) return "";
  return (numericValue + numericAdjustment).toFixed(2);
}

/**
 * Generic, data-driven measurement form: it renders whatever measurement
 * definitions the backend says are linked to `productId`, nothing more.
 * There is deliberately no branching on which product/super-product this is
 * (see `PHASE_5_TASKS.md` Group 5) — a product with 5 measurement points and
 * one with 40 (or zero) all flow through the exact same code path here. The
 * one "special" field, Shoulder Type, is found generically by
 * `renderSlot === "shoulder_type"` (PHASE_9_TASKS.md Decision 4), never by
 * literal product/feature name.
 *
 * Fully controlled: no internal state duplicates `value`/`measurementNote`/
 * `features`. Every keystroke/selection produces a new array (or string) via
 * the matching `onChange`-shaped prop, immutably derived from the current
 * prop value.
 *
 * Layout/classNames (header row + card-style value/adjustment/total rows,
 * `.selecting-size`/`.step-2styles-NM`/`.searchinput-measurement`/
 * `.fabric-types_NM`/`.fabricselection_Common_NM`/`.note`) are ported from
 * `siamClient/src/components/Measurements/Measurements.jsx` per the "reuse,
 * don't redesign" rule — see `styles/legacyAdmin/Measurements.css`'s own
 * comment for where each class's real rules actually live in legacy.
 */
export function MeasurementForm({
  productId,
  value,
  onChange,
  measurementNote,
  onMeasurementNoteChange,
  features,
  onFeaturesChange,
}: MeasurementFormProps) {
  const { data: links, isLoading, isFetching, isError, error } = useProductMeasurementsQuery(productId);
  const { data: fittings } = useListFittingsForProductQuery(productId);
  const [triggerGetFitting, { isFetching: isFittingLoading }] = useLazyGetFittingQuery();
  const [selectedFittingId, setSelectedFittingId] = useState("");
  const [manualFitError, setManualFitError] = useState<string | null>(null);

  // Same cache key `<FeatureSelector>` already populates for this product —
  // RTK Query dedupes this, not a real extra network round trip.
  const { data: productFeatures } = useProductFeaturesQuery(productId);
  const shoulderTypeFeature = productFeatures?.find((feature) => feature.renderSlot === "shoulder_type") ?? null;
  const shoulderTypeSelection = shoulderTypeFeature
    ? features.find((entry) => entry.featureId === shoulderTypeFeature.id)
    : undefined;

  /**
   * PHASE_8_TASKS.md Group 6.4: picking a preset "Manual Fit" bulk-writes
   * `adjustmentValue` for every measurement the fitting has a preset value
   * for, in the one `onChange` call this form already requires (never
   * mutating `value` in place) — same immutable-array-replace shape
   * `handleFieldChange` below already uses per-keystroke, just applied to
   * every matching measurement at once. Uses a `Map` keyed by
   * `measurementDefinitionId` so entries not touched by the fitting keep
   * their existing position/content, and existing entries the fitting does
   * touch are updated in place rather than reordered.
   */
  const handleManualFitChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const fittingId = event.target.value;
    setSelectedFittingId(fittingId);
    setManualFitError(null);
    if (!fittingId) return;
    try {
      const fitting = await triggerGetFitting(fittingId).unwrap();
      const valueByMeasurement = new Map(value.map((entry) => [entry.measurementDefinitionId, entry]));
      for (const fittingValue of fitting.values) {
        const existing = valueByMeasurement.get(fittingValue.measurementDefinitionId) ?? {
          measurementDefinitionId: fittingValue.measurementDefinitionId,
        };
        valueByMeasurement.set(fittingValue.measurementDefinitionId, {
          ...existing,
          adjustmentValue: fittingValue.value,
        });
      }
      onChange([...valueByMeasurement.values()]);
    } catch (err) {
      setManualFitError(getApiErrorMessage(err, "Failed to load fitting."));
    }
  };

  const handleFieldChange = (
    measurementDefinitionId: string,
    field: "value" | "adjustmentValue",
    rawFieldValue: string
  ) => {
    const fieldValue = sanitizeMeasurementInput(rawFieldValue);
    const existingIndex = value.findIndex((entry) => entry.measurementDefinitionId === measurementDefinitionId);
    const existing = existingIndex === -1 ? { measurementDefinitionId } : value[existingIndex]!;
    const updated: MeasurementValue =
      field === "value" ? { ...existing, value: fieldValue } : { ...existing, adjustmentValue: fieldValue };
    const nextValue = [...value];
    if (existingIndex === -1) {
      nextValue.push(updated);
    } else {
      nextValue[existingIndex] = updated;
    }
    onChange(nextValue);
  };

  const handleShoulderTypeSelect = (featureId: string, styleId: string) => {
    const next: FeatureValue = { featureId, styleId };
    const index = features.findIndex((entry) => entry.featureId === featureId);
    onFeaturesChange(index === -1 ? [...features, next] : features.map((entry, i) => (i === index ? next : entry)));
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <Alert severity="error">{getApiErrorMessage(error, "Failed to load measurements for this product.")}</Alert>
    );
  }

  if (!links || links.length === 0) {
    return <Typography color="text.secondary">This product has no measurements to fill in.</Typography>;
  }

  return (
    <Box sx={{ opacity: isFetching ? 0.6 : 1 }}>
      {fittings && fittings.length > 0 && (
        <Box className="selecting-size" sx={{ mb: 2 }}>
          <Box className="form-group">
            <Typography
              component="label"
              htmlFor="manual-fit-select"
              sx={{ display: "block", fontSize: 12, fontWeight: "bold", mb: 0.5 }}
            >
              Manual Fit
            </Typography>
            <select
              id="manual-fit-select"
              className="searchinput"
              value={selectedFittingId}
              onChange={handleManualFitChange}
              disabled={isFittingLoading}
            >
              <option value="">Select a fit…</option>
              {fittings.map((fitting) => (
                <option key={fitting.id} value={fitting.id}>
                  {fitting.thaiName ? `${fitting.name} (${fitting.thaiName})` : fitting.name}
                </option>
              ))}
            </select>
          </Box>
          {manualFitError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {manualFitError}
            </Alert>
          )}
        </Box>
      )}
      <Box className="step-2styles-NM">
        <Grid container spacing={2} sx={{ width: "100%" }}>
          {/* Two identical header cells, each `sm={6}` — matching the data rows'
              own `xs={12} sm={6}` sizing below, so each side-by-side column of
              measurement cards gets its own aligned header row instead of one
              full-width header sitting above a two-column wrapped layout. */}
          <MeasurementColumnHeader />
          <MeasurementColumnHeader />
          {links.map((link) => {
            const current = value.find((entry) => entry.measurementDefinitionId === link.measurementDefinitionId);
            const total = computeLiveTotal(current?.value, current?.adjustmentValue);
            const label = labelFor(link);
            return (
              <Grid item xs={12} sm={6} key={link.id}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    justifyContent: "space-between",
                    p: "10px 20px",
                    bgcolor: "#fff",
                    borderRadius: "8px",
                    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)",
                    gap: 1,
                  }}
                >
                  <Typography sx={{ flex: 1, fontWeight: "bold", fontSize: 14 }}>{label}</Typography>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="searchinput-measurement"
                    style={{
                      flex: 1,
                      padding: "6px",
                      borderRadius: "5px",
                      border: "1px solid #ccc",
                      outline: "none",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                    aria-label={`${label} value`}
                    value={current?.value ?? ""}
                    onChange={(event) => handleFieldChange(link.measurementDefinitionId, "value", event.target.value)}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className="searchinput-measurement"
                    style={{
                      flex: 1,
                      padding: "6px",
                      borderRadius: "5px",
                      border: "1px solid #ccc",
                      outline: "none",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                    aria-label={`${label} adjustment`}
                    value={current?.adjustmentValue ?? ""}
                    onChange={(event) =>
                      handleFieldChange(link.measurementDefinitionId, "adjustmentValue", event.target.value)
                    }
                  />
                  <input
                    type="number"
                    disabled
                    className="searchinput-measurement"
                    style={{
                      flex: 1,
                      padding: "6px",
                      borderRadius: "5px",
                      border: "1px solid #1C4D8F",
                      background: "#f7f7f7",
                      outline: "none",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                    aria-label={`${label} total`}
                    value={total}
                  />
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      <Box className="form-group" sx={{ mt: 2 }}>
        <Typography component="label" htmlFor="measurement-note" className="note" sx={{ display: "block", fontWeight: "bold" }}>
          Note
        </Typography>
        <textarea
          id="measurement-note"
          className="searchinput"
          style={{ width: "100%", minHeight: 65 }}
          value={measurementNote}
          onChange={(event) => onMeasurementNoteChange(event.target.value)}
        />
      </Box>

      {shoulderTypeFeature && shoulderTypeFeature.styles && shoulderTypeFeature.styles.length > 0 && (
        <Box className="form-group fabric-types_NM">
          <Typography component="h3" className="steper-title">
            {shoulderTypeFeature.thaiName ? `${shoulderTypeFeature.name} (${shoulderTypeFeature.thaiName})` : shoulderTypeFeature.name}
          </Typography>
          <ul className="fabricselection_Common_NM">
            {shoulderTypeFeature.styles.map((style) => {
              const inputId = `shoulder-type-${style.id}`;
              return (
                <li key={style.id}>
                  <input
                    type="radio"
                    name={`shoulder-type-${shoulderTypeFeature.id}`}
                    id={inputId}
                    value={style.id}
                    checked={shoulderTypeSelection?.styleId === style.id}
                    onChange={() => handleShoulderTypeSelect(shoulderTypeFeature.id, style.id)}
                  />
                  <label htmlFor={inputId}>
                    {style.image && <img src={style.image} alt="" />}
                    <p>{style.name}</p>
                  </label>
                </li>
              );
            })}
          </ul>
        </Box>
      )}
    </Box>
  );
}
