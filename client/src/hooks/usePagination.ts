import { useCallback, useState } from "react";

/** Matches the backend's mandatory-mode defaults (PHASE_10_TASKS.md Workstream C Group 0). */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export interface UsePaginationResult {
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Owns `{ page, pageSize }` state in the backend's own 1-indexed terms — the
 * `page`/`pageSize` query params every Workstream C endpoint accepts and the
 * `pagination.page`/`pagination.pageSize` an endpoint's response echoes back
 * (`src/api/pagination.ts`). `<PaginationControls>` is the only place that
 * translates to/from MUI `TablePagination`'s 0-indexed `page` prop — this
 * hook and every consumer of it never touch MUI's indexing at all.
 *
 * Changing `pageSize` resets `page` back to 1: a stale page number computed
 * against the old page size (e.g. page 4 of 25-per-page) is usually
 * meaningless once the page size changes, and re-fetching page 1 of the new
 * size is the least-surprising default.
 *
 * Typical usage:
 * ```
 * const pagination = usePagination();
 * const { data } = useListXQuery({ page: pagination.page, pageSize: pagination.pageSize });
 * <PaginationControls total={data?.pagination.total ?? 0} {...pagination} />
 * ```
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const { initialPage = DEFAULT_PAGE, initialPageSize = DEFAULT_PAGE_SIZE } = options;
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const onPageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const onPageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(DEFAULT_PAGE);
  }, []);

  return { page, pageSize, onPageChange, onPageSizeChange };
}
