/**
 * Shared shapes for PHASE_10_TASKS.md Workstream C's pagination convention.
 * The backend groups (Group 1 mandatory-mode, Group 2 opt-in-mode) return
 * this same envelope on every endpoint that opts into pagination — `page`/
 * `pageSize` are 1-indexed, matching `usePagination()`/`<PaginationControls>`
 * (`src/hooks/usePagination.ts`, `src/components/PaginationControls.tsx`).
 * Not wired into any real RTK Query endpoint yet (that's Group 4, once the
 * matching backend group lands) — this file just fixes the agreed shape so
 * Group 3's frontend pieces and Group 4's later consumers share one type.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Query-arg shape a paginated `useListXQuery` hook accepts. */
export interface PaginationQueryParams {
  page?: number;
  pageSize?: number;
}
