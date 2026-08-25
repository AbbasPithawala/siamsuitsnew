import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, usePagination } from "./usePagination";

describe("usePagination", () => {
  it("defaults to page 1, pageSize 25, matching the backend's mandatory-mode defaults", () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it("honors initialPage/initialPageSize overrides", () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3, initialPageSize: 50 }));
    expect(result.current.page).toBe(3);
    expect(result.current.pageSize).toBe(50);
  });

  it("onPageChange updates page in 1-indexed terms, leaving pageSize untouched", () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.onPageChange(4));
    expect(result.current.page).toBe(4);
    expect(result.current.pageSize).toBe(25);
  });

  it("onPageSizeChange updates pageSize and resets page back to 1", () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.onPageChange(5));
    expect(result.current.page).toBe(5);

    act(() => result.current.onPageSizeChange(100));
    expect(result.current.pageSize).toBe(100);
    expect(result.current.page).toBe(1);
  });

  it("returns stable handler identities across re-renders (safe to pass as memoized props)", () => {
    const { result, rerender } = renderHook(() => usePagination());
    const firstOnPageChange = result.current.onPageChange;
    const firstOnPageSizeChange = result.current.onPageSizeChange;
    rerender();
    expect(result.current.onPageChange).toBe(firstOnPageChange);
    expect(result.current.onPageSizeChange).toBe(firstOnPageSizeChange);
  });
});
