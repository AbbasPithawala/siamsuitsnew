import { useProductFeaturesQuery } from "../featureSelector/featuresApi";
import type { SuperProductComponent } from "../catalog/superProductsApi";
import type { UnitStylingDraft } from "./StylingAccordion";

/**
 * PHASE_9_TASKS.md Group 7's "Fabric & Styling" cart-table column derives its
 * Missing/Complete status from the same rule Group 8's future validation
 * gate is specced to enforce ("any of its units has any linked `choice`
 * feature with `isAdditional === false && isRequired === true` left
 * unselected"): every physical unit's every non-additional, required choice
 * feature must have a selection. Implemented here (not left for Group 8,
 * which doesn't exist yet) because the cart table needs *some* real
 * Missing/Complete value the moment a line item is added, not a placeholder.
 *
 * `renderSlot !== null` features (Shoulder Type/Monogram Position) are
 * excluded belt-and-suspenders, per Decision 4 — both already ship with
 * `isRequired = false` (Group 0), but this filters structurally too, exactly
 * like Group 8's own spec calls for.
 *
 * Same "fixed 3 unconditional hook calls, one per possible component slot"
 * shape `useLineItemMeasurementsCompleteness` (Group 6) already uses, for the
 * same rules-of-hooks reason (a variable number of real components can't
 * drive a variable number of hook calls) — `MAX_COMPONENTS = 3`
 * (`superProducts.service.ts`).
 */
export function useLineItemStylingCompleteness(
  components: SuperProductComponent[],
  stylingDrafts: UnitStylingDraft[]
): boolean {
  const component0 = components[0];
  const component1 = components[1];
  const component2 = components[2];
  const query0 = useProductFeaturesQuery(component0?.productId ?? "", { skip: !component0 });
  const query1 = useProductFeaturesQuery(component1?.productId ?? "", { skip: !component1 });
  const query2 = useProductFeaturesQuery(component2?.productId ?? "", { skip: !component2 });
  const queriesBySlot = [query0, query1, query2];

  if (stylingDrafts.length === 0) return false;

  for (let ci = 0; ci < components.length; ci++) {
    const component = components[ci]!;
    const features = queriesBySlot[ci]?.data;
    if (!features) return false;
    const requiredFeatures = features.filter(
      (feature) => feature.type === "choice" && !feature.isAdditional && feature.isRequired && feature.renderSlot === null
    );
    if (requiredFeatures.length === 0) continue;

    for (const unitDraft of stylingDrafts) {
      const selected = unitDraft[component.id]?.features ?? [];
      for (const requiredFeature of requiredFeatures) {
        const entry = selected.find((value) => value.featureId === requiredFeature.id);
        if (!entry?.styleId) return false;
      }
    }
  }
  return true;
}
