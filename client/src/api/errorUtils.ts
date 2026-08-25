import type { ApiError, ApiErrorBody } from "./baseApi";

/**
 * RTK Query types a query/mutation result's `.error` as
 * `FetchBaseQueryError | SerializedError` (the latter covers uncaught
 * exceptions inside the query fn itself, which `fetchBaseQuery` doesn't
 * throw). This narrows it back to the shape `baseApi`'s base query actually
 * produces.
 */
export function isFetchBaseQueryError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "status" in error;
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "object"
  );
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isFetchBaseQueryError(error)) {
    if (isApiErrorBody(error.data) && error.data.error.message) {
      return error.data.error.message;
    }
    if (typeof error.status === "number") {
      return `Request failed (${error.status}).`;
    }
  }
  return fallback;
}

/**
 * The server's `HttpError` machine-readable `code` (e.g. `STEP_LOCKED`,
 * `NOT_CERTIFIED`) rather than its human-readable `message`. Used where a
 * caller wants to react differently per error kind — the manufacturing
 * screens (PHASE_6_TASKS.md Group 7) map this onto its own friendlier
 * per-code copy via `getManufacturingErrorMessage` instead of just relaying
 * the backend's own (already reasonable, but generic) message text.
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (isFetchBaseQueryError(error) && isApiErrorBody(error.data)) {
    return error.data.error.code;
  }
  return undefined;
}
