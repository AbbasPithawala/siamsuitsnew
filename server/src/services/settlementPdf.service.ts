import { eq } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import { tenants } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireTailor } from "./manufacturing-helpers";
import { getSettlement } from "./payroll.service";
import { storageBackend, resolveServerImageUrl } from "./storage.service";
import { escapeHtml, renderHtmlToPdfBuffer } from "./pdfRenderer";
import { PDF_FONT_FACE_CSS } from "./pdfFonts";

/**
 * Server-rendered payment-settlement slip — legacy `WorkPaymentHistory.jsx`'s `exportPDF`
 * (client-side `jsPDF` + `renderToString`, generated fresh on every view, never persisted).
 * Follows `invoicePdf.service.ts`'s shape instead: Puppeteer HTML→PDF, uploaded and handed
 * back as a URL the client opens directly — not persisted on `payment_settlements` itself
 * (unlike `order_invoices.pdf_path`/`retailer_invoices.pdf_path`) since there's no "Resend"
 * concern here, just a view/print action; regenerating on every request keeps this additive
 * rather than requiring a migration for a column nothing else reads.
 *
 * Reuses `getSettlement` (its own `withTenant` transaction, already complete by the time this
 * runs) rather than duplicating its job/extra-payment enrichment — see that function's own
 * doc comment for what it returns.
 */

const SETTLEMENT_PDF_STYLES = `
  ${PDF_FONT_FACE_CSS}
  body { font-family: 'Montserrat', 'Noto Sans Thai', sans-serif; color: #333; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  .header-table { margin-bottom: 8px; }
  td, th { padding: 6px 8px; font-size: 12px; }
  th { background: #26377D; color: #fff; text-align: left; font-size: 11px; }
  .amount-col { text-align: right; }
  .section-title td { font-weight: bold; background: #f4f4f4; border-bottom: 1px solid #ddd; }
  .total-row td { font-weight: bold; background: #d3d3d3; }
`;

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

function footerHtml(tenant: typeof tenants.$inferSelect): string {
  const text = tenant.invoiceFooterText || "Thank You For Shopping With Us";
  return `<div style="text-align:center; padding:10px;"><strong style="color:#26377D; font-size:13px;">${escapeHtml(text)}</strong></div>`;
}

type SettlementDetail = Awaited<ReturnType<typeof getSettlement>>;

function itemLabel(entry: SettlementDetail["jobs"][number]): string {
  const productName = entry.product?.name ?? "Item";
  const slot = entry.component?.slotLabel;
  return slot && slot !== productName ? `${productName} (${slot})` : productName;
}

function buildSettlementHtml(tenant: typeof tenants.$inferSelect, tailor: { name: string }, detail: SettlementDetail): string {
  const jobRows = detail.jobs
    .map(
      (entry) => `
    <tr>
      <td>${escapeHtml(entry.order?.orderNumber ?? "—")}</td>
      <td style="text-transform:capitalize;">${escapeHtml(itemLabel(entry))}</td>
      <td style="text-transform:capitalize;">${escapeHtml(entry.process?.name ?? "—")}</td>
      <td class="amount-col">${(Number(entry.job.cost) + Number(entry.job.stylingPrice)).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const jobEntryByJobId = new Map(detail.jobs.map((entry) => [entry.job.id, entry]));
  const extraPaymentRows = detail.extraPayments
    .map((extraPayment) => {
      const jobEntry = jobEntryByJobId.get(extraPayment.jobId);
      return `
    <tr>
      <td>${escapeHtml(jobEntry?.order?.orderNumber ?? "—")}</td>
      <td style="text-transform:capitalize;" colspan="2">${escapeHtml(extraPayment.category?.name ?? "Extra payment")}</td>
      <td class="amount-col">${Number(extraPayment.cost).toFixed(2)}</td>
    </tr>`;
    })
    .join("");

  const metaRows = `
      <tr>
        <td style="padding:8px;"><strong style="color:#26377D;">Worker: ${escapeHtml(tailor.name)}</strong></td>
        <td style="padding:8px; text-align:right;"><strong style="color:#26377D;">Settlement Date: ${detail.settlement.createdAt.toLocaleDateString()}</strong></td>
      </tr>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${SETTLEMENT_PDF_STYLES}</style>
  </head>
  <body>
    ${headerSectionHtml(tenant, metaRows)}
    <table>
      <tr><th>Order No</th><th>Item</th><th>Process</th><th class="amount-col">Amount</th></tr>
      ${jobRows}
      ${
        detail.extraPayments.length > 0
          ? `<tr class="section-title"><td colspan="4">Extra Payments</td></tr>${extraPaymentRows}`
          : ""
      }
      <tr><td colspan="3" style="text-align:right;">รวม (Subtotal)</td><td class="amount-col">${Number(detail.settlement.subTotal).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="text-align:right;">หักคราวนี้ (Deducted Advance)</td><td class="amount-col">${Number(detail.settlement.deductedAdvance).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="text-align:right;">ค่าห้อง (Rent)</td><td class="amount-col">${Number(detail.settlement.rent).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="text-align:right;">บิลอื่น (Manual Bill)</td><td class="amount-col">${Number(detail.settlement.manualBill).toFixed(2)}</td></tr>
      <tr class="total-row"><td colspan="3" style="text-align:right;">ยอดจ่าย (Total Pay)</td><td class="amount-col">${Number(detail.settlement.totalPay).toFixed(2)}</td></tr>
    </table>
    ${footerHtml(tenant)}
  </body>
</html>`;
}

/** Generates (not persisted — see this file's doc comment) the printable settlement slip and returns its uploaded URL. */
export async function generateSettlementPdf(tenantId: string, tailorId: string, settlementId: string): Promise<string> {
  const { tenant, tailor } = await withTenant(tenantId, async (tx) => {
    const tenantRow = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenantRow) throw new HttpError(404, "TENANT_NOT_FOUND", `Tenant ${tenantId} not found`);
    const tailorRow = await requireTailor(tx, tailorId);
    return { tenant: tenantRow, tailor: tailorRow };
  });

  const detail = await getSettlement(tenantId, tailorId, settlementId);

  const html = buildSettlementHtml(tenant, tailor, detail);
  const buffer = await renderHtmlToPdfBuffer(html, { landscape: false });
  const { url } = await storageBackend.upload(buffer, "application/pdf", "settlements");
  return url;
}
