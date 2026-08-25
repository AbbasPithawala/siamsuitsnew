import type { MeasurementValue } from "../measurements/MeasurementForm";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import type { FeatureValue } from "../featureSelector/featuresApi";
import type { SuperProduct, SuperProductComponent } from "../catalog/superProductsApi";
import type { LineItemComponentMeasurementDraft } from "./LineItemMeasurementsPanel";
import type { LineItemDraft } from "./OrderCartStep";
import { emptyComponentStylingDraft } from "./StylingAccordion";
import type { UnitStylingDraft } from "./StylingAccordion";
import type { CreateOrderComponentInput, CreateOrderItemInput, EditOrderComponentInput } from "./ordersApi";

/**
 * Extracted from `OrderBuilderPage.tsx` (PHASE_9_TASKS.md Group 7/8,
 * PHASE_10_TASKS.md Workstream E Group 6.3a) so the group-order create flow
 * (`NewGroupOrderPage.tsx`) can build each child order's `items[]` from its
 * own independent cart of `LineItemDraft`s using the exact same
 * denormalize-at-write rules the single-order wizard already established and
 * has real backend test coverage for, rather than a second, drifting
 * reimplementation of this logic. Every function/behavior here is a verbatim
 * move, not a rewrite — see `OrderBuilderPage.tsx`'s own (still-present) doc
 * comments on `handleSubmit`/`buildComponentInput` for the full design
 * rationale each of these implements.
 */

export function emptyMeasurementComponentDraft(): LineItemComponentMeasurementDraft {
  return { measurements: [], measurementNote: "", features: [] };
}

/** `exactOptionalPropertyTypes` forbids assigning `value: undefined` explicitly — these omit the key entirely instead, same shape `sanitizeMeasurements`/`sanitizeFeatures` below produce. */
export function toMeasurementValue(m: {
  measurementDefinitionId: string;
  value: string | null;
  adjustmentValue: string | null;
}): MeasurementValue {
  const value: MeasurementValue = { measurementDefinitionId: m.measurementDefinitionId };
  if (m.value !== null) value.value = m.value;
  if (m.adjustmentValue !== null) value.adjustmentValue = m.adjustmentValue;
  return value;
}

export function toFeatureValue(f: {
  featureId: string;
  styleId: string | null;
  styleOptionId: string | null;
  textValue: string | null;
  structuredValue: unknown;
}): FeatureValue {
  const value: FeatureValue = { featureId: f.featureId };
  if (f.styleId !== null) value.styleId = f.styleId;
  if (f.styleOptionId !== null) value.styleOptionId = f.styleOptionId;
  if (f.textValue !== null) value.textValue = f.textValue;
  if (f.structuredValue !== undefined) value.structuredValue = f.structuredValue;
  return value;
}

/**
 * A product's measurements are never required one-by-one (a product can have
 * 10+ points — chest, sleeve length, etc. — and forcing every one to be
 * touched before the order can proceed is real reported friction, not a
 * fidelity goal). Rather than only submitting whatever the user actually
 * typed (which would silently drop untouched measurement definitions
 * entirely), this backfills every one of the product's *real* linked
 * measurements with an explicit "0"/"0" when the user left it blank — so an
 * order's recorded measurements are always a complete, real snapshot of
 * every point the product defines, not a sparse partial one.
 */
export function sanitizeMeasurements(measurements: MeasurementValue[], links: ProductMeasurementLink[]): MeasurementValue[] {
  const byDefinitionId = new Map(measurements.map((entry) => [entry.measurementDefinitionId, entry]));
  return links.map((link) => {
    const entry = byDefinitionId.get(link.measurementDefinitionId);
    const value = entry?.value?.trim();
    const adjustmentValue = entry?.adjustmentValue?.trim();
    return {
      measurementDefinitionId: link.measurementDefinitionId,
      value: value || "0",
      adjustmentValue: adjustmentValue || "0",
    };
  });
}

export function sanitizeNote(note: string): string | undefined {
  const trimmed = note.trim();
  return trimmed ? trimmed : undefined;
}

