/**
 * Colors lifted verbatim from legacy's real `.newOrderBg`/`.ProcessingBg`/`.ModifiedBg`/
 * `.ShipmentBg`/`.SentBg` classes (`dashboard.css`, `SingleOrder.css`, `customerOrder.css` —
 * identical rules in all three), keyed by `orders.status`'s real values. A status with no
 * legacy color (shouldn't happen — the set is closed today, see `orders.ts`'s own doc comment)
 * falls back to a plain default MUI Chip rather than guessing a color.
 *
 * Extracted out of `OrderListPage.tsx` (its original home) so `DashboardPage.tsx`'s "Orders by
 * Status" chart can reuse the identical, already-legacy-derived colors instead of a second copy
 * that could drift.
 */
export const STATUS_CHIP_COLORS: Record<string, { color: string; background: string }> = {
  "New Order": { color: "#009e15", background: "#009e153d" },
  Processing: { color: "#1300a5", background: "#334ad73d" },
  Modified: { color: "#cb7400", background: "#fff00045" },
  Shipment: { color: "#000000", background: "#3d3d3d45" },
  Sent: { color: "#a200ff", background: "#be00ff26" },
};
