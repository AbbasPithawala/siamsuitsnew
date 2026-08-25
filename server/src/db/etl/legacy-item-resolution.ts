import { and, eq } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { productProcesses } from "../schema/index";
import { findProcessByName } from "./catalog";

interface LegacyOrderItemLite {
  item_name: string;
  quantity?: number;
}

/** How many `order_items` rows one legacy `order_items[]` entry expands into — `quantity` copies of the exact same styling/measurements, matching `orders.ts#expandLegacyItemsToUnits`. */
export function legacyItemUnitCount(item: LegacyOrderItemLite): number {
  return item.quantity && item.quantity > 0 ? item.quantity : 1;
}

/**
 * Finds which *expanded* `order_items` row (1-based `sequence`, matching how `orders.ts`
 * creates them: `quantity` sequential rows per legacy array entry) a manufacturing key (or a
 * job/extra-payment `item_code`'s suffix) belongs to.
 *
 * A legacy order_item's `quantity` > 1 (e.g. "order 3 shirts") is *not* three array entries
 * — it's one entry whose manufacturing/style keys enumerate per-unit suffixes `_0`.._`(N-1)`
 * (all N physical units share the one `styles[0]` block; legacy never varies styling by
 * unit). The key's suffix is that per-unit index, not an "occurrence among same-named
 * items" index — real orders never repeat an `item_name` across separate array entries, only
 * via `quantity` within one entry (verified against production data while building this
 * ETL). The suffix's *middle* segment (present for bundled items, e.g. `suit_jacket_0`) is
 * ignored here — see `manufacturing.ts`'s top comment for why it's unreliable.
 */
export function matchLegacyItem(items: LegacyOrderItemLite[], manufacturingKey: string): { sequence: number } | null {
  let sequenceAtStartOfEntry = 1;
  for (const item of items) {
    const unitCount = legacyItemUnitCount(item);
    const prefix = `${item.item_name}_`;
    if (manufacturingKey.startsWith(prefix)) {
      const afterPrefix = manufacturingKey.slice(prefix.length);
      const lastSegment = afterPrefix.split("_").at(-1) ?? "";
      if (/^\d+$/.test(lastSegment)) {
        const unitIndex = Number(lastSegment);
        if (unitIndex < unitCount) return { sequence: sequenceAtStartOfEntry + unitIndex };
      }
      return null; // name matched but the unit index didn't fit this entry's quantity — a real mismatch, not a name collision worth scanning further for.
    }
    sequenceAtStartOfEntry += unitCount;
  }
  return null;
}

/** For a standalone (1-component) item there's nothing to disambiguate; for a bundled item, picks whichever component's `product_processes` actually contains this process name. */
export async function resolveComponentForProcess(
  tenantId: string,
  components: { componentId: string; productId: string; productName: string }[],
  processName: string
): Promise<{ componentId: string } | null> {
  if (components.length === 1) return { componentId: components[0]!.componentId };

  return withTenant(tenantId, async (tx) => {
    for (const component of components) {
      const process = await findProcessByName(tx, tenantId, processName);
      if (!process) continue;
      const link = await tx.query.productProcesses.findFirst({
        where: and(eq(productProcesses.productId, component.productId), eq(productProcesses.processId, process.id)),
      });
      if (link) return { componentId: component.componentId };
    }
    return null;
  });
}
