import { getApiErrorCode, getApiErrorMessage } from "../../api/errorUtils";

/**
 * PHASE_6_TASKS.md Group 7's "clear sequential-dependency UX" requirement:
 * turn the backend's real error codes (Phase 3 Group 4's `STEP_LOCKED`/
 * `STEP_IN_PROGRESS`/`NO_STEP_AVAILABLE`, plus the certification and
 * extra-payment validation codes Phase 3 Groups 0/5 added) into specific,
 * actionable copy instead of relaying the raw request failure. Falls back to
 * `getApiErrorMessage`'s already-reasonable server-provided message for any
 * code not listed here, so nothing is ever left unexplained.
 */
const MANUFACTURING_ERROR_MESSAGES: Record<string, string> = {
  STEP_LOCKED: "The previous manufacturing step on this component isn't complete yet — finish that one before assigning this one.",
  STEP_IN_PROGRESS: "A step on this component is already assigned to a tailor — complete it before assigning the next one.",
  NO_STEP_AVAILABLE: "Every manufacturing step on this component is already complete — there is nothing left to assign.",
  NOT_CERTIFIED: "That tailor isn't certified for the process this step requires.",
  NO_MANUFACTURING_STEPS: "This component has no manufacturing steps defined.",
  COMPONENT_NOT_FOUND: "No order item component was found with that ID.",
  STEP_NOT_STARTED: "This job hasn't been assigned to a tailor yet, so it can't be completed.",
  STEP_ALREADY_COMPLETE: "This job is already complete.",
  JOB_NOT_FOUND: "No job was found with that ID.",
  CATEGORY_PROCESS_MISMATCH: "That extra payment category is paid during a different process than this job's step.",
  CATEGORY_PRODUCT_MISMATCH: "That extra payment category doesn't apply to this component's product.",
  STYLE_NOT_SELECTED: "That extra payment category's feature/style wasn't actually selected on this order.",
  DUPLICATE_EXTRA_PAYMENT: "This job already has an extra payment for that category.",
  EXTRA_PAYMENT_NOT_FOUND: "That extra payment no longer exists.",
  EXTRA_PAYMENT_ALREADY_APPROVED: "That extra payment was already approved and can't be removed here.",
  ALREADY_APPROVED: "That extra payment was already approved.",
  ALREADY_REJECTED: "That extra payment was already rejected.",
};

export function getManufacturingErrorMessage(error: unknown, fallback: string): string {
  const code = getApiErrorCode(error);
  if (code && MANUFACTURING_ERROR_MESSAGES[code]) {
    return MANUFACTURING_ERROR_MESSAGES[code];
  }
  return getApiErrorMessage(error, fallback);
}

/**
 * Same copy table as above, keyed directly off a bare code rather than an
 * error response — used for `getComponentDetail`'s `blockedReason`
 * (`STEP_LOCKED`/`STEP_IN_PROGRESS`/`NO_STEP_AVAILABLE`), which is a
 * proactive read-time field, not a failed request, so there's no
 * `FetchBaseQueryError` to pull a code off of.
 */
export function getMessageForCode(code: string | null, fallback: string): string {
  if (code && MANUFACTURING_ERROR_MESSAGES[code]) {
    return MANUFACTURING_ERROR_MESSAGES[code];
  }
  return fallback;
}