export function sanitizeFeatures(features: FeatureValue[]): FeatureValue[] {
  return features
    .map((entry) => {
      const cleaned: FeatureValue = { featureId: entry.featureId };
      if (entry.styleId) cleaned.styleId = entry.styleId;
      if (entry.styleOptionId) cleaned.styleOptionId = entry.styleOptionId;
      const textValue = entry.textValue?.trim();
      if (textValue) cleaned.textValue = textValue;
      if (entry.structuredValue !== undefined) cleaned.structuredValue = entry.structuredValue;
      return cleaned;
    })
    .filter((entry) => entry.styleId || entry.textValue || entry.structuredValue !== undefined);
}

/**
 * The one shared per-(line item x unit x component) field-sanitization step
 * both `OrderBuilderPage.tsx`'s create/edit submit paths (and now
 * `NewGroupOrderPage.tsx`'s per-child-order create path) use — same fields,
 * same sanitization rules, every flow. `manualSizeImage`/`id` are edit-only
 * (`OrderBuilderPage.tsx`'s edit mode); the create paths never populate them,
 * so they're simply always absent there rather than needing a separate
 * create-only variant of this function.
 */
export function buildComponentInput(
  lineItem: LineItemDraft,
  component: SuperProductComponent,
  unitStylingDraft: UnitStylingDraft,
  measurementLinksByComponentId: Record<string, ProductMeasurementLink[]>
): EditOrderComponentInput {
  const measurementDraft = lineItem.measurementsDraft[component.id] ?? emptyMeasurementComponentDraft();
  const unitComponentDraft = unitStylingDraft[component.id] ?? emptyComponentStylingDraft();
  const measurementNote = sanitizeNote(measurementDraft.measurementNote);
  const stylingNote = sanitizeNote(unitComponentDraft.stylingNote);
  const features = sanitizeFeatures([...unitComponentDraft.features, ...measurementDraft.features]);
  const measurementLinks = measurementLinksByComponentId[component.id] ?? [];
  return {
    superProductComponentId: component.id,
    measurements: sanitizeMeasurements(measurementDraft.measurements, measurementLinks),
    features,
    ...(measurementNote !== undefined ? { measurementNote } : {}),
    ...(stylingNote !== undefined ? { stylingNote } : {}),
    ...(unitComponentDraft.referenceImage ? { referenceImage: unitComponentDraft.referenceImage } : {}),
    ...(measurementDraft.manualSizeImage ? { manualSizeImage: measurementDraft.manualSizeImage } : {}),
    ...(unitComponentDraft.id ? { id: unitComponentDraft.id } : {}),
  };
}

/**
 * The concrete implementation of Decision 3's denormalize-at-write design:
 * one full `CreateOrderItemInput` per physical unit (never a `quantity`
 * field). For each line item's each unit, every component's
 * `measurements`/`measurementNote` are copied **verbatim** from the line
 * item's one shared draft; `features` merges that unit's own styling choices
 * with the shared draft's Shoulder Type selection; `stylingNote`/
 * `referenceImage` come from the unit's own draft alone — see
 * `buildComponentInput`'s doc comment.
 *
 * `measurementLinksByLineItemId` mirrors `OrderBuilderPage.tsx`'s own
 * `lineItemMeasurementLinks` state shape (line item id -> component id ->
 * that component's real measurement-definition links) — every caller (the
 * single-order wizard, and `NewGroupOrderPage.tsx`'s per-child-order carts)
 * gathers this the same way, via one `LineItemCompletenessProbe` mounted per
 * line item.
 */
export function buildOrderItemsFromLineItems(
  lineItems: LineItemDraft[],
  superProducts: SuperProduct[],
  measurementLinksByLineItemId: Record<string, Record<string, ProductMeasurementLink[]>>
): CreateOrderItemInput[] {
  const items: CreateOrderItemInput[] = [];
  for (const lineItem of lineItems) {
    const superProduct = superProducts.find((sp) => sp.id === lineItem.superProductId);
    if (!superProduct) continue;

    const measurementLinksByComponentId = measurementLinksByLineItemId[lineItem.id] ?? {};
    for (const unitStylingDraft of lineItem.stylingDrafts) {
      const components: CreateOrderComponentInput[] = superProduct.components.map((component) =>
        buildComponentInput(lineItem, component, unitStylingDraft, measurementLinksByComponentId)
      );
      items.push({ superProductId: lineItem.superProductId, components });
    }
  }
  return items;
}
