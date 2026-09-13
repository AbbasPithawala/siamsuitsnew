import { and, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { withTenant } from "../db/withTenant";
import { orders, orderItems, orderItemComponents, customers, products, superProducts } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOwnedComponent } from "./manufacturing.service";
import { storageBackend } from "./storage.service";
import { escapeHtml, renderHtmlToPdfBuffer, titleCase } from "./pdfRenderer";

/**
 * Per-item shipping slip — legacy `OrderStatusBarcoding.jsx`'s "Generate QR" mode
 * (`generateQR`): given a component id, print a small landscape label with a QR code
 * (encoding the order's own display `orderNumber`, not the component id — this label
 * identifies which *order* a physical piece belongs to for shipping/sorting, same as
 * legacy) plus the order number, customer name, and "Nth of M" item text.
 *
 * Legacy derived "Nth of M" from a parsed index baked into its `item_code` string at
 * creation time (`"<orderId>/<product>_<index>"`). This rewrite's `order_item_components`
 * carries no such index — it's computed here instead: every component in the *same order*
 * sharing this component's `productId`, ordered by their parent `order_items.sequence`
 * (falling back to creation order within an order item, for the rare case of more than
 * one component of the same product on one order item), gives this component's 1-based
 * position and the total count. Semantically identical to legacy's baked-in index, just
 * derived instead of stored.
 *
 * 107×35mm landscape, matching legacy's own `new jsPDF('l', 'mm', [107, 35])` exactly —
 * this prints on the same physical label stock, so the page dimensions have to match
 * precisely, same reasoning as `jobSlipPdf.service.ts`'s doc comment. CSS flexbox
 * centering here does what legacy's manual `getTextWidth`-based centering math did,
 * without needing to hardcode font metrics.
 */

const SLIP_WIDTH_MM = 107;
const SLIP_HEIGHT_MM = 35;

const SLIP_STYLES = `
  body { margin: 0; width: ${SLIP_WIDTH_MM}mm; height: ${SLIP_HEIGHT_MM}mm; display: flex; align-items: center; justify-content: center; font-family: Helvetica, Arial, sans-serif; }
  .row { display: flex; align-items: center; gap: 2mm; }
  .qr { width: 30mm; height: 30mm; display: block; }
  .text-block { display: flex; flex-direction: column; gap: 1mm; }
  .text-block div { font-weight: bold; font-size: 12.5pt; text-transform: capitalize; white-space: nowrap; }
`;

function buildItemSlipHtml(orderNumber: string, customerName: string, itemText: string, qrDataUrl: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${SLIP_STYLES}</style>
  </head>
  <body>
    <div class="row">
      <img class="qr" src="${qrDataUrl}" alt="QR" />
      <div class="text-block">
        <div>${escapeHtml(orderNumber)}</div>
        <div>${escapeHtml(customerName)}</div>
        <div>${escapeHtml(itemText)}</div>
      </div>
    </div>
  </body>
</html>`;
}

function customerFullName(customer: { firstName: string; lastName: string | null }): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

export interface ItemSlipData {
  orderNumber: string;
  customerName: string;
  itemText: string;
  orderId: string;
}

/**
 * The data-resolution half of `generateItemSlipPdf`, split out (exported) so the
 * itemNumber/itemQuantity derivation can be tested directly against real fixtures without
 * spinning up Puppeteer for every case — same reasoning as `orderPdf.service.ts` exporting
 * `buildOrderPdfHtml` for its own fidelity tests, just one layer earlier (data, not markup).
 */
export async function resolveItemSlipData(tenantId: string, orderItemComponentId: string): Promise<ItemSlipData> {
  return withTenant(tenantId, async (tx) => {
    const component = await requireOwnedComponent(tx, tenantId, orderItemComponentId);

    const orderItem = await tx.query.orderItems.findFirst({ where: eq(orderItems.id, component.orderItemId) });
    if (!orderItem) throw new HttpError(404, "COMPONENT_NOT_FOUND", `Order item component ${orderItemComponentId} not found`);

    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderItem.orderId) });
    if (!order) throw new HttpError(404, "COMPONENT_NOT_FOUND", `Order item component ${orderItemComponentId} not found`);

    const [customer, product, superProduct] = await Promise.all([
      tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) }),
      tx.query.products.findFirst({ where: eq(products.id, component.productId) }),
      tx.query.superProducts.findFirst({ where: eq(superProducts.id, orderItem.superProductId) }),
    ]);
    if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", `Customer ${order.customerId} not found`);
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", `Product ${component.productId} not found`);
    if (!superProduct) throw new HttpError(404, "PRODUCT_NOT_FOUND", `Super product ${orderItem.superProductId} not found`);

    const orderItemRows = await tx.query.orderItems.findMany({
      where: eq(orderItems.orderId, order.id),
      orderBy: (oi, { asc }) => asc(oi.sequence),
    });
    const orderItemIds = orderItemRows.map((oi) => oi.id);
    const sameProductComponents = orderItemIds.length
      ? await tx.query.orderItemComponents.findMany({
          where: and(inArray(orderItemComponents.orderItemId, orderItemIds), eq(orderItemComponents.productId, component.productId)),
        })
      : [];
    const orderItemSequenceById = new Map(orderItemRows.map((oi) => [oi.id, oi.sequence]));
    sameProductComponents.sort((a, b) => {
      const sequenceDiff = (orderItemSequenceById.get(a.orderItemId) ?? 0) - (orderItemSequenceById.get(b.orderItemId) ?? 0);
      if (sequenceDiff !== 0) return sequenceDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const itemNumber = sameProductComponents.findIndex((c) => c.id === component.id) + 1;
    const itemQuantity = sameProductComponents.length;

    return {
      orderNumber: order.orderNumber,
      customerName: customerFullName(customer),
      itemText: `${itemNumber} / ${itemQuantity} ${titleCase(superProduct.name)}`,
      orderId: order.id,
    };
  });
}

/** Generates (not persisted, same reasoning as `jobSlipPdf.service.ts`) the printable per-item shipping slip. Returns the PDF URL and the resolved order id, so the caller can flip the order's status afterward without a second lookup. */
export async function generateItemSlipPdf(tenantId: string, orderItemComponentId: string): Promise<{ url: string; orderId: string }> {
  const { orderNumber, customerName, itemText, orderId } = await resolveItemSlipData(tenantId, orderItemComponentId);

  const qrDataUrl = await QRCode.toDataURL(orderNumber, { errorCorrectionLevel: "H", width: 150, margin: 1 });
  const html = buildItemSlipHtml(orderNumber, customerName, itemText, qrDataUrl);
  const buffer = await renderHtmlToPdfBuffer(html, {
    width: `${SLIP_WIDTH_MM}mm`,
    height: `${SLIP_HEIGHT_MM}mm`,
    landscape: false,
    displayHeaderFooter: false,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
  });
  const { url } = await storageBackend.upload(buffer, "application/pdf", "shipping-slips");
  return { url, orderId };
}
