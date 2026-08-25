import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { MeasurementForm } from "../measurements/MeasurementForm";
import type { MeasurementValue } from "../measurements/MeasurementForm";
import { useProductMeasurementsQuery } from "../measurements/measurementsApi";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import { useGetCustomerMeasurementProfileQuery } from "../measurements/measurementProfilesApi";
import type { CustomerMeasurementProfileValue } from "../measurements/measurementProfilesApi";
import type { FeatureValue } from "../featureSelector/featuresApi";
import type { SuperProductComponent } from "../catalog/superProductsApi";

/**
 * PHASE_9_TASKS.md Decision 3: one measurement entry per (line item ×
 * component), shared across every one of that line item's N units — this is
 * the shape Group 7's cart draft stores per component, keyed by
 * `SuperProductComponent.id` (stable regardless of unit index, since there is
 * no unit index here at all).
 */
export interface LineItemComponentMeasurementDraft {
  measurements: MeasurementValue[];
  /** PHASE_9_TASKS.md Decision 5 — distinct from the per-unit `stylingNote` Group 5's accordion owns. */
  measurementNote: string;
  /**
   * The shared `FeatureValue[]` slice for this component (Decision 3's
   * consequence for Decision 4): in practice this only ever carries the
   * Shoulder Type selection `<MeasurementForm>` renders below its grid — no
   * other feature is ever written here, since styling lives per-unit in
   * Group 5's accordion instead.
   */
  features: FeatureValue[];
  /**
   * PHASE_10_TASKS.md Workstream E Group 6.1/6.3c — the URL the Manual Size
   * annotation editor's rasterized-and-uploaded diagram returns, shared per
   * line item exactly like `measurementNote` above (same
   * `order_item_components.manual_size_image` denormalization mechanism,
   * copied verbatim into every sibling unit's component at submit time).
   */
  manualSizeImage?: string;
}

/** Keyed by `SuperProductComponent.id`, one entry per the super product's real components. */
export type LineItemMeasurementsDraft = Record<string, LineItemComponentMeasurementDraft>;

function emptyComponentDraft(): LineItemComponentMeasurementDraft {
  return { measurements: [], measurementNote: "", features: [] };
}

/** Group 7 uses this to seed a new line item's shared draft when a super product is first added to the cart. */
export function createEmptyLineItemMeasurementsDraft(components: SuperProductComponent[]): LineItemMeasurementsDraft {
  const draft: LineItemMeasurementsDraft = {};
  for (const component of components) {
    draft[component.id] = emptyComponentDraft();
  }
  return draft;
}

export interface LineItemMeasurementsPanelProps {
  /** The chosen super product's real components (1-3, `superProducts.service.ts`'s `MAX_COMPONENTS`), e.g. jacket+pant for a Suit. */
  components: SuperProductComponent[];
  draft: LineItemMeasurementsDraft;
  onChange: (componentId: string, next: LineItemComponentMeasurementDraft) => void;
  /**
   * PHASE_10_TASKS.md Workstream D Group 3: known by the time this panel can
   * ever be reached (the wizard's Customer step precedes its Products step,
   * `OrderBuilderPage.tsx`) — `null` only in the edge case of a
   * retailer/customer selection being cleared out from under an
   * already-open Products step, in which case pre-fill is simply skipped,
   * same as "no profile yet."
   */
  customerId: string | null;
  /**
   * PHASE_10_TASKS.md Workstream E Group 6.3c — present only when this panel
   * is hosted inside the admin edit wizard (`orders.edit`); opens the Manual
   * Size annotation editor for the given component. Absent in the ordinary
   * order-creation instantiation of this same component (`OrderCartStep`
   * inside `OrderBuilderPage.tsx`'s create mode) — an optional prop, not a
   * hardcoded create-vs-edit branch, so this stays the one real
   * `<LineItemMeasurementsPanel>` for both flows (per this doc's own
   * "reuse, don't rebuild" direction) with the Manual Size entry point
   * simply not rendered when the caller doesn't pass it.
   */
  onOpenManualSize?: (component: SuperProductComponent) => void;
}

/**
 * A super product has at most `MAX_COMPONENTS` (3, `superProducts.service.ts`)
 * real components — so this calls `useProductMeasurementsQuery` a fixed 3
 * times, unconditionally, one per possible slot (`skip`ped past the real
 * `components.length`), rather than inside a loop/`.map()` callback, which
 * would violate rules-of-hooks. RTK Query dedupes each of these against
 * whatever `<MeasurementForm>` below already queries for the same productId
 * — no real extra network round trip.
 *
 * Exported so `OrderBuilderPage.tsx`'s submit-time assembly can read the
 * same real measurement-definition list `useLineItemMeasurementsCompleteness`
 * below already fetches, to backfill any measurement the user never touched
 * with a real "0" value at submit time (per explicit product decision: a
 * product's measurements are never required one-by-one — see that
 * function's own doc comment).
 */
