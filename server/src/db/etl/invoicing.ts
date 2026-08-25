import { and, eq } from "drizzle-orm";
import { withTenant } from "../withTenant";
import { retailerInvoices } from "../schema/index";
import { getLegacyDb } from "./legacy-mongo";
import { idToString } from "./legacy-mongo";
import { requireMigratedRetailerId } from "./retailers";
import type { EtlDomainResult } from "./result";

/** `siamServer/admin/model/model.retailerInvoice.js`. Note: `model.invoice.js` (Mongoose model `Invoice`) is dead code — its only route file (`router.invoice.js`) is entirely commented out, and there is no `invoices` collection in the live database at all (confirmed against the real Mongo instance while scoping this ETL). Only `retailerinvoices` has real data. */
interface LegacyRetailerInvoice {
  _id: unknown;
  retailer_code?: string;
  invoice_number: string;
  orders?: unknown[];
  total_price?: number;
  shipping_charge?: number;
  discount?: number;
  total_amount?: number;
  date?: number;
}

/**
 * Idempotency: `retailer_invoices` has a real unique `(tenantId, invoiceNumber)` index —
 * the natural key, same one `invoices.service.ts#generateInvoiceNumber` relies on.
 *
 * The new schema's `retailer_invoices` has no `orders[]` relation at all (unlike legacy) —
 * only a `lineItems` jsonb blob. This ETL preserves which legacy orders the invoice covered
 * by naming them in the single reconstructed line item's `description`, since there's no
 * structured place for it; the real dollar amounts (`discount`/`shippingCharge`/`total`) are
 * preserved exactly as legacy recorded them, not recomputed.
 */
export async function migrateRetailerInvoices(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyInvoices = await db.collection<LegacyRetailerInvoice>("retailerinvoices").find({}).toArray();
  const legacyOrders = await db.collection<{ _id: unknown; orderId: string }>("orders").find({}).toArray();
  const legacyOrderById = new Map(legacyOrders.map((o) => [idToString(o._id), o.orderId]));

  const result: EtlDomainResult = { domain: "retailer_invoices", found: legacyInvoices.length, migrated: 0, skipped: [] };

  for (const legacy of legacyInvoices) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const invoiceNumber = legacy.invoice_number?.trim();
    const code = legacy.retailer_code?.trim();
    if (!invoiceNumber || !code) {
      result.skipped.push({ legacyId, reason: "missing invoice_number or retailer_code" });
      continue;
    }

    let retailerId: string;
    try {
      retailerId = await requireMigratedRetailerId(tenantId, code);
    } catch {
      result.skipped.push({ legacyId, reason: `references retailer_code "${code}" which was not migrated` });
      continue;
    }

    const orderNumbers = (legacy.orders ?? []).map((id) => legacyOrderById.get(idToString(id)) ?? String(id));
    const total = legacy.total_amount ?? 0;
    const subTotal = legacy.total_price ?? total;

    await withTenant(tenantId, async (tx) => {
      const existing = await tx.query.retailerInvoices.findFirst({ where: and(eq(retailerInvoices.tenantId, tenantId), eq(retailerInvoices.invoiceNumber, invoiceNumber)) });
      if (existing) return;

      await tx.insert(retailerInvoices).values({
        tenantId,
        retailerId,
        invoiceNumber,
        lineItems: [
          {
            description: orderNumbers.length > 0 ? `Orders: ${orderNumbers.join(", ")}` : `Migrated from legacy invoice ${invoiceNumber}`,
            quantity: 1,
            unitPrice: subTotal,
            amount: subTotal,
          },
        ],
        discount: (legacy.discount ?? 0).toFixed(2),
        shippingCharge: (legacy.shipping_charge ?? 0).toFixed(2),
        total: total.toFixed(2),
        status: "Unpaid",
        createdAt: legacy.date ? new Date(legacy.date) : new Date(),
        updatedAt: legacy.date ? new Date(legacy.date) : new Date(),
      });
    });
    result.migrated++;
  }

  return result;
}
