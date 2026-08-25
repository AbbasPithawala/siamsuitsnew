import { HttpError } from "./http-error";

/**
 * Shared by `orders.service.ts` (order_item_component_measurements) and
 * `measurementProfiles.service.ts` (customer_measurement_profile_values) — both tables
 * store the identical value/adjustmentValue/totalValue numeric shape.
 */
export function computeTotalValue(value: string | undefined, adjustmentValue: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const numericValue = Number(value);
  const numericAdjustment = adjustmentValue !== undefined ? Number(adjustmentValue) : 0;
  if (Number.isNaN(numericValue) || Number.isNaN(numericAdjustment)) {
    throw new HttpError(400, "INVALID_MEASUREMENT_VALUE", "measurement value/adjustmentValue must be numeric strings");
  }
  return (numericValue + numericAdjustment).toFixed(2);
}