export function useProductMeasurementLinksBySlot(
  components: SuperProductComponent[]
): (ProductMeasurementLink[] | undefined)[] {
  const component0 = components[0];
  const component1 = components[1];
  const component2 = components[2];
  const query0 = useProductMeasurementsQuery(component0?.productId ?? "", { skip: !component0 });
  const query1 = useProductMeasurementsQuery(component1?.productId ?? "", { skip: !component1 });
  const query2 = useProductMeasurementsQuery(component2?.productId ?? "", { skip: !component2 });
  return [query0.data, query1.data, query2.data];
}

/**
 * Deliberately does NOT require every one of a product's measurements to be
 * individually filled in — a product can have 10+ measurement points (chest,
 * sleeve length, etc.), and forcing the user to touch every single one
 * before they can move on is real, reported friction, not a fidelity goal.
 * Any measurement the user never touches is silently recorded as "0" at
 * submit time (`OrderBuilderPage.tsx`'s `sanitizeMeasurements`), not left
 * blank/omitted and not blocking. This "completeness" check therefore only
 * confirms the product's real measurement catalog has actually loaded (so
 * the panel isn't gating on stale/not-yet-fetched data) — once that's true,
 * the line item's measurements are always considered complete, regardless of
 * how many fields the user actually entered.
 */
export function useLineItemMeasurementsCompleteness(
  components: SuperProductComponent[],
  _draft: LineItemMeasurementsDraft
): boolean {
  const linksBySlot = useProductMeasurementLinksBySlot(components);
  return components.every((_component, i) => linksBySlot[i] !== undefined);
}

/**
 * PHASE_9_TASKS.md Group 6: the per-line-item Measurements panel — entered
 * exactly once regardless of the line item's quantity (Decision 3), hosting
 * one `<MeasurementForm>` per the super product's real components. This is
 * the same "iterate over whichever components the super product actually
 * has" generic pattern `OrderComponentStep.tsx` already established, just
 * invoked once per line item instead of once per (line item × unit) —
 * deliberately not wrapped in Group 5's per-unit Styling accordion, and
 * rendered on its own, not inside a modal (per `PHASE_8_TASKS.md`'s
 * "same page instead of modal" direction).
 *
 * Fully controlled: no internal state duplicates `draft` — every keystroke
 * produces a new per-component draft via `onChange`, immutably derived from
 * the current prop value, same shape `OrderComponentStep`/`MeasurementForm`
 * already use. Group 7 owns the actual draft state (and, at submit time,
 * copies this shared draft verbatim into every one of the line item's N
 * sibling units' components, per Decision 3).
 */
