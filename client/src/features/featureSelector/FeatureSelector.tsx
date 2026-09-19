import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { getApiErrorMessage } from "../../api/errorUtils";
import { ChoiceFeatureField } from "./ChoiceFeatureField";
import { useProductFeaturesQuery } from "./featuresApi";
import type { FeatureValue, ProductFeature } from "./featuresApi";
import { MonogramFeatureField } from "./MonogramFeatureField";
import type { MonogramStructuredValue } from "./MonogramFeatureField";
import { PipingFeatureField } from "./PipingFeatureField";
import "../../styles/legacyAdmin/MissingFabric.css";

export interface FeatureSelectorProps {
  productId: string;
  value: FeatureValue[];
  onChange: (value: FeatureValue[]) => void;
}

type UpdateFeature = (featureId: string, patch: Omit<FeatureValue, "featureId">) => void;

/**
 * Generic, data-driven styling/features screen for a single product —
 * replaces the legacy `FabricsAndStyling/MissingFabric.jsx` family (one
 * hand-copied block per garment type). Every feature renders purely off its
 * own `type` (`choice`/`text`/`structured`) and `isAdditional`/`renderSlot`
 * fetched from `GET /api/features?productId=...`; this component never
 * branches on which product or super-product it's rendering for.
 *
 * PHASE_9_TASKS.md Group 4 / Decision 4: any feature with a non-null
 * `renderSlot` is excluded from every zone here. Shoulder Type renders
 * elsewhere entirely (on `<MeasurementForm>`, Group 3); Monogram Position is
 * composed into `<MonogramFeatureField>` instead of getting its own tab;
 * Piping renders as its own always-visible swatch-grid section instead of a
 * tab in the "Normal styles" picker (matches legacy — see `PipingFeatureField`'s
 * own doc comment).
 *
 * Fully controlled: `value`/`onChange` own the state, shaped exactly like
 * `POST /api/orders`'s per-component `features[]` array (see
 * `featuresApi.ts`'s `FeatureValue` doc comment), so callers (the Group 7
 * order-builder wizard) can wire this directly into an order draft.
 */
