import { eq } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { tenants, customers, orderInvoices, retailerInvoices, superProducts } from "../db/schema/index";
import type { orderInvoiceLines } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOrder } from "./orders.service";
import { requireRetailer } from "./customers.service";
import { requireInvoice, fetchInvoiceOrders } from "./invoices.service";
import { findSavedOrderInvoice } from "./orderInvoices.service";
import { storageBackend, resolveServerImageUrl } from "./storage.service";
import { escapeHtml, renderHtmlToPdfBuffer, titleCase } from "./pdfRenderer";
import { sendPdfEmail } from "./email.service";
import { PDF_FONT_FACE_CSS } from "./pdfFonts";

/**
 * Server-side, Puppeteer-rendered, persisted PDFs (PHASE_10_TASKS.md invoicing follow-up) —
 * legacy generated both the single-order and grouped-retailer-invoice PDFs entirely
 * client-side (`jsPDF` + `renderToString`, hand-written JSX templates duplicated across
 * `CreateInvoice.jsx`/`InvoiceHistory.jsx` ×2 files), never persisted anywhere. This follows
 * `orderPdf.service.ts`'s established shape instead: one shared Chromium instance
 * (`pdfRenderer.ts`), a real stored file (so "View" and "Resend" don't have to re-render in
 * the requester's own browser), portrait A4 (legacy's own `jsPDF('p', ...)` orientation,
 * unlike the order PDF's deliberate landscape).
 *
 * Letterhead (logo/address/footer) is read from `tenants` (this rewrite is multi-tenant;
 * legacy's identical hardcoded company block only ever worked because legacy served exactly
 * one company) — all three fields are nullable and simply omitted from the rendered document
 * when a tenant hasn't set them, rather than shipping a placeholder/dummy value.
 */

const DEFAULT_FOOTER_TEXT = "Thank You For Shopping With Us";

/**
 * A real reported bug: this document's letterhead/meta rows (2 columns — logo+address,
 * label+value pairs) and its actual line-items table (4 columns) used to share one single
 * `<table>`. A `<table>`'s auto column-width algorithm is computed once, across every row it
 * contains — mixing rows with genuinely different real column counts (2 here vs. 4 there)
 * confused that algorithm into misaligning the line-items header against its own data rows,
 * even though each *individual* row's cells/colspans were internally consistent. Splitting
 * the header into its own separate, always-exactly-2-column `<table>` (this function) fixes
 * it structurally: two unrelated tables never share a column-width computation, so nothing
 * upstream can bleed into the line-items table's own layout.
 */
function headerSectionHtml(tenant: typeof tenants.$inferSelect, metaRows: string): string {
  const logo = tenant.logo
    ? `<img src="${escapeHtml(resolveServerImageUrl(tenant.logo))}" alt="${escapeHtml(tenant.name)}" style="height:60px;" />`
    : `<strong style="font-size:16px;">${escapeHtml(tenant.name)}</strong>`;
  const address = tenant.address
    ? `<p style="font-size:11px; color:#666; text-align:right; line-height:15px; margin:0;">${escapeHtml(tenant.address).replace(/\n/g, "<br />")}</p>`
    : "";
  return `
    <table class="header-table">
      <tr>
        <td style="border-bottom:1px solid #ccc; padding:8px;" valign="middle">${logo}</td>
        <td style="border-bottom:1px solid #ccc; padding:8px; text-align:right;">${address}</td>
      </tr>
      ${metaRows}
    </table>`;
}

/** Its own plain, centered block — not a table row — so it never needs a colspan matched to whichever table's column count happens to be current. */
function footerHtml(tenant: typeof tenants.$inferSelect): string {
  const text = tenant.invoiceFooterText || DEFAULT_FOOTER_TEXT;
  return `<div style="text-align:center; padding:10px;"><strong style="color:#26377D; font-size:13px;">${escapeHtml(text)}</strong></div>`;
}

/**
 * Self-hosted `@font-face` embedding (`pdfFonts.ts`, base64 data URIs — no network dependency
 * during PDF generation, same reasoning as `orderPdf.service.ts`'s identical setup), not a
 * generic `Arial, Helvetica` stack — a real reported bug: the headless Chromium environment
 * this renders in has no font with a glyph for the em dash (U+2014) this template's own
 * `groupLabel`s use ("Jacket #1 — Jacket"), so it silently fell back to a replacement-
 * character box (` + "`�`" + `) instead of throwing or substituting a visually-similar glyph.
 */