export function LineItemMeasurementsPanel({ components, draft, onChange, customerId, onOpenManualSize }: LineItemMeasurementsPanelProps) {
  const complete = useLineItemMeasurementsCompleteness(components, draft);

  return (
    <Paper variant="outlined" sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Measurements</Typography>
        <Typography
          component="span"
          sx={{ fontWeight: 600, color: complete ? "green" : "red" }}
        >
          {complete ? "Complete" : "Missing"}
        </Typography>
      </Box>
      {components.map((component, index) => {
        const componentDraft = draft[component.id] ?? emptyComponentDraft();
        return (
          <Box key={component.id}>
            {/*
             * `component="span"` (not the `Box` default `div`) deliberately —
             * `OrderBuilderPage.live.test.tsx`'s `fillMeasurementValues`
             * locates this component's measurement inputs via
             * `heading.closest("div")`, relying on this heading's nearest
             * real `<div>` ancestor being the outer per-component `Box` below
             * (which also contains `ComponentMeasurementsSection`'s inputs as
             * a sibling) — a `<div>` wrapper here would shadow that outer one
             * and break that lookup, confirmed by an actual regression run.
             */}
            <Box component="span" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="subtitle1" gutterBottom>
                {component.slotLabel}{" "}
                <Typography component="span" variant="body2" color="text.secondary">
                  ({component.product.name})
                </Typography>
              </Typography>
              {onOpenManualSize && (
                <Button size="small" variant="outlined" onClick={() => onOpenManualSize(component)}>
                  {componentDraft.manualSizeImage ? "Edit Manual Size" : "Add Manual Size"}
                </Button>
              )}
            </Box>
            <ComponentMeasurementsSection
              component={component}
              componentDraft={componentDraft}
              customerId={customerId}
              onChange={(next) => onChange(component.id, next)}
            />
            {index < components.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        );
      })}
    </Paper>
  );
}

function toProfileMeasurementValue(entry: CustomerMeasurementProfileValue): MeasurementValue {
  const value: MeasurementValue = { measurementDefinitionId: entry.measurementDefinitionId };
  if (entry.value !== null) value.value = entry.value;
  if (entry.adjustmentValue !== null) value.adjustmentValue = entry.adjustmentValue;
  return value;
}

interface ComponentMeasurementsSectionProps {
  component: SuperProductComponent;
  componentDraft: LineItemComponentMeasurementDraft;
  customerId: string | null;
  onChange: (next: LineItemComponentMeasurementDraft) => void;
}

/**
 * PHASE_10_TASKS.md Workstream D Group 3: this component's own instance —
 * one per real component, via the `.map()` above, each with its own stable
 * hook calls (same rules-of-hooks reasoning `LineItemRow`/
 * `LineItemCompletenessProbe` already document in `OrderCartStep.tsx`/
 * `OrderBuilderPage.tsx`) — is what actually fetches and applies this
 * component's real customer measurement profile, at the same place
 * `<MeasurementForm>` is assembled for it.
 *
 * Seeds `componentDraft.measurements` from the profile's real values, once,
 * via a `useEffect` that calls the `onChange` prop — deliberately **not**
 * `ManageLinkedItemsDialog`'s `key`-remount + `useState(initialValue)`
 * pattern, even though that's this project's own established "seed once"
 * precedent, because that pattern only fits a component that owns an edited
 * *local* copy and flushes it out on an explicit Save click.
 * `<MeasurementForm>` has no local copy at all (fully controlled, per its
 * own doc comment), and the value that actually needs seeding —
 * `LineItemComponentMeasurementDraft.measurements`, owned several components
 * up in `OrderBuilderPage.tsx` — has no "Save" moment to piggyback on.
 * Calling `onChange` directly during *this* component's own render (to
 * avoid `useEffect` altogether) was tried and empirically confirmed, against
 * this project's real React 19 install, to trip React's own "Cannot update a
 * component while rendering a different component" warning — the render-purity
 * violation `key`/`useState(initialValue)` exists to prevent for *local*
 * state, not something that mechanism can avoid here, since the state being
 * written is an ancestor's. A `useEffect` that calls a prop (never a local
 * `useState` setter) is this codebase's own established, lint-clean shape for
 * exactly this "descendant reports resolved query data up to an ancestor"
 * case — `OrderBuilderPage.tsx`'s `LineItemCompletenessProbe` already does
 * the identical thing for measurement links — and this project's
 * `react-hooks/set-state-in-effect` rule does not flag it, structurally
 * cannot, since no local `useState` setter is ever called here.
 *
 * Self-terminating with no extra "already seeded" flag needed: the guard
 * (`componentDraft.measurements.length === 0`) is only ever true before the
 * very first real entry lands — the seed itself pushes real entries into
 * that array, so every later run of this effect (including a profile
 * refetch, or this component simply re-rendering for an unrelated reason)
 * fails the guard and no-ops. It also naturally loses to a user who starts
 * typing before the profile query resolves — their own entry already fails
 * the guard first, so a slow profile fetch can never clobber real user input.
 *
 * Gated behind a loading check while the profile query is in flight (not
 * merely relying on the effect's own guard): rendering `<MeasurementForm>`
 * immediately with a still-empty `componentDraft.measurements` and only
 * seeding a render or two later is functionally correct (no data loss, no
 * lock-in — every render recomputes from live props, nothing is captured
 * once) but produces a visible empty-then-populated flash; this avoids it,
 * and directly matches this session's own standing guidance to treat
 * "renders before its query resolves" as a real, not just theoretical, bug
 * class in this codebase.
 */
function ComponentMeasurementsSection({ component, componentDraft, customerId, onChange }: ComponentMeasurementsSectionProps) {
  const { data: profile, isLoading: profileLoading } = useGetCustomerMeasurementProfileQuery(
    { customerId: customerId ?? "", productId: component.productId },
    { skip: !customerId }
  );

  useEffect(() => {
    if (!profile || profile.values.length === 0) return;
    if (componentDraft.measurements.length > 0) return;
    onChange({ ...componentDraft, measurements: profile.values.map(toProfileMeasurementValue) });
  }, [profile, componentDraft, onChange]);

  if (customerId && profileLoading) {
    return <LoadingSpinner />;
  }

  return (
    <MeasurementForm
      productId={component.productId}
      value={componentDraft.measurements}
      onChange={(measurements) => onChange({ ...componentDraft, measurements })}
      measurementNote={componentDraft.measurementNote}
      onMeasurementNoteChange={(measurementNote) => onChange({ ...componentDraft, measurementNote })}
      features={componentDraft.features}
      onFeaturesChange={(features) => onChange({ ...componentDraft, features })}
    />
  );
}
