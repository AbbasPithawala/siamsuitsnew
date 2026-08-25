import { useEffect } from "react";
import type { SuperProduct } from "../catalog/superProductsApi";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import { useLineItemMeasurementsCompleteness, useProductMeasurementLinksBySlot } from "./LineItemMeasurementsPanel";
import { useLineItemStylingCompleteness } from "./lineItemStylingCompleteness";
import type { LineItemDraft } from "./OrderCartStep";

export interface LineItemCompletenessProbeProps {
  lineItem: LineItemDraft;
  superProduct: SuperProduct;
  onChange: (id: string, complete: boolean) => void;
  onLinksChange: (id: string, linksByComponentId: Record<string, ProductMeasurementLink[]>) => void;
}

/**
 * Extracted from `OrderBuilderPage.tsx` (PHASE_9_TASKS.md Group 8's "Place
 * Order" gate) so `NewGroupOrderPage.tsx` can mount one of these per (child
 * order x line item) too, rather than a second copy of this exact
 * headless-probe pattern. Behavior is unchanged from the original — see the
 * paragraphs below (moved verbatim from `OrderBuilderPage.tsx`'s own doc
 * comment).
 *
 * Reuses Group 6's `useLineItemMeasurementsCompleteness` (the shared
 * measurement entry, checked once per line item) and Group 7's
 * `useLineItemStylingCompleteness` (every unit's required, non-additional,
 * non-render-slot choice features, checked per unit) — the exact same two
 * rules already driving the cart table's own Missing/Complete cells, not a
 * third reimplementation.
 *
 * A headless probe, one instance per line item, rather than computing this
 * inline in the parent page's own body: `OrderCartStep` (which already calls
 * these two hooks once per row, in `LineItemRow`) only mounts while its
 * step/section is actually showing — by the time the user reaches a Review
 * step (or, for the group-order flow, simply scrolls to another child
 * order's card), that subtree (and its hook state) may have unmounted.
 * Mounting one of these per line item regardless of which step/section is
 * showing keeps the gate's answer live no matter what, without duplicating
 * `OrderCartStep`'s rendered UI or lifting its focus/expansion state up.
 *
 * Reports up via a `useEffect` + callback (not a return value) because the
 * parent needs one boolean *per line item*, aggregated across a
 * variable-length, dynamically mounted/unmounted set of probes — the same
 * "can't call a parent's setState synchronously during a child's render"
 * constraint `LineItemMeasurementsPanel.tsx`'s own design note documents for
 * the analogous cross-tree-aggregation problem.
 */
export function LineItemCompletenessProbe({ lineItem, superProduct, onChange, onLinksChange }: LineItemCompletenessProbeProps) {
  const linksBySlot = useProductMeasurementLinksBySlot(superProduct.components);
  const measurementsComplete = useLineItemMeasurementsCompleteness(superProduct.components, lineItem.measurementsDraft);
  const stylingComplete = useLineItemStylingCompleteness(superProduct.components, lineItem.stylingDrafts);
  const complete = measurementsComplete && stylingComplete;

  useEffect(() => {
    onChange(lineItem.id, complete);
  }, [lineItem.id, complete, onChange]);

  useEffect(() => {
    // `linksBySlot` is always a fixed-length-3 array (`useProductMeasurementLinksBySlot`'s own
    // 3-slot rules-of-hooks pattern) — slots past this super product's real component count stay
    // permanently `undefined` (their query is `skip`ped, never fetched), so the "ready" check must
    // only look at the real slots, not all 3, or it can never pass for a 1- or 2-component product.
    if (superProduct.components.some((_component, i) => linksBySlot[i] === undefined)) return;
    const linksByComponentId: Record<string, ProductMeasurementLink[]> = {};
    superProduct.components.forEach((component, i) => {
      linksByComponentId[component.id] = linksBySlot[i] ?? [];
    });
    onLinksChange(lineItem.id, linksByComponentId);
    // linksBySlot's identity changes every render (new RTK Query result objects) even when its
    // actual content hasn't — depending on it directly would re-report on every unrelated render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItem.id, superProduct.components, onLinksChange, JSON.stringify(linksBySlot)]);

  return null;
}
