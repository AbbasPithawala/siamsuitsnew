import { getApiErrorCode, getApiErrorMessage } from "../../api/errorUtils";

/**
 * PHASE_6_TASKS.md Group 10's "surface Group 2's incomplete-manufacturing
 * rejection clearly" requirement — same `manufacturingErrors.ts`-style
 * code-to-copy mapping Group 7 established, applied to `shipping.service.ts`'s
 * error codes instead.
 *
 * `MANUFACTURING_INCOMPLETE` is deliberately NOT listed here. Unlike the
 * other codes below (whose server messages are generic/interpolate only an
 * id), `requireCompleteManufacturing`'s own message is already a real,
 * specific sentence naming exactly which process(es) are still pending and
 * their status (e.g. "manufacturing step(s) not complete: Lining
 * (pending)") — replacing it with a generic string here would make the
 * message *less* specific, not more. Falling through to
 * `getApiErrorMessage`'s server-message default is the correct behavior for
 * this one code.
 */
const SHIPPING_ERROR_MESSAGES: Record<string, string> = {
  SHIPPING_BOX_NOT_FOUND: "No shipping box was found with that ID.",
  BOX_CLOSED: "This shipping box is closed — it can no longer accept or remove items.",
  BOX_ALREADY_CLOSED: "This shipping box has already been closed.",
  COMPONENT_NOT_FOUND: "No order item component was found with that ID.",
  DUPLICATE_SHIPPING_BOX_ITEM: "That component is already packed in this shipping box.",
  SHIPPING_BOX_ITEM_NOT_FOUND: "That component isn't packed in this shipping box.",
};

export function getShippingErrorMessage(error: unknown, fallback: string): string {
  const code = getApiErrorCode(error);
  if (code && SHIPPING_ERROR_MESSAGES[code]) {
    return SHIPPING_ERROR_MESSAGES[code];
  }
  return getApiErrorMessage(error, fallback);
}
