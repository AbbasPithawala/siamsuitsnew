import { useCallback, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see OrderBuilderPage.tsx's/ProductsPage.tsx's comment
// on this project's Vite dep optimizer mis-transforming `@mui/icons-material/X`
// deep imports.
import { CheckCircle as CheckCircleIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { useListSuperProductsQuery } from "../catalog/superProductsApi";
import type { SuperProduct } from "../catalog/superProductsApi";
import { useListCustomersByRetailerQuery } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { GroupOrderManageCustomerPanel } from "./GroupOrderManageCustomerPanel";
import { LineItemCompletenessProbe } from "./LineItemCompletenessProbe";
import { OrderCartStep, createLineItemDraft } from "./OrderCartStep";
import type { LineItemDraft } from "./OrderCartStep";
import { createEmptyLineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import type {
  LineItemComponentMeasurementDraft,
  LineItemMeasurementsDraft,
} from "./LineItemMeasurementsPanel";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import { emptyUnitStylingDraft } from "./StylingAccordion";
import type { UnitStylingDraft } from "./StylingAccordion";
import {
  buildOrderItemsFromLineItems,
  seedSharedMeasurementsForNewLineItem,
  withSharedMeasurementsSynced,
} from "./orderItemBuilder";
import { useCreateOrderGroupMutation } from "./orderGroupsApi";
import type {
  CreateOrderGroupInput,
  CreateOrderGroupOrderInput,
  OrderGroupDetail,
} from "./orderGroupsApi";

function customerName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

/**
 * One row on the Customers step. Distinct from the old (wrong)
 * `ChildOrderDraft` model this page used to carry: a group customer owns
 * *only* their own measurement values, one `LineItemMeasurementsDraft` per
 * shared `LineItemDraft.id` — never their own products/quantities/styling,
 * which are the group-level `lineItems` state below, entered once and shared
 * verbatim by every customer (see this file's own top doc comment).
 */
interface GroupCustomerDraft {
  /** Client-only key — same rationale `LineItemDraft.id` documents. */
  key: string;
  customerId: string | null;
  measurementsByLineItem: Record<string, LineItemMeasurementsDraft>;
}

function seedMeasurementsByLineItem(
  lineItems: LineItemDraft[],
  superProducts: SuperProduct[]
): Record<string, LineItemMeasurementsDraft> {
  const seeded: Record<string, LineItemMeasurementsDraft> = {};
  for (const lineItem of lineItems) {
    const superProduct = superProducts.find((sp) => sp.id === lineItem.superProductId);
    if (!superProduct) continue;
    seeded[lineItem.id] = createEmptyLineItemMeasurementsDraft(superProduct.components);
  }
  return seeded;
}

function createGroupCustomerDraft(
  lineItems: LineItemDraft[],
  superProducts: SuperProduct[]
): GroupCustomerDraft {
  return {
    key: crypto.randomUUID(),
    customerId: null,
    measurementsByLineItem: seedMeasurementsByLineItem(lineItems, superProducts),
  };
}

const STEP_LABELS = ["Retailer", "Shared Cart", "Customers"];
const RETAILER_STEP = 0;
const CART_STEP = 1;
const CUSTOMERS_STEP = 2;

/** Matches legacy `NewOrder.jsx`'s own `customer_quantity` default/min (`handleCustomerQuantity` rejects anything below 2). */
const MIN_NUMBER_OF_CUSTOMERS = 2;

/**
 * New Group Order — corrected model (this file previously modeled a group
 * order as N fully independent carts, one per customer; that was wrong,
 * confirmed against real legacy source — `Group/newOrder/NewOrder.jsx`,
 * `Group/newCustomer/NewCustomer.jsx`,
 * `Group/newCustomer/CustomerProductMeasurements.jsx`,
 * `Group/customers/Customers.jsx` — and the actual user directly).
 *
 * **The real model**: products, quantities, and per-unit fabric/styling are
 * chosen exactly ONCE for the whole group (`lineItems` below — the same
 * `LineItemDraft[]` shape/state `OrderBuilderPage.tsx` owns for a single
 * order, built with the same `OrderCartStep`). Customers are added
 * afterwards; each one only fills in their OWN measurement values against
 * that identical shared line-item set — nothing else varies per customer.
 * `POST /order-groups` has no "shared items" concept server-side (each child
 * order's `items` is a fully independent `CreateOrderItemInput[]`,
 * `orderGroupsApi.ts`'s own doc comment) — this page satisfies the real model
 * purely client-side, by calling `buildOrderItemsFromLineItems` once per
 * customer against a synthetic per-customer `LineItemDraft[]` that reuses the
 * shared `id`/`superProductId`/`stylingDrafts` verbatim and substitutes only
 * that customer's own `measurementsDraft` (`handleSubmit` below) — so every
 * child order ends up with byte-identical items/styling and only its
 * measurement values differ, exactly per the real user's own confirmation
 * ("the styling will be same for every customer for that item when
 * selected").
 *
 * **Three steps, not the old per-child-order N-cards layout**: Retailer ->
 * Shared Cart -> Customers, matching the real sequencing constraint (a
 * customer can't be searched/created without a `retailerId`, same reasoning
 * `OrderBuilderPage.tsx`'s own doc comment gives for its Retailer-before-
 * Customer step order) plus the model's own real dependency (customers can't
 * be added before there's a shared cart for them to measure against).
 *
 * **Measurement completeness is customer-independent by construction**:
 * `useLineItemMeasurementsCompleteness` (`LineItemMeasurementsPanel.tsx`'s own
 * doc comment) never requires any measurement to actually be filled in — it
 * only confirms the product's real measurement-definition catalog has
 * loaded, backfilling anything left blank with an explicit "0" at submit
 * time. That means a line item's measurement "Complete/Missing" status is
 * identical for every customer, so this page mounts exactly one
 * `LineItemCompletenessProbe` per shared line item (not one per (line item x
 * customer), which would recompute the exact same catalog-loaded boolean N
 * times over) and reuses that one shared `lineItemCompleteness` flag both to
 * gate the Shared Cart step's own styling-completeness requirement AND, per
 * customer, on the Customers step.
 *
 * **The Customers step is a compact table (S.No / Customer Name / Manage
 * status-link / Delete), matching legacy `Group/customers/Customers.jsx`'s
 * real name/status/actions list shape** — built with this codebase's own
 * established `Table`/`TableHead`/`TableBody`/`TableRow`/`TableCell` pattern
 * (`CustomersPage.tsx`), not the always-expanded `Paper` card list this step
 * used before (confirmed wrong against legacy and the real user directly: a
 * group order can have many customers, and an always-expanded card per one
 * doesn't scale the way legacy's compact list does). "Add Customer" opens
 * `GroupOrderManageCustomerPanel` straight away for the new slot, and an
 * already-managed row's own "Manage"/"Missing" link reopens it — legacy
 * `Group/newCustomer/NewCustomer.jsx`'s real combined shape: search/pick an
 * existing customer OR register a new one, plus that slot's shared-line-item
 * measurement forms, plus one Save/Update button — replacing the old split
 * "separate quick-create dialog + always-inline measurements" flow. A full-
 * page takeover (`GroupOrderManageCustomerPanel.tsx`'s own doc comment), not
 * a `Dialog` popup — the real requested shape, matching every other page in
 * this app. A client-side-only "Number of Customers" field (default/min 2, matching
 * legacy's `customer_quantity`) gates how many rows can exist — no backend
 * field for it exists (`POST /order-groups` takes only `retailerId` +
 * `orders[]`, `orderGroupsApi.ts`), so it's pure UI state here, exactly like
 * legacy's own client-only `handleCustomerQuantity` gate.
 *
 * **Gating**: page-level `RequirePermission permission="orders.group.create"`
 * in `AppRoutes.tsx`, unchanged.
 */
export function NewGroupOrderPage() {
  const [activeStep, setActiveStep] = useState(RETAILER_STEP);
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [lineItemCompleteness, setLineItemCompleteness] = useState<Record<string, boolean>>({});
  const [lineItemMeasurementLinks, setLineItemMeasurementLinks] = useState<
    Record<string, Record<string, ProductMeasurementLink[]>>
  >({});
  const [customers, setCustomers] = useState<GroupCustomerDraft[]>([]);
  const [numberOfCustomers, setNumberOfCustomers] = useState(MIN_NUMBER_OF_CUSTOMERS);
  const [customerQuantityError, setCustomerQuantityError] = useState<string | null>(null);
  const [manageTargetKey, setManageTargetKey] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<OrderGroupDetail | null>(null);
  const [appliedMeRetailerId, setAppliedMeRetailerId] = useState<string | null>(null);

  const canManageCustomers = useHasPermission("customers.manage");

  const { data: me } = useMeQuery();
  const {
    data: retailers,
    isLoading: retailersLoading,
    isError: retailersError,
    error: retailersErrorObj,
  } = useListRetailersQuery();
  const {
    data: customerOptions,
    isLoading: customersLoading,
    isError: customersErrorFlag,
    error: customersErrorObj,
  } = useListCustomersByRetailerQuery(retailerId ?? "", { skip: !retailerId });
  const {
    data: superProducts,
    isLoading: superProductsLoading,
    isError: superProductsError,
    error: superProductsErrorObj,
  } = useListSuperProductsQuery();
  const [createOrderGroup, createOrderGroupState] = useCreateOrderGroupMutation();

  const selectedRetailer = retailers?.find((retailer) => retailer.id === retailerId) ?? null;

  // A retailer-linked session never sees the Retailer step's content (the auto-select block
  // below jumps straight to `CART_STEP`) — same fix, same reasoning, as `OrderBuilderPage.tsx`'s
  // identical block. Purely a rendering concern: `activeStep`/`RETAILER_STEP`/etc. stay the real,
  // unshifted indices everywhere else in this file.
  const stepLabels = me?.retailerId ? STEP_LABELS.slice(1) : STEP_LABELS;
  const displayActiveStep = me?.retailerId ? Math.max(0, activeStep - 1) : activeStep;

  function handleSelectRetailer(event: SelectChangeEvent) {
    setRetailerId(event.target.value);
    setLineItems([]);
    setLineItemCompleteness({});
    setLineItemMeasurementLinks({});
    setCustomers([]);
    setNumberOfCustomers(MIN_NUMBER_OF_CUSTOMERS);
    setCustomerQuantityError(null);
    setActiveStep(CART_STEP);
  }

  /**
   * A retailer-linked session can only ever place a group order for its own
   * retailer — the real business rule the user confirmed directly ("a
   * retailer can only create group order for himself... same goes for the
   * normal order"), same fix and same "adjust state when a query result
   * changes" shape as `OrderBuilderPage.tsx`'s identical block.
   */
  if (me?.retailerId && retailerId === null && appliedMeRetailerId !== me.retailerId) {
    setAppliedMeRetailerId(me.retailerId);
    setRetailerId(me.retailerId);
    setLineItems([]);
    setLineItemCompleteness({});
    setLineItemMeasurementLinks({});
    setCustomers([]);
    setNumberOfCustomers(MIN_NUMBER_OF_CUSTOMERS);
    setCustomerQuantityError(null);
    setActiveStep(CART_STEP);
  }

  function handleAddLineItem(superProductId: string) {
    const superProduct = superProducts?.find((sp) => sp.id === superProductId);
    if (!superProduct) return;
    const newLineItem = createLineItemDraft(superProduct);
    setLineItems((current) => [...current, newLineItem]);
    setCustomers((current) =>
      current.map((customer) => ({
        ...customer,
        // Seed from this same customer's *own* other line items that already embed
        // the same underlying product — see `withSharedMeasurementsSynced`'s doc
        // comment for the real cross-line-item measurement bug this (and its
        // edit-time counterpart in `handleChangeCustomerMeasurements` below) fixes.
        // Deliberately per-customer, not cross-customer: different customers have
        // different bodies.
        measurementsByLineItem: {
          ...customer.measurementsByLineItem,
          [newLineItem.id]: seedSharedMeasurementsForNewLineItem(
            superProduct.components,
            lineItems,
            customer.measurementsByLineItem,
            superProducts ?? []
          ),
        },
      }))
    );
  }

  function handleRemoveLineItem(lineItemId: string) {
    setLineItems((current) => current.filter((item) => item.id !== lineItemId));
    setCustomers((current) =>
      current.map((customer) => {
        const nextMeasurements = { ...customer.measurementsByLineItem };
        delete nextMeasurements[lineItemId];
        return { ...customer, measurementsByLineItem: nextMeasurements };
      })
    );
  }

  function handleChangeQuantity(lineItemId: string, nextQuantity: number) {
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== lineItemId) return item;
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

  function handleChangeStyling(lineItemId: string, next: UnitStylingDraft[]) {
    setLineItems((current) =>
      current.map((item) => (item.id === lineItemId ? { ...item, stylingDrafts: next } : item))
    );
  }

  /** Same rationale `OrderBuilderPage.tsx`'s identically-named callback documents — stable identity for `LineItemCompletenessProbe`'s effect dependency. */
  const handleLineItemCompletenessChange = useCallback((id: string, complete: boolean) => {
    setLineItemCompleteness((current) =>
      current[id] === complete ? current : { ...current, [id]: complete }
    );
  }, []);

  const handleLineItemLinksChange = useCallback(
    (id: string, linksByComponentId: Record<string, ProductMeasurementLink[]>) => {
      setLineItemMeasurementLinks((current) => ({ ...current, [id]: linksByComponentId }));
    },
    []
  );

  /**
   * Gated by the caller (the "Add Customer" button only renders while
   * `customers.length < numberOfCustomers`, same as legacy's
   * `showAddCustomerButton`) — this guard is just defense in depth.
   *
   * Immediately opens the new slot's own Manage Customer screen (rather than
   * landing back on the table with a "Missing" row the admin has to click
   * into separately) — the real requested flow: Add Customer -> Manage
   * Customer screen -> Save returns to the table with that row filled in.
   */
  function handleAddCustomer() {
    if (customers.length >= numberOfCustomers) return;
    const draft = createGroupCustomerDraft(lineItems, superProducts ?? []);
    setCustomers((current) => [...current, draft]);
    setManageTargetKey(draft.key);
  }

  function handleRemoveCustomer(key: string) {
    setCustomers((current) => current.filter((customer) => customer.key !== key));
  }

  /**
   * Legacy `handleCustomerQuantity`'s exact two rejection rules: never below
   * `MIN_NUMBER_OF_CUSTOMERS`, and never below the number of customer rows
   * already added (must remove customers first) — surfaced the same way
   * legacy's snackbar error does, via `customerQuantityError` below the
   * field.
   */
  function handleChangeNumberOfCustomers(rawValue: string) {
    const next = Number(rawValue);
    if (!Number.isFinite(next)) return;
    if (next < MIN_NUMBER_OF_CUSTOMERS) {
      setCustomerQuantityError(
        `Number of customers cannot be less than ${MIN_NUMBER_OF_CUSTOMERS}.`
      );
      return;
    }
    if (next < customers.length) {
      setCustomerQuantityError("Cannot decrease the number of customers. Remove customers first.");
      return;
    }
    setCustomerQuantityError(null);
    setNumberOfCustomers(next);
  }

  /** Called by `GroupOrderManageCustomerPanel.onSaved` once a customer has been picked/registered/updated for this slot. */
  function handleCustomerSaved(key: string, customerId: string) {
    setCustomers((current) =>
      current.map((customer) => (customer.key === key ? { ...customer, customerId } : customer))
    );
    setManageTargetKey(null);
  }

  function handleChangeCustomerMeasurements(
    key: string,
    lineItemId: string,
    componentId: string,
    next: LineItemComponentMeasurementDraft
  ) {
    setCustomers((current) =>
      current.map((customer) => {
        if (customer.key !== key) return customer;
        return {
          ...customer,
          measurementsByLineItem: withSharedMeasurementsSynced(
            customer.measurementsByLineItem,
            lineItems,
            superProducts ?? [],
            lineItemId,
            componentId,
            next
          ),
        };
      })
    );
  }

  function handleReset() {
    setActiveStep(RETAILER_STEP);
    setRetailerId(null);
    setLineItems([]);
    setLineItemCompleteness({});
    setLineItemMeasurementLinks({});
    setCustomers([]);
    setNumberOfCustomers(MIN_NUMBER_OF_CUSTOMERS);
    setCustomerQuantityError(null);
    setSubmitError(null);
    setCreatedGroup(null);
  }

  const sharedCartComplete =
    lineItems.length > 0 && lineItems.every((item) => lineItemCompleteness[item.id] === true);

  function customerComplete(customer: GroupCustomerDraft): boolean {
    return customer.customerId !== null && sharedCartComplete;
  }

  const canSubmit =
    retailerId !== null &&
    sharedCartComplete &&
    customers.length === numberOfCustomers &&
    customers.every(customerComplete);

  async function handleSubmit() {
    if (!retailerId) return;
    setSubmitError(null);

    const orders: CreateOrderGroupOrderInput[] = customers
      .filter(
        (customer): customer is GroupCustomerDraft & { customerId: string } =>
          customer.customerId !== null
      )
      .map((customer) => {
        const perCustomerLineItems: LineItemDraft[] = lineItems.map((lineItem) => ({
          id: lineItem.id,
          superProductId: lineItem.superProductId,
          stylingDrafts: lineItem.stylingDrafts,
          measurementsDraft: customer.measurementsByLineItem[lineItem.id] ?? {},
        }));
        return {
          customerId: customer.customerId,
          items: buildOrderItemsFromLineItems(
            perCustomerLineItems,
            superProducts ?? [],
            lineItemMeasurementLinks
          ),
        };
      });

    const input: CreateOrderGroupInput = { retailerId, orders };

    try {
      const created = await createOrderGroup(input).unwrap();
      setCreatedGroup(created);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, "Failed to create group order."));
    }
  }

  if (createdGroup) {
    return (
      <Box sx={{ p: 4 }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 560, mx: "auto", textAlign: "center" }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Group Order Placed
          </Typography>
          <Typography variant="h4" sx={{ my: 2, fontWeight: "bold" }}>
            {createdGroup.orderNumber}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            {createdGroup.orders.length} order{createdGroup.orders.length === 1 ? "" : "s"} placed:
          </Typography>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            {createdGroup.orders.map((order) => (
              <Typography key={order.id} variant="body2">
                {order.orderNumber}
              </Typography>
            ))}
          </Stack>
          <Typography color="text.secondary" gutterBottom>
            View it any time from the Group Orders list.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={handleReset}>
            Start Another Group Order
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Mounted regardless of `activeStep` — same rationale `LineItemCompletenessProbe.tsx`'s/`OrderBuilderPage.tsx`'s own doc comments give. One per shared line item, not per (line item x customer) — see this file's own top doc comment on why that's correct, not a shortcut. */}
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
        New Group Order
      </Typography>

      <Stepper activeStep={displayActiveStep} sx={{ mb: 4 }}>
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === RETAILER_STEP &&
        (me?.retailerId ? (
          // A retailer-linked session never picks — same reasoning as
          // `OrderBuilderPage.tsx`'s identical block. Reachable only for the
          // briefest instant before the render-time auto-select block above
          // jumps to `CART_STEP`.
          <Typography color="text.secondary">
            Building this group order for your own retailer…
          </Typography>
        ) : retailersLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {retailersError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {getApiErrorMessage(retailersErrorObj, "Failed to load retailers.")}
              </Alert>
            )}
            <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
              <InputLabel id="group-order-retailer-label">Retailer</InputLabel>
              <Select
                labelId="group-order-retailer-label"
                label="Retailer"
                value={retailerId ?? ""}
                onChange={handleSelectRetailer}
              >
                {retailers?.map((retailer) => (
                  <MenuItem key={retailer.id} value={retailer.id}>
                    {retailer.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        ))}

      {activeStep === CART_STEP && retailerId && (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Build the shared cart for {selectedRetailer?.name} — every customer added on the next
            step gets these exact products, quantities, and styling.
          </Typography>

          {superProductsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {getApiErrorMessage(superProductsErrorObj, "Failed to load super products.")}
            </Alert>
          )}

          {superProductsLoading ? (
            <LoadingSpinner />
          ) : (
            <OrderCartStep
              superProducts={superProducts ?? []}
              lineItems={lineItems}
              customerId={null}
              hideMeasurements
              onAddLineItem={handleAddLineItem}
              onRemoveLineItem={handleRemoveLineItem}
              onChangeQuantity={handleChangeQuantity}
              onChangeMeasurements={() => {
                /* No customer exists yet at this step — `hideMeasurements` on `OrderCartStep` above means this is never invoked. */
              }}
              onChangeStyling={handleChangeStyling}
            />
          )}

          {!sharedCartComplete && lineItems.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Finish required styling for every product above before adding customers.
            </Alert>
          )}

          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            {/* A retailer-linked session has no retailer picker to go back to
                (RETAILER_STEP shows only a locked confirmation for them) — hiding
                this avoids a real dead-end (no way back to CART_STEP from there). */}
            {!me?.retailerId && <Button onClick={() => setActiveStep(RETAILER_STEP)}>Back</Button>}
            {me?.retailerId && <span />}
            <Button
              variant="contained"
              disabled={!sharedCartComplete}
              onClick={() => setActiveStep(CUSTOMERS_STEP)}
            >
              Next: Add Customers
            </Button>
          </Stack>
        </>
      )}

      {activeStep === CUSTOMERS_STEP &&
        retailerId &&
        (() => {
          const manageTargetCustomer = manageTargetKey
            ? customers.find((customer) => customer.key === manageTargetKey)
            : undefined;
          // `manageTargetCustomer` guards against a stale key (e.g. the row was deleted while
          // its own panel was open) — falls through to the table below instead of rendering
          // a panel with nothing to manage.
          if (manageTargetKey && manageTargetCustomer) {
            // Takes over this step's entire rendered output (table/Add Customer/Back/Place
            // Group Order all stop rendering) rather than layering a `Dialog` overlay on top of
            // them — same "state swap, not real navigation" pattern `OrderCartStep.tsx`'s own
            // focused Fabric & Styling panel already established (see its doc comment): plain
            // in-flow content inside this page's own `Box`, so it fills exactly the app shell's
            // `<main>` content area like every other page, never draws over the header/sidebar.
            const targetKey = manageTargetKey;
            // Excludes customers already picked by another row in this same group (real
            // dedupe constraint) — text matching against whatever the admin types is left
            // entirely to the panel's own `Autocomplete` internal filtering.
            const availableCustomers = (customerOptions ?? []).filter(
              (option) =>
                !customers.some(
                  (other) => other.key !== targetKey && other.customerId === option.id
                )
            );
            return (
              <GroupOrderManageCustomerPanel
                key={targetKey}
                retailerId={retailerId}
                customerId={manageTargetCustomer.customerId}
                customerOptions={availableCustomers}
                customersLoading={customersLoading}
                canManageCustomers={canManageCustomers}
                lineItems={lineItems}
                superProducts={superProducts ?? []}
                measurementsByLineItem={manageTargetCustomer.measurementsByLineItem}
                onChangeMeasurements={(lineItemId, componentId, next) =>
                  handleChangeCustomerMeasurements(targetKey, lineItemId, componentId, next)
                }
                onClose={() => setManageTargetKey(null)}
                onSaved={(customerId) => handleCustomerSaved(targetKey, customerId)}
              />
            );
          }

          return (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Customers in this group for {selectedRetailer?.name}
              </Typography>

              {customersErrorFlag && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {getApiErrorMessage(customersErrorObj, "Failed to load customers.")}
                </Alert>
              )}

              <TextField
                label="Number of Customers"
                type="number"
                size="small"
                value={numberOfCustomers}
                onChange={(event) => handleChangeNumberOfCustomers(event.target.value)}
                inputProps={{ min: MIN_NUMBER_OF_CUSTOMERS }}
                sx={{ mb: 2, maxWidth: 220 }}
              />
              {customerQuantityError && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  onClose={() => setCustomerQuantityError(null)}
                >
                  {customerQuantityError}
                </Alert>
              )}

              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Customer Name</TableCell>
                      <TableCell>Manage Customer</TableCell>
                      <TableCell align="right">Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography color="text.secondary">No customers added yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {customers.map((customer, index) => {
                      const selectedCustomer =
                        customerOptions?.find((option) => option.id === customer.customerId) ??
                        null;
                      const complete = customerComplete(customer);
                      return (
                        <TableRow key={customer.key} data-testid={`group-customer-row-${index}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            {selectedCustomer ? customerName(selectedCustomer) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="text"
                              size="small"
                              data-testid="group-customer-status"
                              onClick={() => setManageTargetKey(customer.key)}
                              sx={{
                                color: complete ? "success.main" : "error.main",
                                fontWeight: 600,
                                textTransform: "none",
                              }}
                            >
                              {complete ? "Manage" : "Missing"}
                            </Button>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              aria-label={`Delete customer ${index + 1}`}
                              onClick={() => handleRemoveCustomer(customer.key)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Only while there's still room for another slot — same "Add Customer" gate legacy's own `showAddCustomerButton` (`customers.length < customer_quantity`) enforces. */}
              {customers.length < numberOfCustomers && (
                <Button variant="outlined" onClick={handleAddCustomer} sx={{ mb: 3 }}>
                  Add Customer
                </Button>
              )}

              <Divider sx={{ mb: 2 }} />

              {submitError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {submitError}
                </Alert>
              )}
              {!canSubmit && customers.length > 0 && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  data-testid="incomplete-group-customers-warning"
                >
                  {customers.length !== numberOfCustomers
                    ? `Add ${numberOfCustomers} customer${numberOfCustomers === 1 ? "" : "s"} (currently ${customers.length}) before this group can be placed.`
                    : "Every customer needs to be picked (or registered) before this group can be placed."}
                </Alert>
              )}

              <Stack direction="row" justifyContent="space-between">
                <Button onClick={() => setActiveStep(CART_STEP)}>Back</Button>
                <Button
                  variant="contained"
                  disabled={!canSubmit || createOrderGroupState.isLoading}
                  onClick={handleSubmit}
                >
                  {createOrderGroupState.isLoading ? "Placing Group Order…" : "Place Group Order"}
                </Button>
              </Stack>
            </>
          );
        })()}
    </Box>
  );
}
