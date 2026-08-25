import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SuperProduct, SuperProductComponent } from "../catalog/superProductsApi";
import {
  LineItemMeasurementsPanel,
  useLineItemMeasurementsCompleteness,
  createEmptyLineItemMeasurementsDraft,
} from "./LineItemMeasurementsPanel";
import type { LineItemComponentMeasurementDraft, LineItemMeasurementsDraft } from "./LineItemMeasurementsPanel";
import { StylingAccordion, emptyUnitStylingDraft } from "./StylingAccordion";
import type { UnitStylingDraft } from "./StylingAccordion";
import { useLineItemStylingCompleteness } from "./lineItemStylingCompleteness";
import "../../styles/legacyAdmin/Step4.css";

/**
 * One cart line item — one super product, N physical units. Decision 1: no
 * `quantity` field exists here as a number the server ever sees; `quantity`
 * is always `stylingDrafts.length`, kept in sync at every mutation site below
 * (Group 5's own spec: "matching this line item's quantity to its draft
 * array length at all times"). `measurementsDraft` is the one shared entry
 * per (line item × component), Decision 3.
 */
export interface LineItemDraft {
  /** Client-only key (not sent to the server) — `superProductId` alone can't be a React key since Group 7 forbids adding the same super product twice, but during a fast add/remove/re-add sequence index-based keys would misattribute state, so a stable id is generated once per line item instead. */
  id: string;
  superProductId: string;
  measurementsDraft: LineItemMeasurementsDraft;
  stylingDrafts: UnitStylingDraft[];
}

export function createLineItemDraft(superProduct: SuperProduct): LineItemDraft {
  return {
    id: crypto.randomUUID(),
    superProductId: superProduct.id,
    measurementsDraft: createEmptyLineItemMeasurementsDraft(superProduct.components),
    stylingDrafts: [emptyUnitStylingDraft(superProduct.components)],
  };
}

const missingStyle = { color: "red", cursor: "pointer", fontWeight: 600 } as const;
const completeStyle = { color: "green", cursor: "pointer", fontWeight: 600 } as const;

type FocusedPanel = "measurements" | "styling";

export interface OrderCartStepProps {
  superProducts: SuperProduct[];
  lineItems: LineItemDraft[];
  /** PHASE_10_TASKS.md Workstream D Group 3 — threaded to `<LineItemMeasurementsPanel>` for its customer measurement profile pre-fill. */
  customerId: string | null;
  onAddLineItem: (superProductId: string) => void;
  onRemoveLineItem: (id: string) => void;
  onChangeQuantity: (id: string, nextQuantity: number) => void;
  onChangeMeasurements: (id: string, componentId: string, next: LineItemComponentMeasurementDraft) => void;
  onChangeStyling: (id: string, next: UnitStylingDraft[]) => void;
  /** PHASE_10_TASKS.md Workstream E Group 6.3c — threaded straight through to `<LineItemMeasurementsPanel>`'s identically-optional prop of the same name; see its doc comment. */
  onOpenManualSize?: (lineItemId: string, component: SuperProductComponent) => void;
  /**
   * `NewGroupOrderPage.tsx`'s shared, group-level cart-building step (built
   * before any customer exists — measurements are entered per-customer,
   * later, against this same shared cart) has no customer to enter
   * measurements against yet, so a "Measurement: Missing" status the user
   * can click but that leads nowhere useful would be confusing rather than a
   * real entry point. Purely additive and optional — omitted (falsy) by
   * every other caller (`OrderBuilderPage.tsx`'s create/edit modes), whose
   * rendered table/column count is therefore completely unchanged.
   */
  hideMeasurements?: boolean;
}

