import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { SuperProduct, SuperProductComponent } from "../catalog/superProductsApi";
import { useProductFeaturesQuery } from "../featureSelector/featuresApi";
import type { FeatureValue, ProductFeature } from "../featureSelector/featuresApi";
import type { MeasurementValue } from "../measurements/MeasurementForm";
import { useProductMeasurementsQuery } from "../measurements/measurementsApi";
import { resolveUploadUrl } from "../uploads/uploadsApi";
import { emptyComponentStylingDraft } from "./StylingAccordion";
import type { LineItemDraft } from "./OrderCartStep";

/**
 * Read-only, human-readable rendering of a not-yet-submitted `LineItemDraft` for the
 * order wizard's Review step — replaces a raw `JSON.stringify(unit, null, 2)` dump (real
 * reported UX bug: retailers saw DB ids and bare arrays/objects instead of names). Deliberately
 * mirrors `OrderDetailPage.tsx`'s own layout (`Measurement`/`Value`/`Adj.`/`Total` and
 * `Feature`/`Selection` tables) rather than inventing a different shape, so what a retailer
 * reviews here looks like what they'll see on the order's real detail page after submitting —
 * name resolution comes from the same per-product catalog queries (`useProductMeasurementsQuery`/
 * `useProductFeaturesQuery`) `<LineItemMeasurementsPanel>`/`<StylingAccordion>` already use for
 * this exact line item, so this is cache-only, no extra network round trips.
 */
export interface LineItemReviewCardProps {
  lineItem: LineItemDraft;
  superProduct: SuperProduct;
}

export function LineItemReviewCard({ lineItem, superProduct }: LineItemReviewCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        {superProduct.name} × {lineItem.stylingDrafts.length}
      </Typography>
      <Stack spacing={2}>
        {superProduct.components.map((component) => {
          const measurementDraft = lineItem.measurementsDraft[component.id];
          return (
            <ComponentReview
              key={component.id}
              component={component}
              measurements={measurementDraft?.measurements ?? []}
              measurementNote={measurementDraft?.measurementNote ?? ""}
              sharedFeatures={measurementDraft?.features ?? []}
              units={lineItem.stylingDrafts.map((unitDraft, index) => ({
                index,
                draft: unitDraft[component.id] ?? emptyComponentStylingDraft(),
              }))}
            />
          );
        })}
      </Stack>
    </Paper>
  );
}

/**
 * Same field, same fallback, as `OrderDetailPage.tsx`'s own `renderFeatureValue` — a
 * `FeatureValue` draft and a server `OrderDetailComponent.features[number]` share this exact
 * shape (`featureId`/`styleId`/`styleOptionId`/`textValue`/`structuredValue`), so the same
 * resolution logic applies verbatim to either.
 */
function renderFeatureValue(feature: ProductFeature | undefined, value: FeatureValue): string {
  if (!feature) return "—";
  if (feature.type === "choice") {
    const style = feature.styles?.find((s) => s.id === value.styleId);
    const option = style?.options.find((o) => o.id === value.styleOptionId);
    return [style?.name, option?.name].filter((v): v is string => Boolean(v)).join(" / ") || "—";
  }
  if (feature.type === "text") {
    return value.textValue ?? "—";
  }
  return value.structuredValue ? JSON.stringify(value.structuredValue) : "—";
}

/** Same total `MeasurementForm.tsx`'s own live Total column and `computeChangedMeasurementDefinitionIds` compute, treating an unset field as 0. */
function liveTotal(value: string | undefined, adjustmentValue: string | undefined): string {
  if (!value && !adjustmentValue) return "—";
  const total = Number(value ?? "0") + Number(adjustmentValue ?? "0");
  return Number.isFinite(total) ? String(total) : "—";
}

interface ComponentReviewProps {
  component: SuperProductComponent;
  measurements: MeasurementValue[];
  measurementNote: string;
  /** The Shoulder Type selection, entered once per line item alongside measurements — merged into each unit's own features table below, exactly how `orderItemBuilder.ts`'s `buildComponentInput` merges it into the real submitted `features[]` (and so exactly how it'll appear on the order's real detail page). */
  sharedFeatures: FeatureValue[];
  units: { index: number; draft: { features: FeatureValue[]; stylingNote: string; referenceImage: string | null } }[];
}

function ComponentReview({ component, measurements, measurementNote, sharedFeatures, units }: ComponentReviewProps) {
  const { data: measurementLinks } = useProductMeasurementsQuery(component.productId);
  const { data: features } = useProductFeaturesQuery(component.productId);
  const featureById = new Map((features ?? []).map((feature) => [feature.id, feature]));

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {component.slotLabel} ({component.product.name})
      </Typography>

      <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
        Measurements
      </Typography>
      {measurements.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No measurements recorded.
        </Typography>
      ) : (
        <TableContainer sx={{ mb: measurementNote ? 1 : 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Measurement</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Adj.</TableCell>
                <TableCell>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {measurements.map((measurement) => {
                const def = measurementLinks?.find(
                  (link) => link.measurementDefinitionId === measurement.measurementDefinitionId
                )?.measurementDefinition;
                return (
                  <TableRow key={measurement.measurementDefinitionId}>
                    <TableCell>{def?.name ?? measurement.measurementDefinitionId}</TableCell>
                    <TableCell>{measurement.value ?? "—"}</TableCell>
                    <TableCell>{measurement.adjustmentValue ?? "—"}</TableCell>
                    <TableCell>{liveTotal(measurement.value, measurement.adjustmentValue)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {measurementNote && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>Measurement note:</strong> {measurementNote}
        </Typography>
      )}

      {units.map(({ index, draft }) => {
        const mergedFeatures = [...draft.features, ...sharedFeatures];
        return (
          <Box key={index} sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
              Unit {index + 1}
            </Typography>
            {mergedFeatures.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No styling selected.
              </Typography>
            ) : (
              <TableContainer sx={{ mb: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Feature</TableCell>
                      <TableCell>Selection</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mergedFeatures.map((value, i) => (
                      <TableRow key={`${value.featureId}-${i}`}>
                        <TableCell>{featureById.get(value.featureId)?.name ?? value.featureId}</TableCell>
                        <TableCell>{renderFeatureValue(featureById.get(value.featureId), value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {draft.stylingNote && (
              <Typography variant="body2" color="text.secondary">
                <strong>Note:</strong> {draft.stylingNote}
              </Typography>
            )}
            {draft.referenceImage && (
              <Box
                component="img"
                src={resolveUploadUrl(draft.referenceImage)}
                alt="Reference"
                sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1, mt: 0.5 }}
              />
            )}
          </Box>
        );
      })}
    </Paper>
  );
}
