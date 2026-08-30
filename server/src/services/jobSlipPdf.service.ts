import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { withTenant } from "../db/withTenant";
import { tenants, tailors, extraPayments } from "../db/schema/index";
import type { manufacturingSteps } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOwnedJob } from "./extra-payments.service";
import { buildJobDisplayEntries, enrichExtraPaymentsWithCategory } from "./payroll.service";
import { storageBackend, resolveServerImageUrl } from "./storage.service";
import { escapeHtml, renderHtmlToPdfBuffer, titleCase } from "./pdfRenderer";

/**
 * Per-job receipt/slip PDF — legacy `ManageJobs.jsx`'s "Print" action
 * (`handleGeneratePDF` → `utils/pdfGenerator.js#generateJobPDF`, *not* that
 * same file's dead, never-called `exportPDF`), reachable from the payroll
 * settlement screen's unpaid-jobs table — i.e. printable before the job is
 * ever settled, same as legacy. A small 80mm receipt-printer page (not A4),
 * with a QR code encoding the job's own id (legacy encoded `job._id`
 * identically) and the same "COPY" watermark legacy always rendered from
 * this exact call site (`printType: 'copy'` — there is no "first print"
 * concept anywhere in this rewrite's job-assignment flow either, so every
 * print here is equally a copy).
 *
 * Total genuinely includes everything — process cost, styling, and every
 * approved-and-unpaid extra payment — unlike legacy's dead `exportPDF`
 * (which itemized extras but never actually added them to its own
 * displayed total, a real bug); `generateJobPDF` got this right, and this
 * follows that, not the buggy sibling.
 *
 * Page size is deliberately hardcoded to match legacy's own
 * `new jsPDF({ unit: 'mm', format: [80, 290] })` exactly, not an
 * approximation — this prints on a physical slip printer loaded with fixed
 * 80×290mm stock, so the generated PDF's page dimensions have to be exactly
 * that or the printer mis-scales/crops it.
 */

const SLIP_WIDTH_MM = 80;
const SLIP_PAGE_HEIGHT_MM = 290;

const SLIP_STYLES = `
  body { font-family: Helvetica, Arial, sans-serif; color: #000; margin: 0; font-size: 12px; }
  .center { text-align: center; }
  .logo { height: 24px; }
  .qr { width: 60px; height: 60px; display: block; margin: 6px auto; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { text-align: left; padding: 2px 0; font-size: 12px; }
  th:last-child, td:last-child { text-align: right; }
  .total-row td { font-weight: bold; font-size: 14px; padding-top: 6px; }
  .watermark {
    position: fixed;
    top: 90mm;
    left: 0;
    width: 100%;
    text-align: center;
    font-size: 60px;
    font-weight: bold;
    color: rgba(150, 150, 150, 0.4);
    transform: rotate(-45deg);
  }
`;

function buildJobSlipHtml(
  tenant: typeof tenants.$inferSelect,
  tailor: typeof tailors.$inferSelect,
  entry: Awaited<ReturnType<typeof buildJobDisplayEntries>>[number],
  extraPayments: Awaited<ReturnType<typeof enrichExtraPaymentsWithCategory>>,
  qrDataUrl: string
): string {
  const stylingPrice = Number(entry.job.stylingPrice);
  const total = Number(entry.job.cost) + stylingPrice + extraPayments.reduce((sum, ep) => sum + Number(ep.cost), 0);

  const extraRows = extraPayments
    .map(
      (ep) => `
    <tr><td>${escapeHtml(titleCase(ep.category?.name ?? "Extra"))}</td><td>${Number(ep.cost).toFixed(2)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${SLIP_STYLES}</style>
  </head>
  <body>
    <div class="watermark">COPY</div>
    <div class="center">
      ${tenant.logo ? `<img class="logo" src="${escapeHtml(resolveServerImageUrl(tenant.logo))}" alt="${escapeHtml(tenant.name)}" />` : `<strong>${escapeHtml(tenant.name)}</strong>`}
      <img class="qr" src="${qrDataUrl}" alt="QR" />
    </div>
    <div>Name: ${escapeHtml(tailor.name)}</div>
    <div>Date: ${entry.job.createdAt.toLocaleDateString()}</div>
    <div>Order No.: ${escapeHtml(entry.order?.orderNumber ?? "—")}</div>
    <table>
      <tr><th>Category</th><th>Price</th></tr>
      <tr><td>${escapeHtml(titleCase(entry.process?.name ?? "—"))}</td><td>${Number(entry.job.cost).toFixed(2)}</td></tr>
      ${extraRows ? `<tr><th>Extra Category</th><th>Price</th></tr>${extraRows}` : ""}
      ${stylingPrice > 0 ? `<tr><th>Stylings</th><th>Price</th></tr><tr><td>Styling</td><td>${stylingPrice.toFixed(2)}</td></tr>` : ""}
      <tr class="total-row"><td>Total:</td><td>${total.toFixed(2)}</td></tr>
    </table>
  </body>
</html>`;
}

/** Generates (not persisted, same reasoning as `settlementPdf.service.ts`) the printable per-job slip and returns its uploaded URL. */
export async function generateJobSlipPdf(tenantId: string, jobId: string): Promise<string> {
  const { tenant, tailor, entry, extraPayments: enrichedExtraPayments } = await withTenant(tenantId, async (tx) => {
    const tenantRow = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenantRow) throw new HttpError(404, "TENANT_NOT_FOUND", `Tenant ${tenantId} not found`);

    const { job, step } = await requireOwnedJob(tx, tenantId, jobId);
    const tailorRow = await tx.query.tailors.findFirst({ where: eq(tailors.id, job.tailorId) });
    if (!tailorRow) throw new HttpError(404, "TAILOR_NOT_FOUND", `Tailor ${job.tailorId} not found`);

    const stepById = new Map([[step.id, step]]) as Map<string, typeof manufacturingSteps.$inferSelect>;
    const [entryRow] = await buildJobDisplayEntries(tx, [job], stepById);
    if (!entryRow) throw new HttpError(500, "INTERNAL_ERROR", "Failed to build job display entry");

    const approvedExtraPayments = await tx.query.extraPayments.findMany({
      where: and(eq(extraPayments.jobId, jobId), eq(extraPayments.approved, true), eq(extraPayments.paid, false)),
    });
    const enriched = await enrichExtraPaymentsWithCategory(tx, approvedExtraPayments);

    return { tenant: tenantRow, tailor: tailorRow, entry: entryRow, extraPayments: enriched };
  });

  const qrDataUrl = await QRCode.toDataURL(jobId, { margin: 1, width: 150 });
  const html = buildJobSlipHtml(tenant, tailor, entry, enrichedExtraPayments, qrDataUrl);
  const buffer = await renderHtmlToPdfBuffer(html, {
    width: `${SLIP_WIDTH_MM}mm`,
    height: `${SLIP_PAGE_HEIGHT_MM}mm`,
    landscape: false,
    displayHeaderFooter: false,
    margin: { top: "3mm", bottom: "3mm", left: "3mm", right: "3mm" },
  });
  const { url } = await storageBackend.upload(buffer, "application/pdf", "job-slips");
  return url;
}