/**
 * PHASE_9_TASKS.md Group 7: rebuilds the Super Product step from a
 * single-select list into a real multi-line-item cart, verbatim-styled off
 * legacy `Step4.jsx`'s real product-add `<select>` + `.table` markup (see
 * `Step4.css`'s own comment for exactly which classes and where their real
 * rules live). Composes Group 6's `<LineItemMeasurementsPanel>` and Group 5's
 * `<StylingAccordion>` as two genuinely separate inline entry points per line
 * item (not modals, matching legacy's real `Measurements.jsx`/
 * `MissingFabric.jsx` split) rather than one merged view.
 *
 * Fully controlled for order data (`lineItems` + the five callbacks); the
 * only local state is which line item's Measurement/Styling panel is
 * currently focused open below the table — transient UI, not order data a
 * parent needs to persist, same rationale `StylingAccordion`'s own
 * `expandedUnit` uses.
 */
export function OrderCartStep({
  superProducts,
  lineItems,
  customerId,
  onAddLineItem,
  onRemoveLineItem,
  onChangeQuantity,
  onChangeMeasurements,
  onChangeStyling,
  onOpenManualSize,
  hideMeasurements = false,
}: OrderCartStepProps) {
  const [focused, setFocused] = useState<{ lineItemId: string; panel: FocusedPanel } | null>(null);

  const availableSuperProducts = superProducts.filter(
    (sp) => !lineItems.some((item) => item.superProductId === sp.id)
  );

  const totalQuantity = lineItems.reduce((sum, item) => sum + item.stylingDrafts.length, 0);

  function handleAdd(event: React.ChangeEvent<HTMLSelectElement>) {
    const superProductId = event.target.value;
    event.target.value = "";
    if (!superProductId) return;
    onAddLineItem(superProductId);
  }

  function handleRemove(id: string) {
    onRemoveLineItem(id);
    setFocused((current) => (current?.lineItemId === id ? null : current));
  }

  const focusedItem = focused ? lineItems.find((item) => item.id === focused.lineItemId) : undefined;
  const focusedSuperProduct = focusedItem
    ? superProducts.find((sp) => sp.id === focusedItem.superProductId)
    : undefined;

  return (
    <Box>
      <div className="searchinput-inner">
        <p>
          Product <span className="red-required">*</span>
        </p>
        <select className="searchinput" aria-label="Product" value="" onChange={handleAdd}>
          <option value="">Select a Product</option>
          {availableSuperProducts.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            {!hideMeasurements && <th>Measurement</th>}
            <th>fabric &amp; styling</th>
            <th>QTY</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length > 0 ? (
            lineItems.map((item) => {
              const superProduct = superProducts.find((sp) => sp.id === item.superProductId);
              if (!superProduct) return null;
              return (
                <LineItemRow
                  key={item.id}
                  item={item}
                  superProduct={superProduct}
                  hideMeasurementsColumn={hideMeasurements}
                  isMeasurementsFocused={focused?.lineItemId === item.id && focused.panel === "measurements"}
                  isStylingFocused={focused?.lineItemId === item.id && focused.panel === "styling"}
                  onFocusMeasurements={() => setFocused({ lineItemId: item.id, panel: "measurements" })}
                  onFocusStyling={() => setFocused({ lineItemId: item.id, panel: "styling" })}
                  onQuantityChange={(next) => onChangeQuantity(item.id, next)}
                  onDelete={() => handleRemove(item.id)}
                />
              );
            })
          ) : (
            <tr>
              <td style={{ color: "red" }}>Please select product here.....</td>
            </tr>
          )}
          <tr>
            <td className="undrLine"> </td>
            {!hideMeasurements && <td className="undrLine"> </td>}
            <td className="undrLine"> </td>
            <td className="undrLine">
              <strong className="pl_20">Total =</strong>
            </td>
            <td className="text-center undrLine">
              <strong className="pl_20">{totalQuantity}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {focusedItem && focusedSuperProduct && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            {focusedSuperProduct.name} — {focused?.panel === "measurements" ? "Measurements" : "Fabric & Styling"}
          </Typography>
          {focused?.panel === "measurements" ? (
            <LineItemMeasurementsPanel
              components={focusedSuperProduct.components}
              draft={focusedItem.measurementsDraft}
              customerId={customerId}
              onChange={(componentId, next) => onChangeMeasurements(focusedItem.id, componentId, next)}
              {...(onOpenManualSize
                ? { onOpenManualSize: (component: SuperProductComponent) => onOpenManualSize(focusedItem.id, component) }
                : {})}
            />
          ) : (
            <StylingAccordion
              components={focusedSuperProduct.components}
              quantity={focusedItem.stylingDrafts.length}
              value={focusedItem.stylingDrafts}
              onChange={(next) => onChangeStyling(focusedItem.id, next)}
              onDeleteUnit={(index) => {
                // Mirrors the qty stepper's own "minimum 1" floor (Group 7's
                // own spec) — deleting a specific unit is equivalent to
                // decrementing quantity by one, so it can't go below 1 either.
                if (focusedItem.stylingDrafts.length <= 1) return;
                onChangeStyling(
                  focusedItem.id,
                  focusedItem.stylingDrafts.filter((_, i) => i !== index)
                );
              }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

interface LineItemRowProps {
  item: LineItemDraft;
  superProduct: SuperProduct;
  /** Mirrors `OrderCartStepProps.hideMeasurements` — see its doc comment. */
  hideMeasurementsColumn: boolean;
  isMeasurementsFocused: boolean;
  isStylingFocused: boolean;
  onFocusMeasurements: () => void;
  onFocusStyling: () => void;
  onQuantityChange: (nextQuantity: number) => void;
  onDelete: () => void;
}

/**
 * Its own component (not inlined in the `.map()` above) specifically so its
 * two completeness hooks (`useLineItemMeasurementsCompleteness`/
 * `useLineItemStylingCompleteness`) are called unconditionally once per
 * mounted row instance — calling a hook a variable number of times inside one
 * parent component's own body (once per line item, a count that changes as
 * the cart grows/shrinks) would violate rules-of-hooks; mapping distinct
 * component instances, each with their own stable hook calls, does not.
 */
function LineItemRow({
  item,
  superProduct,
  hideMeasurementsColumn,
  isMeasurementsFocused,
  isStylingFocused,
  onFocusMeasurements,
  onFocusStyling,
  onQuantityChange,
  onDelete,
}: LineItemRowProps) {
  const measurementsComplete = useLineItemMeasurementsCompleteness(superProduct.components, item.measurementsDraft);
  const stylingComplete = useLineItemStylingCompleteness(superProduct.components, item.stylingDrafts);
  const quantity = item.stylingDrafts.length;

  return (
    <tr data-testid={`line-item-row-${superProduct.id}`}>
      <td>{superProduct.name.toUpperCase()}</td>
      {!hideMeasurementsColumn && (
        <td>
          <span
            role="button"
            tabIndex={0}
            data-testid="measurement-status"
            style={{ ...(measurementsComplete ? completeStyle : missingStyle), ...(isMeasurementsFocused ? { textDecoration: "underline" } : {}) }}
            onClick={onFocusMeasurements}
          >
            {measurementsComplete ? "Complete" : "Missing"}
          </span>
        </td>
      )}
      <td className="styleFabricsTD">
        <span
          role="button"
          tabIndex={0}
          data-testid="styling-status"
          style={{ ...(stylingComplete ? completeStyle : missingStyle), ...(isStylingFocused ? { textDecoration: "underline" } : {}) }}
          onClick={onFocusStyling}
        >
          {stylingComplete ? "Complete" : "Missing"}
        </span>
      </td>
      <td>
        <Button className="minusIc" onClick={() => onQuantityChange(quantity - 1)} disabled={quantity <= 1}>
          -
        </Button>
        <span className="countOutput">{quantity}</span>
        <Button className="plusIc" onClick={() => onQuantityChange(quantity + 1)}>
          +
        </Button>
      </td>
      <td>
        <button type="button" className="delete-Btn" onClick={onDelete}>
          Delete
        </button>
      </td>
    </tr>
  );
}
