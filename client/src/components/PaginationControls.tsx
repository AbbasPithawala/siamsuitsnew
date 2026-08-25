import TablePagination from "@mui/material/TablePagination";

export interface PaginationControlsProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  rowsPerPageOptions?: number[];
}

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

/**
 * Thin wrapper over MUI's `TablePagination` (PHASE_10_TASKS.md Workstream C
 * Group 3) — consumes the uniform `{ page, pageSize, total }` shape every
 * Group 1/2 backend endpoint's `pagination` envelope returns
 * (`src/api/pagination.ts`), in the backend's own 1-indexed terms.
 *
 * This is the *only* place in the app that deals with MUI's 0-indexed
 * `page` prop: `page - 1` going in, `newPage + 1` coming back out. Every
 * other consumer (`usePagination()`, RTK Query list endpoints) stays
 * entirely in 1-indexed terms.
 *
 * Pairs directly with `usePagination()`:
 * ```
 * const pagination = usePagination();
 * const { data } = useListXQuery({ page: pagination.page, pageSize: pagination.pageSize });
 * <PaginationControls total={data?.pagination.total ?? 0} {...pagination} />
 * ```
 */
export function PaginationControls({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
}: PaginationControlsProps) {
  return (
    <TablePagination
      component="div"
      count={total}
      page={page - 1}
      rowsPerPage={pageSize}
      rowsPerPageOptions={rowsPerPageOptions}
      onPageChange={(_event, newPage) => onPageChange(newPage + 1)}
      onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
    />
  );
}