const INVOICE_PDF_STYLES = `
  ${PDF_FONT_FACE_CSS}
  body { font-family: 'Montserrat', 'Noto Sans Thai', sans-serif; color: #333; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  .header-table { margin-bottom: 8px; }
  td, th { padding: 6px 8px; font-size: 12px; }
  th { background: #26377D; color: #fff; text-align: left; font-size: 11px; }
  .amount-col { text-align: right; }
  .group-row td { font-weight: bold; background: #f4f4f4; border-bottom: 1px solid #ddd; }
  .sub-row td { padding-left: 20px; font-size: 11px; color: #444; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; background: #d3d3d3; }
`;

async function requireTenant(tx: Transaction, tenantId: string) {
  const tenant = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
  if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND", `Tenant ${tenantId} not found`);
  return tenant;
}

function customerName(customer: { firstName: string; lastName: string | null }): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

type OrderInvoiceLineRow = typeof orderInvoiceLines.$inferSelect;

/** Groups a saved order invoice's flat `orderInvoiceLines` back into per-component sections for rendering — the inverse of how `orderInvoices.service.ts#buildDraftLines` flattened them. */
function groupOrderInvoiceLines(lines: OrderInvoiceLineRow[]): [string, OrderInvoiceLineRow[]][] {
  const byGroup = new Map<string, OrderInvoiceLineRow[]>();
  for (const line of lines) {
    const group = byGroup.get(line.groupLabel) ?? [];
    group.push(line);
    byGroup.set(line.groupLabel, group);
  }
  return [...byGroup.entries()];
}

function buildOrderInvoiceHtml(
  tenant: typeof tenants.$inferSelect,
  retailer: { name: string },
  order: { orderNumber: string; orderDate: Date },
  customer: { firstName: string; lastName: string | null },
  invoice: NonNullable<Awaited<ReturnType<typeof findSavedOrderInvoice>>>
): string {
  const groups = groupOrderInvoiceLines(invoice.lines);
  const rows = groups
    .map(([groupLabel, groupLines]) => {
      const unitLine = groupLines.find((l) => l.kind === "unit");
      const otherLines = groupLines.filter((l) => l.kind !== "unit");
      const headerRow = `
        <tr class="group-row">
          <td colspan="3">${escapeHtml(titleCase(groupLabel))}</td>
          <td class="amount-col">${Number(unitLine?.price ?? 0).toFixed(2)}</td>
        </tr>`;
      const subRows = otherLines
        .map(
          (line) => `
        <tr class="sub-row">
          <td colspan="3">${escapeHtml(line.label)}</td>
          <td class="amount-col">${Number(line.price).toFixed(2)}</td>
        </tr>`
        )
        .join("");
      return headerRow + subRows;
    })
    .join("");

  const metaRows = `
      <tr>
        <td style="padding:8px;"><strong style="color:#26377D;">Retailer: ${escapeHtml(retailer.name)}</strong></td>
        <td style="padding:8px; text-align:right;"><strong style="color:#26377D;">Order #${escapeHtml(order.orderNumber)}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px;">Customer: ${escapeHtml(customerName(customer))}</td>
        <td style="padding:8px; text-align:right;">Date: ${order.orderDate.toLocaleDateString()}</td>
      </tr>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${INVOICE_PDF_STYLES}</style>
  </head>
  <body>
    ${headerSectionHtml(tenant, metaRows)}
    <table>
      <tr><th colspan="3">Product Description</th><th class="amount-col">Price</th></tr>
      ${rows}
      <tr class="total-row"><td colspan="3">Total</td><td class="amount-col">${Number(invoice.total).toFixed(2)}</td></tr>
      ${invoice.note ? `<tr><td colspan="4" style="padding:8px;">Note: ${escapeHtml(invoice.note)}</td></tr>` : ""}
    </table>
    ${footerHtml(tenant)}
  </body>
</html>`;
}