export function FeatureSelector({ productId, value, onChange }: FeatureSelectorProps) {
  const { data: features, isLoading, isError, error } = useProductFeaturesQuery(productId);

  const updateFeature: UpdateFeature = (featureId, patch) => {
    const next: FeatureValue = { featureId, ...patch };
    const index = value.findIndex((entry) => entry.featureId === featureId);
    onChange(index === -1 ? [...value, next] : value.map((entry, i) => (i === index ? next : entry)));
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }
  if (isError) {
    return <Alert severity="error">{getApiErrorMessage(error, "Failed to load styling options.")}</Alert>;
  }
  if (!features || features.length === 0) {
    return <Typography color="text.secondary">This product has no styling options to configure.</Typography>;
  }

  const monogramPositionFeature = features.find((feature) => feature.renderSlot === "monogram_position");
  const pipingFeature = features.find((feature) => feature.renderSlot === "piping");
  // `features` already arrives in `feature_products.sequence_order` from the server
  // (`listFeaturesInTx`, PHASE_8_TASKS.md Group 1) when filtered to one product, as it
  // always is here — no client-side re-sort needed.
  const visible = features.filter((feature) => feature.renderSlot === null);
  const inlineFeatures = visible.filter((feature) => feature.type !== "choice");
  // Fixed section order (Fabric/Lining, then Piping, then Monogram, then the "Normal
  // styles" tab bar) — the real requested layout. `textFeatures` covers Fabric/Lining/any
  // other plain `type: "text"` field (their own mutual order still comes from
  // `sequence_order`, never hardcoded by name); Monogram (`type: "structured"`, the only
  // other inline-zone type) is pulled out of that same loop and rendered in its own fixed
  // slot after Piping instead of wherever it happened to fall in `sequence_order`.
  const textFeatures = inlineFeatures.filter((feature) => feature.type === "text");
  const monogramFeature = inlineFeatures.find((feature) => feature.type === "structured");
  const choiceFeatures = visible.filter((feature) => feature.type === "choice");
  const primaryChoiceFeatures = choiceFeatures.filter((feature) => !feature.isAdditional);
  const additionalChoiceFeatures = choiceFeatures.filter((feature) => feature.isAdditional);
  const pipingValue = pipingFeature ? value.find((entry) => entry.featureId === pipingFeature.id) : undefined;

  return (
    <Box className="fabric-left" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {textFeatures.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {textFeatures.map((feature) => (
            <Box key={feature.id} sx={{ flex: "1 1 200px", minWidth: 200 }}>
              <Typography variant="h6" className="title-fabrics" gutterBottom>
                {feature.thaiName ? `${feature.name} (${feature.thaiName})` : feature.name}
              </Typography>
              <InlineFeatureField
                feature={feature}
                value={value}
                updateFeature={updateFeature}
                monogramPositionFeature={monogramPositionFeature}
              />
            </Box>
          ))}
        </Box>
      )}

      {pipingFeature && (
        <Box>
          <Typography variant="h6" className="title-fabrics" gutterBottom>
            {pipingFeature.thaiName ? `${pipingFeature.name} (${pipingFeature.thaiName})` : pipingFeature.name}
          </Typography>
          <PipingFeatureField
            feature={pipingFeature}
            styleId={pipingValue?.styleId}
            onSelect={(styleId) => updateFeature(pipingFeature.id, { styleId, styleOptionId: undefined })}
          />
        </Box>
      )}

      {monogramFeature && (
        <Box>
          <Typography variant="h6" className="title-fabrics" gutterBottom>
            {monogramFeature.thaiName ? `${monogramFeature.name} (${monogramFeature.thaiName})` : monogramFeature.name}
          </Typography>
          <InlineFeatureField
            feature={monogramFeature}
            value={value}
            updateFeature={updateFeature}
            monogramPositionFeature={monogramPositionFeature}
          />
        </Box>
      )}

      {primaryChoiceFeatures.length > 0 && (
        <Box>
          <Typography variant="h6" className="title-fabrics" gutterBottom>
            Normal styles
          </Typography>
          <ChoiceTabBar key={productId} features={primaryChoiceFeatures} value={value} updateFeature={updateFeature} />
        </Box>
      )}

      {additionalChoiceFeatures.length > 0 && (
        <AdditionalStylesSection key={productId} features={additionalChoiceFeatures} value={value} updateFeature={updateFeature} />
      )}
    </Box>
  );
}

interface InlineFeatureFieldProps {
  feature: ProductFeature;
  value: FeatureValue[];
  updateFeature: UpdateFeature;
  monogramPositionFeature: ProductFeature | undefined;
}

function InlineFeatureField({ feature, value, updateFeature, monogramPositionFeature }: InlineFeatureFieldProps) {
  const current = value.find((entry) => entry.featureId === feature.id);

  if (feature.type === "text") {
    return (
      <TextField
        fullWidth
        label={feature.thaiName ? `${feature.name} / ${feature.thaiName}` : feature.name}
        value={current?.textValue ?? ""}
        onChange={(event) => updateFeature(feature.id, { textValue: event.target.value })}
      />
    );
  }

  // feature.type === "structured" (Monogram) — the only other inline-zone type.
  const monogramPositionValue = monogramPositionFeature
    ? value.find((entry) => entry.featureId === monogramPositionFeature.id)
    : undefined;

  return (
    <MonogramFeatureField
      value={current?.structuredValue as MonogramStructuredValue | undefined}
      onChange={(structuredValue) => updateFeature(feature.id, { structuredValue })}
      position={
        monogramPositionFeature
          ? {
              styles: monogramPositionFeature.styles ?? [],
              selectedStyleId: monogramPositionValue?.styleId,
              onSelect: (styleId) => updateFeature(monogramPositionFeature.id, { styleId, styleOptionId: undefined }),
            }
          : undefined
      }
    />
  );
}

