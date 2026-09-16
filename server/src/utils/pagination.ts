import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const pageField = z.coerce.number().int().min(1);
const pageSizeField = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE);

/**
 * Two rollout modes across this codebase's `listX` endpoints (PHASE_10_TASKS.md
 * Workstream C — page/pageSize, not cursor-based; see that doc for the full rationale):
 *
 * - **Mandatory mode** (`paginationQuerySchema`) — single-purpose endpoints (Retailers,
 *   Orders, Invoices, Shipping Boxes, Tailors, Users, Roles, Extra Payment Categories,
 *   Order Groups). Nothing else in the app fetches these unfiltered for a picker, so
 *   omitting `page`/`pageSize` still resolves to page 1 of 25, not everything — that's the
 *   actual fix for these lists' unbounded-growth problem.
 * - **Opt-in mode** (`optionalPaginationQuerySchema`) — dual-purpose endpoints (Customers,
 *   Products, Super Products, Features with no `productId`, Measurement Definitions,
 *   Processes) also consumed unfiltered by the order-builder's own pickers (e.g. the
 *   customer picker). Omitting `page`/`pageSize` must keep returning the exact same full
 *   unpaginated `{ data: [...] }` shape as before this convention existed — pagination
 *   only activates once the caller explicitly sends a `page` and/or `pageSize`.
 *
 * Both merge into each route's own filter query schema via `.merge()`.
 */
export const paginationQuerySchema = z.object({
  page: pageField.default(DEFAULT_PAGE),
  pageSize: pageSizeField.default(DEFAULT_PAGE_SIZE),
});

export const optionalPaginationQuerySchema = z.object({
  page: pageField.optional(),
  pageSize: pageSizeField.optional(),
});

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGINATION: PaginationParams = { page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE };

export interface Pagination extends PaginationParams {
  total: number;
  totalPages: number;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  pagination: Pagination;
}

/** Drizzle's `.limit()/.offset()` pair for a 1-indexed `page`. */
export function toLimitOffset(page: number, pageSize: number): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

/** The `{ data, pagination }` envelope — extends, not replaces, the existing `{ data: [...] }` convention. */
export function paginatedResult<T>(data: T[], total: number, page: number, pageSize: number): PaginatedEnvelope<T> {
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

/**
 * Opt-in mode's resolution rule: pagination only activates when the caller explicitly
 * sent `page` and/or `pageSize` — omitting both must keep returning the full unpaginated
 * list every existing non-admin-table caller (order-builder pickers, `FeatureSelector`,
 * `MeasurementForm`) already relies on. Sending just one of the two still opts in, with
 * the other field defaulted.
 */
export function resolveOptionalPagination(query: {
  page?: number | undefined;
  pageSize?: number | undefined;
}): PaginationParams | undefined {
  if (query.page === undefined && query.pageSize === undefined) return undefined;
  return { page: query.page ?? DEFAULT_PAGE, pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE };
}
