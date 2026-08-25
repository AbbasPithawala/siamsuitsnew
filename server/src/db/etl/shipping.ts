import { and, eq } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { shippingBoxes, shippingBoxItems, orderItemComponents, orderItems, orders } from "../schema/index";
import { getLegacyDb, idToString } from "./legacy-mongo";
import { requireMigratedRetailerId } from "./retailers";
import type { EtlDomainResult } from "./result";

/**
 * `siamServer/admin/model/shipping/model.shipping.js`. `FUNCTIONALITY_OVERVIEW.md`:
 * "Shipping-box barcoding... exists for tracking work but doesn't currently do anything" —
 * confirmed against the live database while scoping this ETL: the `shippingboxes`
 * collection has zero real documents. This module is implemented in full (idempotent,
 * matching every other domain's shape) for whenever that changes, but is expected to report
 * `found: 0, migrated: 0` against current production data — not a bug in the ETL.
 */
interface LegacyShippingBox {
  _id: unknown;
  name: string;
  retailer?: unknown;
  order_id?: unknown[];
  tracking_code?: string;
  isClosed?: boolean;
}

export async function migrateShippingBoxes(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyBoxes = await db.collection<LegacyShippingBox>("shippingboxes").find({}).toArray();
  const legacyRetailers = await db.collection<{ _id: unknown; retailer_code?: string }>("retailers").find({}).toArray();
  const legacyRetailerById = new Map(legacyRetailers.map((r) => [idToString(r._id), r.retailer_code]));
  const legacyOrders = await db.collection<{ _id: unknown; orderId: string }>("orders").find({}).toArray();
  const legacyOrderById = new Map(legacyOrders.map((o) => [idToString(o._id), o.orderId]));

  const result: EtlDomainResult = { domain: "shipping_boxes", found: legacyBoxes.length, migrated: 0, skipped: [] };

  for (const legacy of legacyBoxes) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const trackingCode = legacy.tracking_code?.trim() || legacy.name?.trim();
    const code = legacy.retailer ? legacyRetailerById.get(idToString(legacy.retailer)) : undefined;
    if (!trackingCode || !code) {
      result.skipped.push({ legacyId, reason: "missing tracking_code/name or unresolvable retailer" });
      continue;
    }

    let retailerId: string;
    try {
      retailerId = await requireMigratedRetailerId(tenantId, code);
    } catch {
      result.skipped.push({ legacyId, reason: `references retailer_code "${code}" which was not migrated` });
      continue;
    }

    const migrated = await withTenant(tenantId, async (tx) => {
      const existing = await tx.query.shippingBoxes.findFirst({ where: eq(shippingBoxes.trackingCode, trackingCode) });
      let box = existing;
      if (!box) {
        [box] = await tx.insert(shippingBoxes).values({ tenantId, retailerId, trackingCode, isClosed: legacy.isClosed ?? false }).returning();
      }
      if (!box) return { ok: false as const, reason: "failed to create shipping box" };

      let itemsAdded = 0;
      for (const legacyOrderIdRaw of legacy.order_id ?? []) {
        const orderNumber = legacyOrderById.get(idToString(legacyOrderIdRaw));
        if (!orderNumber) continue;
        const order = await tx.query.orders.findFirst({ where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)) });
        if (!order) continue;
        const items = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) });
        for (const item of items) {
          const components = await tx.query.orderItemComponents.findMany({ where: eq(orderItemComponents.orderItemId, item.id) });
          for (const component of components) {
            const existingItem = await tx.query.shippingBoxItems.findFirst({
              where: and(eq(shippingBoxItems.shippingBoxId, box!.id), eq(shippingBoxItems.orderItemComponentId, component.id)),
            });
            if (!existingItem) {
              await tx.insert(shippingBoxItems).values({ shippingBoxId: box!.id, orderItemComponentId: component.id });
              itemsAdded++;
            }
          }
        }
      }
      return { ok: true as const, itemsAdded };
    });

    if (!migrated.ok) {
      result.skipped.push({ legacyId, reason: migrated.reason });
      continue;
    }
    result.migrated++;
  }

  return result;
}