interface AdditionalStylesSectionProps {
  features: ProductFeature[];
  value: FeatureValue[];
  updateFeature: UpdateFeature;
}

/**
 * Legacy `MissingFabric.jsx`'s "Show Additional styles" checkbox + its own
 * separate tab bar (`AdditionalStyles.jsx`), gated on `isAdditional === true`.
 */
function AdditionalStylesSection({ features, value, updateFeature }: AdditionalStylesSectionProps) {
  const [show, setShow] = useState(false);

  return (
    <Box>
      <Box className="title-fabrics" sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
          Additional styles
        </Typography>
        <FormControlLabel
          sx={{ ml: "auto" }}
          control={<Checkbox checked={show} onChange={(event) => setShow(event.target.checked)} />}
          label={<strong>Show Additional styles</strong>}
        />
      </Box>
      {show && <ChoiceTabBar features={features} value={value} updateFeature={updateFeature} />}
    </Box>
  );
}

interface ChoiceTabBarProps {
  features: ProductFeature[];
  value: FeatureValue[];
  updateFeature: UpdateFeature;
}

/**
 * One horizontal MUI `Tabs` bar of `choice` features, matching legacy
 * `Styles.jsx`/`AdditionalStyles.jsx`'s real markup (`.frontbutton-info`) —
 * used for both the primary and the additional-styles bar, each with its own
 * independent tab-index state and its own auto-advance-to-next-tab behavior
 * (`Styles.jsx`'s `advanceToNextTab`): a "final" selection (a leaf style with
 * no sub-options, or a sub-option pick) moves to the next tab; picking a
 * style that merely reveals sub-options does not.
 */
function ChoiceTabBar({ features, value, updateFeature }: ChoiceTabBarProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const boundedIndex = Math.min(tabIndex, features.length - 1);
  const activeFeature = features[boundedIndex];
  const current = activeFeature ? value.find((entry) => entry.featureId === activeFeature.id) : undefined;

  return (
    <Box className="form-group frontbutton-info">
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs variant="scrollable" value={boundedIndex} onChange={(_event, newValue: number) => setTabIndex(newValue)}>
          {features.map((feature) => {
            const entry = value.find((v) => v.featureId === feature.id);
            const isComplete =
              entry?.styleId !== undefined && isFinalChoiceSelection(feature, { styleId: entry.styleId, styleOptionId: entry.styleOptionId });
            return (
              <Tab
                key={feature.id}
                label={feature.name.toUpperCase()}
                sx={
                  isComplete
                    ? {
                        color: "success.contrastText",
                        bgcolor: "success.main",
                        borderRadius: 1,
                        mx: 0.5,
                        "&.Mui-selected": { color: "success.contrastText" },
                      }
                    : undefined
                }
              />
            );
          })}
        </Tabs>
      </Box>
      {activeFeature && (
        // Real ARIA `tabpanel`, paired with the MUI `Tab`s above (standard tabs pattern our own
        // `<Tabs>` didn't previously implement the other half of) — also what lets a caller
        // scope a query to "this tab's own content" specifically, distinct from sibling inline
        // features (e.g. Monogram Position/Font Style, which also render real `role="radio"`
        // elements elsewhere in the same component section and would otherwise be
        // indistinguishable from a choice feature's own style radios).
        <Box role="tabpanel" id={`choice-tabpanel-${activeFeature.id}`} aria-label={activeFeature.name}>
          <ChoiceFeatureField
            feature={activeFeature}
            styleId={current?.styleId}
            styleOptionId={current?.styleOptionId}
            onSelect={(patch) => {
              updateFeature(activeFeature.id, patch);
              if (isFinalChoiceSelection(activeFeature, patch)) {
                setTabIndex((i) => Math.min(i + 1, features.length - 1));
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
}

function isFinalChoiceSelection(feature: ProductFeature, patch: Pick<FeatureValue, "styleId" | "styleOptionId">): boolean {
  if (patch.styleOptionId !== undefined) return true;
  const style = feature.styles?.find((s) => s.id === patch.styleId);
  return !style || style.options.length === 0;
}
