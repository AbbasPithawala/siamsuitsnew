import { useCallback, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see OrderBuilderPage.tsx's/ProductsPage.tsx's comment
// on this project's Vite dep optimizer mis-transforming `@mui/icons-material/X`
// deep imports.
import { CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { useListSuperProductsQuery } from "../catalog/superProductsApi";
import type { SuperProduct } from "../catalog/superProductsApi";
import { useListCustomersByRetailerQuery } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { CustomerQuickCreateDialog } from "./CustomerQuickCreateDialog";
import { LineItemCompletenessProbe } from "./LineItemCompletenessProbe";
import { OrderCartStep, createLineItemDraft } from "./OrderCartStep";
import type { LineItemDraft } from "./OrderCartStep";
import { LineItemMeasurementsPanel, createEmptyLineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import type { LineItemComponentMeasurementDraft, LineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import { emptyUnitStylingDraft } from "./StylingAccordion";
import type { UnitStylingDraft } from "./StylingAccordion";
import { buildOrderItemsFromLineItems } from "./orderItemBuilder";
import { useCreateOrderGroupMutation } from "./orderGroupsApi";
import type { CreateOrderGroupInput, CreateOrderGroupOrderInput, OrderGroupDetail } from "./orderGroupsApi";

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

function createGroupCustomerDraft(lineItems: LineItemDraft[], superProducts: SuperProduct[]): GroupCustomerDraft {
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
 * **The Customers step deliberately reuses this app's already-established
 * "Paper card list, chip status, remove button" idiom** (the same shape the
 * old per-child-order cards, and `OrderCartStep`'s own row-status pattern,
 * already use) rather than introducing a literal `<table>` — legacy
 * `Customers.jsx`'s real behavior was a name/status/actions list, which is
 * what these cards already render; not a second, drifting layout primitive
 * for the same information.
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
  const [quickCreateTargetKey, setQuickCreateTargetKey] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<OrderGroupDetail | null>(null);
  const [appliedMeRetailerId, setAppliedMeRetailerId] = useState<string | null>(null);

  const canManageCustomers = useHasPermission("customers.manage");

  const { data: me } = useMeQuery();
  const { data: retailers, isLoading: retailersLoading, isError: retailersError, error: retailersErrorObj } =
    useListRetailersQuery();
  const { data: customerOptions, isLoading: customersLoading, isError: customersErrorFlag, error: customersErrorObj } =
    useListCustomersByRetailerQuery(retailerId ?? "", { skip: !retailerId });
  const { data: superProducts, isLoading: superProductsLoading, isError: superProductsError, error: superProductsErrorObj } =
    useListSuperProductsQuery();
  const [createOrderGroup, createOrderGroupState] = useCreateOrderGroupMutation();

  const selectedRetailer = retailers?.find((retailer) => retailer.id === retailerId) ?? null;

  function handleSelectRetailer(event: SelectChangeEvent) {
    setRetailerId(event.target.value);
    setLineItems([]);
    setLineItemCompleteness({});
    setLineItemMeasurementLinks({});
    setCustomers([]);
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
        measurementsByLineItem: {
          ...customer.measurementsByLineItem,
          [newLineItem.id]: createEmptyLineItemMeasurementsDraft(superProduct.components),
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
    setLineItems((current) => current.map((item) => (item.id === lineItemId ? { ...item, stylingDrafts: next } : item)));
  }

  /** Same rationale `OrderBuilderPage.tsx`'s identically-named callback documents — stable identity for `LineItemCompletenessProbe`'s effect dependency. */
  const handleLineItemCompletenessChange = useCallback((id: string, complete: boolean) => {
    setLineItemCompleteness((current) => (current[id] === complete ? current : { ...current, [id]: complete }));
  }, []);

  const handleLineItemLinksChange = useCallback((id: string, linksByComponentId: Record<string, ProductMeasurementLink[]>) => {
    setLineItemMeasurementLinks((current) => ({ ...current, [id]: linksByComponentId }));
  }, []);

  function handleAddCustomer() {
    setCustomers((current) => [...current, createGroupCustomerDraft(lineItems, superProducts ?? [])]);
  }

  function handleRemoveCustomer(key: string) {
    setCustomers((current) => current.filter((customer) => customer.key !== key));
  }

  function handleSelectCustomer(key: string, customerId: string) {
    setCustomers((current) =>
      current.map((customer) => (customer.key === key ? { ...customer, customerId } : customer))
    );
  }

  function handleClearCustomer(key: string) {
    setCustomers((current) =>
      current.map((customer) => (customer.key === key ? { ...customer, customerId: null } : customer))
    );
  }

  function handleCustomerCreated(key: string, customer: Customer) {
    handleSelectCustomer(key, customer.id);
    setQuickCreateTargetKey(null);
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
        const lineItemDraft = customer.measurementsByLineItem[lineItemId] ?? {};
        return {
          ...customer,
          measurementsByLineItem: {
            ...customer.measurementsByLineItem,
            [lineItemId]: { ...lineItemDraft, [componentId]: next },
          },
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
    setSubmitError(null);
    setCreatedGroup(null);
  }

  const sharedCartComplete = lineItems.length > 0 && lineItems.every((item) => lineItemCompleteness[item.id] === true);

  function customerComplete(customer: GroupCustomerDraft): boolean {
    return customer.customerId !== null && sharedCartComplete;
  }

  const canSubmit = retailerId !== null && sharedCartComplete && customers.length > 0 && customers.every(customerComplete);

  async function handleSubmit() {
    if (!retailerId) return;
    setSubmitError(null);

    const orders: CreateOrderGroupOrderInput[] = customers
      .filter((customer): customer is GroupCustomerDraft & { customerId: string } => customer.customerId !== null)
      .map((customer) => {
        const perCustomerLineItems: LineItemDraft[] = lineItems.map((lineItem) => ({
          id: lineItem.id,
          superProductId: lineItem.superProductId,
          stylingDrafts: lineItem.stylingDrafts,
          measurementsDraft: customer.measurementsByLineItem[lineItem.id] ?? {},
        }));
        return {
          customerId: customer.customerId,
          items: buildOrderItemsFromLineItems(perCustomerLineItems, superProducts ?? [], lineItemMeasurementLinks),
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

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEP_LABELS.map((label) => (
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
          <Typography color="text.secondary">Building this group order for your own retailer…</Typography>
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
            Build the shared cart for {selectedRetailer?.name} — every customer added on the next step gets these
            exact products, quantities, and styling.
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
            <Button variant="contained" disabled={!sharedCartComplete} onClick={() => setActiveStep(CUSTOMERS_STEP)}>
              Next: Add Customers
            </Button>
          </Stack>
        </>
      )}

      {activeStep === CUSTOMERS_STEP && retailerId && (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Customers in this group for {selectedRetailer?.name}
          </Typography>

          {customersErrorFlag && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {getApiErrorMessage(customersErrorObj, "Failed to load customers.")}
            </Alert>
          )}

          <Stack spacing={3} sx={{ mb: 3 }}>
            {customers.map((customer, index) => {
              const selectedCustomer = customerOptions?.find((option) => option.id === customer.customerId) ?? null;
              // Excludes customers already picked by another card in this same group
              // (real dedupe constraint) — text matching against whatever the admin
              // types is left entirely to the `Autocomplete` below's own internal filtering.
              const availableCustomers = (customerOptions ?? []).filter(
                (option) => !customers.some((other) => other.key !== customer.key && other.customerId === option.id)
              );
              const complete = customerComplete(customer);

              return (
                <Paper key={customer.key} variant="outlined" sx={{ p: 3 }} data-testid={`group-customer-card-${index}`}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6">Customer {index + 1}</Typography>
                      <Chip
                        size="small"
                        data-testid="group-customer-status"
                        label={complete ? "Complete" : "Missing"}
                        color={complete ? "success" : "default"}
                        sx={{ color: complete ? undefined : "red", fontWeight: 600 }}
                      />
                    </Stack>
                    <Button variant="outlined" color="error" size="small" onClick={() => handleRemoveCustomer(customer.key)}>
                      Remove
                    </Button>
                  </Stack>

                  {!customer.customerId ? (
                    <>
                      <Typography variant="subtitle2" gutterBottom>
                        Pick a customer
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ mb: 2, maxWidth: 480 }}>
                        {/* Real search dropdown — see `OrderBuilderPage.tsx`'s identical
                            customer picker for the full reasoning (matches legacy's own
                            `Group/newCustomer/NewCustomer.jsx` `Autocomplete`). */}
                        <Autocomplete
                          fullWidth
                          size="small"
                          options={availableCustomers}
                          loading={customersLoading}
                          getOptionLabel={(option) => customerName(option)}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          // See `OrderBuilderPage.tsx`'s identical Autocomplete for why
                          // `inputValue` is deliberately left uncontrolled.
                          value={selectedCustomer}
                          onChange={(_event, option) => {
                            if (option) handleSelectCustomer(customer.key, option.id);
                          }}
                          renderOption={({ key: _key, ...props }, option) => (
                            <li key={option.id} {...props}>
                              <ListItemText primary={customerName(option)} secondary={option.contactNumber ?? undefined} />
                            </li>
                          )}
                          noOptionsText={canManageCustomers ? "No matching customers — create one." : "No matching customers."}
                          renderInput={({ InputLabelProps: _InputLabelProps, size: _size, ...params }) => (
                            <TextField {...params} label="Search customers" size="small" />
                          )}
                        />
                        {canManageCustomers && (
                          <Button
                            variant="outlined"
                            onClick={() => setQuickCreateTargetKey(customer.key)}
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            New Customer
                          </Button>
                        )}
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="body1">
                          Customer: <strong>{selectedCustomer ? customerName(selectedCustomer) : "—"}</strong>
                        </Typography>
                        <Button size="small" onClick={() => handleClearCustomer(customer.key)}>
                          Change customer
                        </Button>
                      </Stack>

                      <Stack spacing={2}>
                        {lineItems.map((lineItem) => {
                          const superProduct = superProducts?.find((sp) => sp.id === lineItem.superProductId);
                          if (!superProduct) return null;
                          return (
                            <Box key={lineItem.id}>
                              <Typography variant="subtitle2" gutterBottom>
                                {superProduct.name} × {lineItem.stylingDrafts.length}
                              </Typography>
                              <LineItemMeasurementsPanel
                                components={superProduct.components}
                                draft={customer.measurementsByLineItem[lineItem.id] ?? {}}
                                customerId={customer.customerId}
                                onChange={(componentId, next) =>
                                  handleChangeCustomerMeasurements(customer.key, lineItem.id, componentId, next)
                                }
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    </>
                  )}
                </Paper>
              );
            })}
          </Stack>

          <Button variant="outlined" onClick={handleAddCustomer} sx={{ mb: 3 }}>
            Add Customer
          </Button>

          <Divider sx={{ mb: 2 }} />

          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}
          {!canSubmit && customers.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }} data-testid="incomplete-group-customers-warning">
              Every customer needs to be picked (or created) and their measurements finished before this group can be
              placed.
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

          <CustomerQuickCreateDialog
            open={quickCreateTargetKey !== null}
            retailerId={retailerId}
            onClose={() => setQuickCreateTargetKey(null)}
            onCreated={(customer) => {
              if (quickCreateTargetKey) handleCustomerCreated(quickCreateTargetKey, customer);
            }}
          />
        </>
      )}
    </Box>
  );
}
