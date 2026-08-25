import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginationControls } from "./PaginationControls";
import { usePagination } from "../hooks/usePagination";

describe("PaginationControls", () => {
  it("renders the real total/page/pageSize it's given", () => {
    render(
      <PaginationControls total={137} page={2} pageSize={25} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
    );
    // MUI's default "26–50 of 137" range text for page=2 (0-indexed 1), pageSize=25.
    expect(screen.getByText(/26.*50 of 137/)).toBeInTheDocument();
  });

  it("clicking next-page translates MUI's 0-indexed page back to a 1-indexed onPageChange call", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        total={100}
        page={1}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /next page/i }));
    // MUI internally advances its own 0-indexed page from 0 to 1; the
    // component must translate that back to 1-indexed page 2, not raw 1.
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("clicking previous-page from a non-first page translates correctly", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        total={100}
        page={3}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /previous page/i }));
    // page=3 (1-indexed) is MUI's raw page 2; "previous" takes MUI to 1, which
    // translates back to 1-indexed page 2 — not MUI's own raw 1.
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("changing rows-per-page calls onPageSizeChange with the selected numeric value", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <PaginationControls total={100} page={1} pageSize={25} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />
    );
    await user.click(screen.getByRole("combobox", { name: /rows per page/i }));
    await user.click(await screen.findByRole("option", { name: "50" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("respects a custom rowsPerPageOptions list", async () => {
    const user = userEvent.setup();
    render(
      <PaginationControls
        total={100}
        page={1}
        pageSize={5}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        rowsPerPageOptions={[5, 15]}
      />
    );
    await user.click(screen.getByRole("combobox", { name: /rows per page/i }));
    expect(screen.getByRole("option", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "15" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "25" })).not.toBeInTheDocument();
  });

  it("integration with usePagination(): clicking next advances the shared 1-indexed page by exactly 1", async () => {
    const user = userEvent.setup();

    function Harness() {
      const pagination = usePagination();
      const [total] = useState(60);
      return (
        <div>
          <div data-testid="current-page">{pagination.page}</div>
          <PaginationControls total={total} {...pagination} />
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("current-page")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByTestId("current-page")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByTestId("current-page")).toHaveTextContent("3");
  });
});