/** Generates (and persists, via `order_invoices.pdf_path`) the single-order invoice PDF — legacy `CreateInvoice.jsx`'s `exportPDF`/`InvoiceHistory.jsx`'s `exportSingleInvoicePDF`, both the same template. Requires a saved order invoice (a draft with unsaved prices has nothing meaningful to print). */
export async function generateOrderInvoicePdf(tenantId: string, orderId: string, actorRetailerId?: string | null): Promise<string> {
  return withTenant(tenantId, async (tx) => {
    const order = await requireOrder(tx, orderId, actorRetailerId);
    const invoice = await findSavedOrderInvoice(tx, orderId);
    if (!invoice) throw new HttpError(422, "ORDER_INVOICE_MISSING", `Order ${order.orderNumber} has no saved invoice yet`);

    const [tenant, retailer, customer] = await Promise.all([
      requireTenant(tx, tenantId),
      requireRetailer(tx, order.retailerId),
      tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) }),
    ]);
    if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", `Customer ${order.customerId} not found`);

    const html = buildOrderInvoiceHtml(tenant, retailer, order, customer, invoice);
    const buffer = await renderHtmlToPdfBuffer(html, { landscape: false });
    const { url } = await storageBackend.upload(buffer, "application/pdf", "invoices");

    await tx.update(orderInvoices).set({ pdfPath: url, updatedAt: new Date() }).where(eq(orderInvoices.id, invoice.id));
    return url;
  });
}

function buildRetailerInvoiceHtml(
  tenant: typeof tenants.$inferSelect,
  retailer: { name: string },
  invoice: typeof retailerInvoices.$inferSelect,
  orderRows: { orderNumber: string; customerName: string; products: string; amount: string }[]
): string {
  const subtotal = Number(invoice.total) + Number(invoice.discount) - Number(invoice.shippingCharge);
  const rows = orderRows
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(row.orderNumber)}</td>
      <td style="text-transform:capitalize;">${escapeHtml(row.customerName)}</td>
      <td>${escapeHtml(row.products)}</td>
      <td class="amount-col">${Number(row.amount).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const metaRows = `
      <tr><td colspan="2" style="text-align:center; padding:10px;"><strong style="color:#26377D; font-size:15px;">Invoice: ${escapeHtml(invoice.invoiceNumber)}</strong></td></tr>
      <tr>
        <td style="padding:8px;">Sold To: ${escapeHtml(retailer.name)}</td>
        <td style="padding:8px; text-align:right;">Due Date: ${escapeHtml(invoice.dueDate ?? "—")}</td>
      </tr>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${INVOICE_PDF_STYLES}</style>
  </head>
  <body>
    ${headerSectionHtml(tenant, metaRows)}
    <table>
      <tr><th>Order No</th><th>Customer</th><th>Products</th><th class="amount-col">Amount</th></tr>
      ${rows}
      <tr><td colspan="3" style="text-align:right;">Subtotal</td><td class="amount-col">${subtotal.toFixed(2)}</td></tr>
      <tr><td colspan="3" style="text-align:right;">Shipping Cost</td><td class="amount-col">${Number(invoice.shippingCharge).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="text-align:right;">Discount</td><td class="amount-col">${Number(invoice.discount).toFixed(2)}</td></tr>
      <tr class="total-row"><td colspan="3" style="text-align:right;">Total Amount</td><td class="amount-col">${Number(invoice.total).toFixed(2)}</td></tr>
    </table>
    ${footerHtml(tenant)}
  </body>
</html>`;
}

/**
 * One row per order in the invoice — `products` mirrors legacy's own `order.order_items.map(...)`
 * summary ("2 Suit + 1 Jacket"), grouped here by `superProductId` (count of physical units of
 * that super product on this order) since our schema has one `order_items` row per physical
 * unit rather than legacy's per-line-item `quantity` field.
 */
