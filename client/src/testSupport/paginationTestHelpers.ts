import { expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Shared assertions for PHASE_10_TASKS.md Workstream C Group 4's live tests —
 * every one of the 13 paginated admin list pages renders the same
 * `<PaginationControls>` (a thin wrapper over MUI `TablePagination`), so this
 * factors out the "switch rows-per-page to 10, read the real range text,
 * click next, confirm the range text/rows actually changed" sequence common
 * to all of them, rather than repeating it with copy-paste drift 13 times.
 */

export const PAGINATION_NETWORK_WAIT = { timeout: 15000 };

export async function switchRowsPerPage(user: UserEvent, rowsPerPage: number, container: HTMLElement = document.body): Promise<void> {
  const combobox = within(container).getByRole("combobox", { name: /rows per page/i });
  await user.click(combobox);
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: String(rowsPerPage) }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

/** Reads MUI `TablePagination`'s own "X–Y of Z" range text directly off the DOM. */
export function getPaginationRangeText(container: HTMLElement = document.body): string {
  const el = container.querySelector(".MuiTablePagination-displayedRows");
  if (!el?.textContent) throw new Error("Pagination range text not found — is <PaginationControls> rendered?");
  return el.textContent;
}

export function parsePaginationTotal(rangeText: string): number {
  const match = /of (\d+)/.exec(rangeText);
  if (!match) throw new Error(`Could not parse a total out of pagination range text: "${rangeText}"`);
  return Number(match[1]);
}

export async function clickNextPage(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: /next page/i }));
}

export async function waitForRangeText(pattern: RegExp, container: HTMLElement = document.body): Promise<void> {
  await waitFor(() => expect(getPaginationRangeText(container)).toMatch(pattern), PAGINATION_NETWORK_WAIT);
}

/**
 * The pagination range text (`getPaginationRangeText`) updates the instant a page/page-size
 * change is requested — it's derived from local `usePagination()` state, not the fetch
 * result — so waiting on it alone doesn't prove the real second page of data has actually
 * arrived and rendered. This reads the first real data row (skipping the header row) so
 * callers can wait for the *content* to change, not just the range label.
 */
export function getFirstDataRowText(container: HTMLElement = document.body): string | null {
  const table = within(container).getByRole("table");
  const rows = within(table).getAllByRole("row");
  return rows[1]?.textContent ?? null;
}

export async function waitForFirstDataRowChange(previousText: string | null, container: HTMLElement = document.body): Promise<void> {
  await waitFor(() => expect(getFirstDataRowText(container)).not.toBe(previousText), PAGINATION_NETWORK_WAIT);
}
