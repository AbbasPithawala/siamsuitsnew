import { useCallback, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { useListSuperProductsQuery } from "../catalog/superProductsApi";
import { useListCustomersByRetailerQuery } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { CustomerQuickCreateDialog } from "./CustomerQuickCreateDialog";
import { OrderCartStep, createLineItemDraft } from "./OrderCartStep";
import type { LineItemDraft } from "./OrderCartStep";
import { createEmptyLineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import type { LineItemComponentMeasurementDraft } from "./LineItemMeasurementsPanel";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import { emptyComponentStylingDraft, emptyUnitStylingDraft } from "./StylingAccordion";
import type { ComponentStylingDraft, UnitStylingDraft } from "./StylingAccordion";
import { LineItemCompletenessProbe } from "./LineItemCompletenessProbe";
import {
  buildComponentInput,
  buildOrderItemsFromLineItems,
  emptyMeasurementComponentDraft,
  seedSharedMeasurementsForNewLineItem,
  toFeatureValue,
  toMeasurementValue,
  withSharedMeasurementsSynced,
} from "./orderItemBuilder";
import { LineItemReviewCard } from "./LineItemReviewCard";
import { ManualSizeEditor } from "./ManualSizeEditor";
import { useCreateOrderMutation, useEditOrderMutation, useGetOrderQuery } from "./ordersApi";
import type { CreateOrderInput, CreatedOrder, EditOrderItemInput } from "./ordersApi";
import type { SuperProductComponent } from "../catalog/superProductsApi";

const STEP_LABELS = ["Retailer", "Customer", "Products", "Review"];
const RETAILER_STEP = 0;
const CUSTOMER_STEP = 1;
const PRODUCTS_STEP = 2;
const REVIEW_STEP = 3;

function customerName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

/**
 * `LineItemCompletenessProbe` (Group 8's "Place Order" gate) and the
 * `sanitize*`/`toMeasurementValue`/`toFeatureValue`/`buildComponentInput`/
 * `buildOrderItemsFromLineItems` helpers this page's submit paths use now
 * live in `LineItemCompletenessProbe.tsx`/`orderItemBuilder.ts` respectively
 * — extracted, not rewritten, so `NewGroupOrderPage.tsx`'s per-child-order
 * carts can reuse the exact same completeness gate and item-building rules
 * instead of a second, drifting implementation. See those files' own doc
 * comments for the full rationale (moved verbatim from here).
 */

/**
 * The Phase 9 Group 7 capstone: a multi-line-item cart (`OrderCartStep`,
 * composing Group 6's per-line-item `<LineItemMeasurementsPanel>` and Group
 * 5's per-unit `<StylingAccordion>`) replaces the old single-super-product,
 * no-quantity flow. This page owns exactly the state Decision 1 calls for:
 * one `LineItemDraft` per cart row (`measurementsDraft`, shared once per line
 * item, plus `stylingDrafts: UnitStylingDraft[]`, one entry per physical
 * unit) — `quantity` is never its own field, always `stylingDrafts.length`.
 *
 * **Step order deliberately differs from the task doc's literal (1)
 * customer, (2) retailer listing.** `customers.service.ts`'s
 * `createCustomer` calls `requireRetailer` — creating (and, by construction
 * of this UI, searching within) a customer needs a `retailerId` first. So
 * this wizard asks for the retailer before the customer; the task doc's own
 * text flags this exact tension ("consider whether Step 1 and Step 2 need
 * reordering... if the real API dependency requires it"), and it does.
 *
 * **Gating**: the whole route is wrapped in `RequirePermission
 * permission="orders.create"` in `AppRoutes.tsx` (page-level, not
 * button-level) — unlike the Group 1-3 catalog pages, this page has no
 * meaningful read-only mode: its only purpose is the `orders.create`-gated
 * submit action, so hiding the whole page for a user who lacks it matches
 * the Group 4 RBAC-admin-page precedent, not the catalog pages' open-page
 * pattern. `isRush` is additionally gated by `orders.rush`
 * (`orders.routes.ts`'s `assertPermission`) — the rush toggle only renders
 * for actors who actually hold that permission, rather than letting them
 * check it and hit a 403 on submit.
 *
 * **Repeat-order entry point (PHASE_6_TASKS.md Group 6, re-hosted here for
 * the multi-line-item cart shape):** `OrderDetailPage`'s "Repeat this order"
 * button navigates here with `?repeatOfOrderId=<id>` in the URL. On mount,
 * once the source order and the super product catalog have both loaded, this
 * page groups the source order's `items[]` by `superProductId` (a repeat
 * source can legitimately have several sibling `order_items` sharing one
 * super product, from the original order's quantity>1 line item) — each
 * group becomes one prefilled `LineItemDraft`, `stylingDrafts.length`
 * matching the group's real size. The shared measurement draft is seeded
 * from the group's first item's components (Decision 3: every sibling's
 * measurements are byte-identical by construction, so any one is
 * representative); the render-slot Shoulder Type selection is deliberately
 * **not** split back out of each unit's flat `features[]` into the shared
 * draft here (that would need a feature-catalog lookup this synchronous,
 * render-time prefill doesn't have easy access to) — it round-trips forward
 * unchanged as part of each unit's own `stylingDrafts` entry instead (already
 * true of the pre-Group-7 code, which never split shared-vs-per-unit data at
 * all), so no data is lost, only its shared/per-unit *classification* during
 * a follow-up edit session, which is purely organizational.
 * `repeatOfOrderId` is still included on the actual submitted
 * `CreateOrderInput` alongside the (possibly-edited) line items — the
 * backend re-validates those against the *current* catalog via
 * `resolveItemsFromInput` either way.
 *
 * **Edit mode (PHASE_10_TASKS.md Workstream E Group 6.3b), re-hosted in this
 * same component rather than a parallel page:** when this page is mounted at
 * `/orders/:id/edit` (`AppRoutes.tsx`), `useParams` supplies a real `id` —
 * absent on `/orders/new`, where `id` is simply `undefined` — and
 * `isEditMode` below switches on that alone. This was the deliberate choice
 * over a second copy of the stepper: the Products/Review steps
 * (`OrderCartStep`/`LineItemMeasurementsPanel`/`StylingAccordion`, the exact
 * components 6.3b calls out) are 100% shared code paths with zero
 * duplication, and the only genuinely different behavior — where the initial
 * `lineItems`/`retailerId`/`customerId` come from, and which mutation
 * `handleSubmit` calls — is a handful of `isEditMode` branches localized to
 * this file, not a second implementation of the cart/measurements/styling UI
 * itself. The Retailer/Customer steps (0/1) are real `STEP_LABELS` entries
 * still, left unchanged and un-rendered-into in edit mode (an order's
 * customer is immutable via this route; retailer reassignment is
 * `OrderDetailPage.tsx`'s own separate, narrower action) — edit mode simply
 * starts `activeStep` at `PRODUCTS_STEP` and disables "Back" past it, rather
 * than special-casing the Stepper's own rendering.
 */
export function OrderBuilderPage() {
  const [searchParams] = useSearchParams();
  const repeatOfOrderId = searchParams.get("repeatOfOrderId");
  const { id: editOrderId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editOrderId);
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(isEditMode ? PRODUCTS_STEP : 0);
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [isRush, setIsRush] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [appliedRepeatSourceId, setAppliedRepeatSourceId] = useState<string | null>(null);
  const [appliedEditSourceId, setAppliedEditSourceId] = useState<string | null>(null);
  const [appliedMeRetailerId, setAppliedMeRetailerId] = useState<string | null>(null);
  const [lineItemCompleteness, setLineItemCompleteness] = useState<Record<string, boolean>>({});
  const [lineItemMeasurementLinks, setLineItemMeasurementLinks] = useState<
    Record<string, Record<string, ProductMeasurementLink[]>>
  >({});
  const [manualSizeTarget, setManualSizeTarget] = useState<{ lineItemId: string; component: SuperProductComponent } | null>(
    null
  );

  const canManageCustomers = useHasPermission("customers.manage");
  const canRush = useHasPermission("orders.rush");

  const { data: me } = useMeQuery();
  const { data: retailers, isLoading: retailersLoading, isError: retailersError, error: retailersErrorObj } =
    useListRetailersQuery();
  const {
    data: customers,
    isLoading: customersLoading,
    isError: customersErrorFlag,
    error: customersErrorObj,
  } = useListCustomersByRetailerQuery(retailerId ?? "", { skip: !retailerId });
  const { data: editSource, isLoading: editSourceLoading, isError: editSourceError, error: editSourceErrorObj } =
    useGetOrderQuery(editOrderId ?? "", { skip: !isEditMode });
  const [editOrder, editOrderState] = useEditOrderMutation();
  const { data: superProducts, isLoading: superProductsLoading, isError: superProductsError, error: superProductsErrorObj } =
    useListSuperProductsQuery();
  const { data: repeatSource } = useGetOrderQuery(repeatOfOrderId ?? "", { skip: !repeatOfOrderId });
  const [createOrder, createOrderState] = useCreateOrderMutation();

  const selectedRetailer = retailers?.find((retailer) => retailer.id === retailerId) ?? null;
  const selectedCustomer = customers?.find((customer) => customer.id === customerId) ?? null;

  /**
   * A retailer-linked session never sees the Retailer step's content (the
   * auto-select block above jumps straight past it) — showing an already-
   * checked "Retailer" circle in the bar for a step nobody ever interacts
   * with is confusing, not reassuring. Drop it from the *displayed* bar only;
   * `activeStep`/`RETAILER_STEP`/etc. stay the real, unshifted step indices
   * everywhere else in this file (Back/Next, the `canProceed` map, the
   * `activeStep === X` content switches) so this is purely a rendering
   * concern, not a renumbering of the wizard itself. Clamped at 0 for the
   * repeat-order flow, where `activeStep` can still be `RETAILER_STEP` for a
   * retailer-linked session (that block deliberately skips the auto-jump —
   * see its own doc comment) — never negative, just falls back to
   * highlighting the first visible step.
   */
  const stepLabels = me?.retailerId ? STEP_LABELS.slice(1) : STEP_LABELS;
  const displayActiveStep = me?.retailerId ? Math.max(0, activeStep - 1) : activeStep;

  /**
   * React's own "adjusting state when a prop/query result changes" pattern
   * (see "You Might Not Need an Effect" in the React docs) rather than a
   * `useEffect` — runs once, exactly when the repeat source order (and the
   * super product catalog needed to resolve its components) first finishes
   * loading. Matches each order component back to its super product
   * component by `slotLabel` (the only correlation key available:
   * `order_item_components` has no FK back to `super_product_components`,
   * see `orders.service.ts`'s `ResolvedComponent`), leaving any slot the
   * source order doesn't have an empty draft rather than failing.
   */
  if (repeatOfOrderId && repeatSource && superProducts && appliedRepeatSourceId !== repeatSource.id) {
    setAppliedRepeatSourceId(repeatSource.id);
    setRetailerId(repeatSource.retailerId);
    setCustomerId(repeatSource.customerId);

    const itemsBySuperProduct = new Map<string, typeof repeatSource.items>();
    for (const item of repeatSource.items) {
      const group = itemsBySuperProduct.get(item.superProductId) ?? [];
      group.push(item);
      itemsBySuperProduct.set(item.superProductId, group);
    }

    const prefilledLineItems: LineItemDraft[] = [];
    for (const [superProductId, sourceItems] of itemsBySuperProduct) {
      const superProduct = superProducts.find((sp) => sp.id === superProductId);
      if (!superProduct) continue;

      const measurementsDraft = createEmptyLineItemMeasurementsDraft(superProduct.components);
      const firstItem = sourceItems[0]!;
      for (const spComponent of superProduct.components) {
        const match = firstItem.components.find((c) => c.slotLabel === spComponent.slotLabel);
        if (match) {
          const componentMeasurementsDraft: LineItemComponentMeasurementDraft = {
            measurements: match.measurements.map(toMeasurementValue),
            measurementNote: match.measurementNote ?? "",
            features: [],
          };
          if (match.manualSizeImage) componentMeasurementsDraft.manualSizeImage = match.manualSizeImage;
          measurementsDraft[spComponent.id] = componentMeasurementsDraft;
        }
      }

      const stylingDrafts: UnitStylingDraft[] = sourceItems.map((sourceItem) => {
        const unitDraft = emptyUnitStylingDraft(superProduct.components);
        for (const spComponent of superProduct.components) {
          const match = sourceItem.components.find((c) => c.slotLabel === spComponent.slotLabel);
          const componentDraft: ComponentStylingDraft = match
            ? {
                features: match.features.map(toFeatureValue),
                stylingNote: match.stylingNote ?? "",
                referenceImage: match.referenceImage,
              }
            : emptyComponentStylingDraft();
          unitDraft[spComponent.id] = componentDraft;
        }
        return unitDraft;
      });

      prefilledLineItems.push({
        id: crypto.randomUUID(),
        superProductId,
        measurementsDraft,
        stylingDrafts,
      });
    }
    setLineItems(prefilledLineItems);
  }

  /**
   * PHASE_10_TASKS.md Workstream E Group 6.3b — the edit-mode counterpart of
   * the repeat-source prefill above, same "adjust state when a query result
   * changes" shape, same `slotLabel` correlation for matching a real order's
   * components back to the super product's own component slots. The one real
   * difference: this keeps each real `order_items.id`/`order_item_components.id`
   * (`sourceItem.id`/`match.id`) on the seeded draft — `ComponentStylingDraft.id`/
   * `.orderItemId` — so `handleSubmit`'s edit branch below can submit them back
   * and the server updates these exact rows in place (`PATCH /orders/:id`'s real
   * reconciliation, Group 6.2) instead of creating duplicates. A brand new
   * line item/unit added during this edit session naturally has no such ids
   * (`createLineItemDraft`/`emptyUnitStylingDraft`, both id-less), so it's
   * submitted exactly like a create-flow addition — the server treats it as
   * new for exactly that reason.
   */
  if (isEditMode && editSource && superProducts && appliedEditSourceId !== editSource.id) {
    setAppliedEditSourceId(editSource.id);
    setRetailerId(editSource.retailerId);
    setCustomerId(editSource.customerId);

    const itemsBySuperProduct = new Map<string, typeof editSource.items>();
    for (const item of editSource.items) {
      const group = itemsBySuperProduct.get(item.superProductId) ?? [];
      group.push(item);
      itemsBySuperProduct.set(item.superProductId, group);
    }

    const prefilledLineItems: LineItemDraft[] = [];
    for (const [superProductId, sourceItems] of itemsBySuperProduct) {
      const superProduct = superProducts.find((sp) => sp.id === superProductId);
      if (!superProduct) continue;

      const measurementsDraft = createEmptyLineItemMeasurementsDraft(superProduct.components);
      const firstItem = sourceItems[0]!;
      for (const spComponent of superProduct.components) {
        const match = firstItem.components.find((c) => c.slotLabel === spComponent.slotLabel);
        if (match) {
          const componentMeasurementsDraft: LineItemComponentMeasurementDraft = {
            measurements: match.measurements.map(toMeasurementValue),
            measurementNote: match.measurementNote ?? "",
            features: [],
          };
          if (match.manualSizeImage) componentMeasurementsDraft.manualSizeImage = match.manualSizeImage;
          measurementsDraft[spComponent.id] = componentMeasurementsDraft;
        }
      }

      const stylingDrafts: UnitStylingDraft[] = sourceItems.map((sourceItem) => {
        const unitDraft = emptyUnitStylingDraft(superProduct.components);
        for (const spComponent of superProduct.components) {
          const match = sourceItem.components.find((c) => c.slotLabel === spComponent.slotLabel);
          const componentDraft: ComponentStylingDraft = match
            ? {
                features: match.features.map(toFeatureValue),
                stylingNote: match.stylingNote ?? "",
                referenceImage: match.referenceImage,
                id: match.id,
                orderItemId: sourceItem.id,
              }
            : emptyComponentStylingDraft();
          unitDraft[spComponent.id] = componentDraft;
        }
        return unitDraft;
      });

      prefilledLineItems.push({
        id: crypto.randomUUID(),
        superProductId,
        measurementsDraft,
        stylingDrafts,
      });
    }
    setLineItems(prefilledLineItems);
  }

  /**
   * A retailer-linked session can only ever order for its own retailer — the
   * real business rule the user confirmed directly: "a retailer can only
   * create group order for himself. same goes for the normal order." Same
   * "adjust state when a query result changes" shape as the repeat/edit
   * blocks above (no `useEffect`): fires once, the first time `me` resolves
   * with a real `retailerId`, skipping the Retailer step's picker entirely by
   * jumping straight to the Customer step. Deliberately excluded when
   * `isEditMode`/`repeatOfOrderId` — those already set `retailerId` from the
   * real source order (itself already row-isolated to this actor's own
   * retailer server-side, Workstream E Group 2), so this block would be
   * redundant, not wrong, but running it anyway risks stomping the
   * `activeStep` those flows set their own way.
   */
  if (!isEditMode && !repeatOfOrderId && me?.retailerId && retailerId === null && appliedMeRetailerId !== me.retailerId) {
    setAppliedMeRetailerId(me.retailerId);
    setRetailerId(me.retailerId);
    setActiveStep(CUSTOMER_STEP);
  }

  function handleSelectRetailer(id: string) {
    setRetailerId(id);
    setCustomerId(null);
  }

  function handleAddLineItem(superProductId: string) {
    const superProduct = superProducts?.find((sp) => sp.id === superProductId);
    if (!superProduct) return;
    setLineItems((current) => {
      const newLineItem = createLineItemDraft(superProduct);
      // Seed the new line item's shared measurements from any existing line item
      // that already embeds the same underlying product (e.g. adding "Suit" after
      // "Jacket" already has real measurements) — see `withSharedMeasurementsSynced`'s
      // own doc comment for the real bug this (and its edit-time counterpart below)
      // fixes.
      const measurementsByLineItemId = Object.fromEntries(current.map((item) => [item.id, item.measurementsDraft]));
      newLineItem.measurementsDraft = seedSharedMeasurementsForNewLineItem(
        superProduct.components,
        current,
        measurementsByLineItemId,
        superProducts ?? []
      );
      return [...current, newLineItem];
    });
  }

  function handleRemoveLineItem(id: string) {
    setLineItems((current) => current.filter((item) => item.id !== id));
  }

  function handleChangeQuantity(id: string, nextQuantity: number) {
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const superProduct = superProducts?.find((sp) => sp.id === item.superProductId);
        if (!superProduct) return item;
        const clamped = Math.max(1, nextQuantity);
        let stylingDrafts = item.stylingDrafts;
        if (clamped > stylingDrafts.length) {
          const additions = Array.from({ length: clamped - stylingDrafts.length }, () =>
            emptyUnitStylingDraft(superProduct.components)
          );
          stylingDrafts = [...stylingDrafts, ...additions];
        } else if (clamped < stylingDrafts.length) {
          stylingDrafts = stylingDrafts.slice(0, clamped);
        }
        return { ...item, stylingDrafts };
      })
    );
  }

  function handleChangeMeasurements(id: string, componentId: string, next: LineItemComponentMeasurementDraft) {
    setLineItems((current) => {
      const measurementsByLineItemId = Object.fromEntries(current.map((item) => [item.id, item.measurementsDraft]));
      const synced = withSharedMeasurementsSynced(measurementsByLineItemId, current, superProducts ?? [], id, componentId, next);
      return current.map((item) => ({ ...item, measurementsDraft: synced[item.id] ?? item.measurementsDraft }));
    });
  }

  function handleChangeStyling(id: string, next: UnitStylingDraft[]) {
    setLineItems((current) => current.map((item) => (item.id === id ? { ...item, stylingDrafts: next } : item)));
  }

  function handleCustomerCreated(customer: Customer) {
    setCustomerId(customer.id);
    setQuickCreateOpen(false);
  }

  function handleReset() {
    setActiveStep(0);
    setRetailerId(null);
    setCustomerId(null);
    setLineItems([]);
    setIsRush(false);
    setSubmitError(null);
    setCreatedOrder(null);
    setLineItemCompleteness({});
  }

  /**
   * `useCallback` so `LineItemCompletenessProbe`'s own `useEffect` doesn't
   * re-fire (and re-report an unchanged value) on every unrelated render of
   * this page — its dependency array includes this function identity.
   */
  const handleLineItemCompletenessChange = useCallback((id: string, complete: boolean) => {
    setLineItemCompleteness((current) => (current[id] === complete ? current : { ...current, [id]: complete }));
  }, []);

  const handleLineItemLinksChange = useCallback(
    (id: string, linksByComponentId: Record<string, ProductMeasurementLink[]>) => {
      setLineItemMeasurementLinks((current) => ({ ...current, [id]: linksByComponentId }));
    },
    []
  );

  /**
   * PHASE_10_TASKS.md Workstream E Group 6.3b — the edit-mode save path:
   * `PATCH /orders/:id` via `useEditOrderMutation`, submitting each unit's
   * real `order_items.id` (read off whichever of its components' drafts
   * still carries an `orderItemId` — every component within one unit shares
   * the same real value, see `ComponentStylingDraft`'s doc comment) so the
   * server updates existing rows in place rather than creating duplicates. A
   * unit with no `orderItemId` (added during this edit session) is submitted
   * exactly like a fresh create-flow addition — no `id` on the item, no `id`
   * on any of its components (`buildComponentInput` only ever sets one when
   * the draft actually carries one, which a brand-new unit's blank drafts
   * never do). On success, navigates to the order's own detail page rather
   * than this page's "Order Placed" success screen, which is create-only.
   */
  async function handleEditSubmit() {
    if (!editOrderId) return;
    setSubmitError(null);

    const items: EditOrderItemInput[] = [];
    for (const lineItem of lineItems) {
      const superProduct = superProducts?.find((sp) => sp.id === lineItem.superProductId);
      if (!superProduct) continue;

      const measurementLinksByComponentId = lineItemMeasurementLinks[lineItem.id] ?? {};
      for (const unitStylingDraft of lineItem.stylingDrafts) {
        const orderItemId = superProduct.components
          .map((component) => unitStylingDraft[component.id]?.orderItemId)
          .find((value): value is string => Boolean(value));
        const components = superProduct.components.map((component) =>
          buildComponentInput(lineItem, component, unitStylingDraft, measurementLinksByComponentId)
        );
        items.push({
          superProductId: lineItem.superProductId,
          components,
          ...(orderItemId ? { id: orderItemId } : {}),
        });
      }
    }

    try {
      const edited = await editOrder({ id: editOrderId, body: { items } }).unwrap();
      navigate(`/orders/${edited.id}`);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, "Failed to save order changes."));
    }
  }

  /**
   * The concrete implementation of Decision 3's denormalize-at-write design:
   * one full `CreateOrderItemInput` per physical unit (never a `quantity`
   * field). For each line item's each unit, every component's
   * `measurements`/`measurementNote` are copied **verbatim** from the line
   * item's one shared draft (identical across every sibling unit by
   * construction — this is exactly what Group 2's backend test already
   * proved the server accepts and stores correctly); `features` merges that
   * unit's own styling choices with the shared draft's Shoulder Type
   * selection (which travels with the measurement data, not the styling,
   * per Decision 3's consequence note, even though both end up in the same
   * `features[]` array); `stylingNote`/`referenceImage` come from the unit's
   * own draft alone.
   */
  async function handleSubmit() {
    if (isEditMode) {
      await handleEditSubmit();
      return;
    }
    if (!retailerId || !customerId) return;
    setSubmitError(null);

    const items = buildOrderItemsFromLineItems(lineItems, superProducts ?? [], lineItemMeasurementLinks);

    const input: CreateOrderInput = { retailerId, customerId, items };
    if (isRush) input.isRush = true;
    if (repeatOfOrderId) input.repeatOfOrderId = repeatOfOrderId;

    try {
      const created = await createOrder(input).unwrap();
      setCreatedOrder(created);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, "Failed to create order."));
    }
  }

  /**
   * The first three steps' client-side gate. The products step requires at
   * least one line item (`orders.routes.ts`'s "`items` must be a non-empty
   * array unless `repeatOfOrderId` is provided") — per-line-item measurement/
   * styling completeness does *not* also gate "Next" here (a user can freely
   * move between the cart and the Review step while still filling things in);
   * it gates "Place Order" itself instead, via `canPlaceOrder` below
   * (PHASE_9_TASKS.md Group 8). The review step never shows "Next" (it shows
   * "Place Order" instead, see below), so its value here is unused.
   */
  const canProceedByStep: Record<number, boolean> = {
    [RETAILER_STEP]: retailerId !== null,
    [CUSTOMER_STEP]: customerId !== null,
    [PRODUCTS_STEP]: lineItems.length > 0,
  };
  const canProceed = canProceedByStep[activeStep] ?? true;

  /**
   * PHASE_9_TASKS.md Group 8: "Place Order" stays disabled while any line
   * item's shared measurement entry is incomplete (Group 6's rule) or any of
   * its units has a required, non-additional, non-render-slot choice feature
   * left unselected (Group 7's rule) — both already computed, per line item,
   * by the `LineItemCompletenessProbe`s mounted below. A line item with no
   * probe result yet (still loading its product's measurement/feature
   * catalog data) counts as incomplete, not "assumed fine" — `!== true`,
   * not `!== false`.
   */
  const canPlaceOrder = lineItems.length > 0 && lineItems.every((item) => lineItemCompleteness[item.id] === true);
  const incompleteLineItemNames = lineItems
    .filter((item) => lineItemCompleteness[item.id] !== true)
    .map((item) => superProducts?.find((sp) => sp.id === item.superProductId)?.name ?? "product");

  if (isEditMode && (editSourceLoading || !editSource)) {
    return (
      <Box sx={{ p: 4 }}>
        {editSourceError ? (
          <Alert severity="error">{getApiErrorMessage(editSourceErrorObj, "Failed to load order.")}</Alert>
        ) : (
          <LoadingSpinner />
        )}
      </Box>
    );
  }

  if (createdOrder) {
    return (
      <Box sx={{ p: 4 }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 480, mx: "auto", textAlign: "center" }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Order Placed
          </Typography>
          <Typography variant="h4" sx={{ my: 2, fontWeight: "bold" }}>
            {createdOrder.orderNumber}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            View it any time from the Orders list.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={handleReset}>
            Start Another Order
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/*
       * Mounted regardless of `activeStep` — see `LineItemCompletenessProbe`'s
       * own doc comment for why this can't just reuse `OrderCartStep`'s
       * (Products-step-only) rendered rows.
       */}
      {lineItems.map((lineItem) => {
        const superProduct = superProducts?.find((sp) => sp.id === lineItem.superProductId);
        if (!superProduct) return null;
        return (
          <LineItemCompletenessProbe
            key={lineItem.id}
            lineItem={lineItem}
            superProduct={superProduct}
            onChange={handleLineItemCompletenessChange}
            onLinksChange={handleLineItemLinksChange}
          />
        );
      })}

      <Typography variant="h5" sx={{ mb: 3 }}>
        {isEditMode ? `Edit Order ${editSource?.orderNumber ?? ""}` : "New Order"}
      </Typography>

      {isEditMode && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Editing line items, units, measurements, and styling for this order. Retailer and customer are fixed here —
          use "Reassign Retailer" on the order's detail page to change the retailer.
        </Alert>
      )}

      {repeatOfOrderId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {repeatSource ? `Repeating order ${repeatSource.orderNumber} — fields below are pre-filled from it.` : "Loading repeat source order…"}
        </Alert>
      )}

      <Stepper activeStep={displayActiveStep} sx={{ mb: 4 }}>
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mb: 3 }}>
        {activeStep === RETAILER_STEP &&
          (me?.retailerId ? (
            // A retailer-linked session never picks — it can only ever order for
            // itself (see the render-time auto-select block above). This state is
            // only reachable for the briefest instant before that block's
            // `setActiveStep(CUSTOMER_STEP)` takes effect, but rendering the real
            // "locked to your own retailer" message here (instead of the picker)
            // avoids a picker flash a retailer session could never actually use.
            <Typography color="text.secondary">Ordering for your own retailer…</Typography>
          ) : retailersLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {retailersError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {getApiErrorMessage(retailersErrorObj, "Failed to load retailers.")}
                </Alert>
              )}
              <Typography variant="subtitle1" gutterBottom>
                Pick a retailer
              </Typography>
              <List component={Paper} variant="outlined" sx={{ maxWidth: 480 }}>
                {retailers?.map((retailer) => (
                  <ListItemButton
                    key={retailer.id}
                    selected={retailer.id === retailerId}
                    onClick={() => handleSelectRetailer(retailer.id)}
                  >
                    <ListItemText primary={retailer.name} secondary={retailer.code} />
                  </ListItemButton>
                ))}
                {retailers?.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 2 }}>
                    No retailers yet.
                  </Typography>
                )}
              </List>
            </>
          ))}

        {activeStep === CUSTOMER_STEP && retailerId && (
          <>
            {customersErrorFlag && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {getApiErrorMessage(customersErrorObj, "Failed to load customers.")}
              </Alert>
            )}
            <Typography variant="subtitle1" gutterBottom>
              Pick a customer for {selectedRetailer?.name}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2, maxWidth: 480 }}>
              {/* Real search dropdown (MUI `Autocomplete`, matching legacy's own
                  `Group/newCustomer/NewCustomer.jsx`'s customer-search `Autocomplete`)
                  — replaces the previous separate search field + always-open list,
                  a real reported UX gap (the customer list should collapse into a
                  dropdown, not stay expanded on the page). */}
              <Autocomplete
                fullWidth
                size="small"
                options={customers ?? []}
                loading={customersLoading}
                getOptionLabel={(customer) => customerName(customer)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                // `value` (not `inputValue`) is the only controlled piece — MUI derives
                // the displayed input text from `getOptionLabel(value)` on its own
                // whenever the field isn't actively being typed into. Controlling
                // `inputValue` too (tempting, for a "search box" feel) would need it
                // manually re-synced every time `customerId` changes for a reason other
                // than typing (quick-create, repeat/edit prefill, retailer auto-lock) —
                // real, easy-to-miss desync bugs for no behavioral benefit.
                value={selectedCustomer}
                onChange={(_event, customer) => setCustomerId(customer?.id ?? null)}
                renderOption={({ key: _key, ...props }, customer) => (
                  <li key={customer.id} {...props}>
                    <ListItemText primary={customerName(customer)} secondary={customer.contactNumber ?? undefined} />
                  </li>
                )}
                noOptionsText={canManageCustomers ? "No matching customers — create one." : "No matching customers."}
                renderInput={({ InputLabelProps: _InputLabelProps, size: _size, ...params }) => (
                  <TextField {...params} label="Search customers" size="small" />
                )}
              />
              {canManageCustomers && (
                <Button variant="outlined" onClick={() => setQuickCreateOpen(true)} sx={{ whiteSpace: "nowrap" }}>
                  New Customer
                </Button>
              )}
            </Stack>
            <CustomerQuickCreateDialog
              open={quickCreateOpen}
              retailerId={retailerId}
              onClose={() => setQuickCreateOpen(false)}
              onCreated={handleCustomerCreated}
            />
          </>
        )}

        {activeStep === PRODUCTS_STEP &&
          (superProductsLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {superProductsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {getApiErrorMessage(superProductsErrorObj, "Failed to load super products.")}
                </Alert>
              )}
              <OrderCartStep
                superProducts={superProducts ?? []}
                lineItems={lineItems}
                customerId={customerId}
                onAddLineItem={handleAddLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                onChangeQuantity={handleChangeQuantity}
                onChangeMeasurements={handleChangeMeasurements}
                onChangeStyling={handleChangeStyling}
                {...(editOrderId !== undefined ? { excludeOrderId: editOrderId } : {})}
                {...(isEditMode
                  ? { onOpenManualSize: (lineItemId: string, component: SuperProductComponent) => setManualSizeTarget({ lineItemId, component }) }
                  : {})}
              />
            </>
          ))}

        {activeStep === REVIEW_STEP && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Summary
              </Typography>
              <Typography>
                <strong>Retailer:</strong> {selectedRetailer?.name}
              </Typography>
              <Typography>
                <strong>Customer:</strong> {selectedCustomer ? customerName(selectedCustomer) : ""}
              </Typography>
            </Paper>

            {lineItems.map((lineItem) => {
              const superProduct = superProducts?.find((sp) => sp.id === lineItem.superProductId);
              if (!superProduct) return null;
              return <LineItemReviewCard key={lineItem.id} lineItem={lineItem} superProduct={superProduct} />;
            })}

            {canRush && !isEditMode && (
              <FormControlLabel
                control={<Switch checked={isRush} onChange={(event) => setIsRush(event.target.checked)} />}
                label="Rush order"
              />
            )}

            {!canPlaceOrder && incompleteLineItemNames.length > 0 && (
              <Alert severity="warning" data-testid="incomplete-line-items-warning">
                Finish measurements and required styling for: {incompleteLineItemNames.join(", ")} before placing
                this order.
              </Alert>
            )}

            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Stack>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" justifyContent="space-between">
        <Button
          disabled={activeStep <= (isEditMode ? PRODUCTS_STEP : me?.retailerId ? CUSTOMER_STEP : 0)}
          onClick={() => setActiveStep((step) => step - 1)}
        >
          Back
        </Button>
        {activeStep < REVIEW_STEP ? (
          <Button variant="contained" disabled={!canProceed} onClick={() => setActiveStep((step) => step + 1)}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={(isEditMode ? editOrderState.isLoading : createOrderState.isLoading) || !canPlaceOrder}
            onClick={handleSubmit}
          >
            {isEditMode
              ? editOrderState.isLoading
                ? "Saving…"
                : "Save Changes"
              : createOrderState.isLoading
                ? "Placing Order…"
                : "Place Order"}
          </Button>
        )}
      </Stack>

      {manualSizeTarget && (
        <ManualSizeEditor
          open
          onClose={() => setManualSizeTarget(null)}
          title={`${manualSizeTarget.component.slotLabel} (${manualSizeTarget.component.product.name})`}
          productName={manualSizeTarget.component.product.name}
          diagramImageUrl={manualSizeTarget.component.product.measurementDiagramImage}
          onSave={(url) => {
            const { lineItemId, component } = manualSizeTarget;
            const lineItem = lineItems.find((item) => item.id === lineItemId);
            const currentDraft = lineItem?.measurementsDraft[component.id] ?? emptyMeasurementComponentDraft();
            handleChangeMeasurements(lineItemId, component.id, { ...currentDraft, manualSizeImage: url });
            setManualSizeTarget(null);
          }}
        />
      )}
    </Box>
  );
}