async function buildOrderSummaryRows(tx: Transaction, orderIds: string[]) {
  const rows: { orderNumber: string; customerName: string; products: string; amount: string }[] = [];
  for (const orderId of orderIds) {
    const order = await requireOrder(tx, orderId);
    const [customer, items, invoice] = await Promise.all([
      tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) }),
      tx.query.orderItems.findMany({ where: (i, { eq: eqOp }) => eqOp(i.orderId, orderId) }),
      findSavedOrderInvoice(tx, orderId),
    ]);

    const countBySuperProductId = new Map<string, number>();
    for (const item of items) {
      countBySuperProductId.set(item.superProductId, (countBySuperProductId.get(item.superProductId) ?? 0) + 1);
    }
    const superProductRows = await Promise.all(
      [...countBySuperProductId.keys()].map((id) => tx.query.superProducts.findFirst({ where: eq(superProducts.id, id) }))
    );
    const superProductNameById = new Map(superProductRows.filter((sp): sp is NonNullable<typeof sp> => Boolean(sp)).map((sp) => [sp.id, sp.name]));
    const products = [...countBySuperProductId.entries()]
      .map(([id, count]) => `${count} ${titleCase(superProductNameById.get(id) ?? "Item")}`)
      .join(" + ");

    rows.push({
      orderNumber: order.orderNumber,
      customerName: customer ? customerName(customer) : "",
      products,
      amount: invoice?.total ?? "0.00",
    });
  }
  return rows;
}

/**
 * The actual render, shared by `generateRetailerInvoicePdf` (upload + persist, return the
 * URL) and `sendRetailerInvoiceEmail` (needs the raw bytes to attach — round-tripping back
 * out to the storage backend just to re-download what was rendered a moment ago would be
 * pure waste). `tx`-scoped so both callers can run it inside their own single transaction.
 */
async function renderRetailerInvoicePdf(tx: Transaction, tenantId: string, invoiceId: string, actorRetailerId?: string | null) {
  const invoice = await requireInvoice(tx, invoiceId, actorRetailerId);
  const [tenant, retailer] = await Promise.all([requireTenant(tx, tenantId), requireRetailer(tx, invoice.retailerId)]);

  const orderSummaries = await fetchInvoiceOrders(tx, invoice.id);
  const orderRows = await buildOrderSummaryRows(tx, orderSummaries.map((o) => o.id));

  const html = buildRetailerInvoiceHtml(tenant, retailer, invoice, orderRows);
  const buffer = await renderHtmlToPdfBuffer(html, { landscape: false });
  return { buffer, invoice, retailer };
}

/** Generates (and persists, via `retailer_invoices.pdf_path`) the grouped-invoice summary PDF — legacy `InvoiceHistory.jsx`'s "View Invoice Summary"/"Resend" template. */
export async function generateRetailerInvoicePdf(tenantId: string, invoiceId: string, actorRetailerId?: string | null): Promise<string> {
  return withTenant(tenantId, async (tx) => {
    const { buffer, invoice } = await renderRetailerInvoicePdf(tx, tenantId, invoiceId, actorRetailerId);
    const { url } = await storageBackend.upload(buffer, "application/pdf", "invoices");
    await tx.update(retailerInvoices).set({ pdfPath: url, updatedAt: new Date() }).where(eq(retailerInvoices.id, invoice.id));
    return url;
  });
}

/**
 * Legacy `InvoiceHistory.jsx`'s "Resend" (admin-only) — regenerates the grouped-invoice PDF
 * fresh (matching legacy's own behavior: it always re-renders rather than reusing a
 * previously-emailed copy) and emails it to the retailer's configured `emailRecipients`
 * (`retailers.email_recipients` — the same field legacy resolved as a single `Retailer.email`,
 * generalized to the real array column this rewrite's `retailers` table already has).
 */
export async function sendRetailerInvoiceEmail(tenantId: string, invoiceId: string, actorRetailerId?: string | null): Promise<void> {
  const { buffer, invoice, retailer } = await withTenant(tenantId, (tx) => renderRetailerInvoicePdf(tx, tenantId, invoiceId, actorRetailerId));
  await withTenant(tenantId, async (tx) => {
    const { url } = await storageBackend.upload(buffer, "application/pdf", "invoices");
    await tx.update(retailerInvoices).set({ pdfPath: url, updatedAt: new Date() }).where(eq(retailerInvoices.id, invoice.id));
  });
  await sendPdfEmail({
    to: retailer.emailRecipients ?? [],
    subject: `Invoice ${invoice.invoiceNumber}`,
    text: "Please find your invoice attached.",
    attachmentFilename: `${invoice.invoiceNumber}.pdf`,
    attachment: buffer,
  });
}
