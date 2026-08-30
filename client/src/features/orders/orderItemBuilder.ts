import type { MeasurementValue } from "../measurements/MeasurementForm";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import type { FeatureValue } from "../featureSelector/featuresApi";
import type { SuperProduct, SuperProductComponent } from "../catalog/superProductsApi";
import { createEmptyLineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import type { LineItemComponentMeasurementDraft, LineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
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

/** One customer/cart's shared measurement drafts, keyed by line item id — `OrderBuilderPage.tsx`'s own `LineItemDraft[]` and `NewGroupOrderPage.tsx`'s per-customer `measurementsByLineItem` are both this same shape underneath. */
export type LineItemMeasurementsByLineItemId = Record<string, LineItemMeasurementsDraft>;

/**
 * Real reported bug: a primary product (e.g. "Jacket") is also its own super
 * product, so the same product can appear as a standalone line item *and* as a
 * component slot inside another super product (e.g. "Suit"'s own Jacket slot) —
 * two different cart rows, but physically the same garment for the same
 * customer. Editing the chest measurement on one must update the other too, and
 * vice versa, for every line item that embeds that product anywhere. This
 * broadcasts the just-edited component's full shared draft (measurements, note,
 * Shoulder Type selection, manual size image — `LineItemComponentMeasurementDraft`
 * in full, not just the one field touched) to every component, in every line
 * item, whose `productId` matches the edited component's — including sibling
 * components within the *same* super product (a super product can legitimately
 * have two components pointing at the same product), not only across line items.
 */
export function withSharedMeasurementsSynced(
  measurementsByLineItemId: LineItemMeasurementsByLineItemId,
  lineItems: { id: string; superProductId: string }[],
  superProducts: SuperProduct[],
  editedLineItemId: string,
  editedComponentId: string,
  next: LineItemComponentMeasurementDraft
): LineItemMeasurementsByLineItemId {
  const editedItem = lineItems.find((item) => item.id === editedLineItemId);
  const editedSuperProduct = editedItem && superProducts.find((sp) => sp.id === editedItem.superProductId);
  const editedComponent = editedSuperProduct?.components.find((c) => c.id === editedComponentId);
  const productId = editedComponent?.productId;

  const result: LineItemMeasurementsByLineItemId = { ...measurementsByLineItemId };
  for (const item of lineItems) {
    const superProduct = superProducts.find((sp) => sp.id === item.superProductId);
    if (!superProduct) continue;
    const matchingComponentIds = productId
      ? superProduct.components.filter((c) => c.productId === productId).map((c) => c.id)
      : [];
    if (item.id === editedLineItemId && !matchingComponentIds.includes(editedComponentId)) {
      matchingComponentIds.push(editedComponentId);
    }
    if (matchingComponentIds.length === 0) continue;
    const itemDraft = { ...(result[item.id] ?? {}) };
    for (const componentId of matchingComponentIds) {
      itemDraft[componentId] = next;
    }
    result[item.id] = itemDraft;
  }
  return result;
}

/**
 * The add-time counterpart to `withSharedMeasurementsSynced` above: without this,
 * the shared-measurement invariant only starts holding after the *next* edit —
 * adding "Suit" after "Jacket" already has real measurements would leave the
 * Suit's own Jacket slot blank until something touches it. Seeds each of the new
 * line item's components from the first existing line item (in this same
 * cart/customer) that already has a real draft for a component with the same
 * `productId`, so the invariant holds from the moment the line item is added.
 */
export function seedSharedMeasurementsForNewLineItem(
  newComponents: SuperProductComponent[],
  existingLineItems: { id: string; superProductId: string }[],
  existingMeasurementsByLineItemId: LineItemMeasurementsByLineItemId,
  superProducts: SuperProduct[]
): LineItemMeasurementsDraft {
  const draft = createEmptyLineItemMeasurementsDraft(newComponents);
  for (const component of newComponents) {
    for (const item of existingLineItems) {
      const superProduct = superProducts.find((sp) => sp.id === item.superProductId);
      const match = superProduct?.components.find((c) => c.productId === component.productId);
      if (!match) continue;
      const existingDraft = existingMeasurementsByLineItemId[item.id]?.[match.id];
      if (existingDraft) {
        draft[component.id] = existingDraft;
        break;
      }
    }
  }
  return draft;
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
