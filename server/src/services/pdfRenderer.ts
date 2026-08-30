import puppeteer, { type Browser, type PDFOptions } from "puppeteer";

/**
 * Extracted from `orderPdf.service.ts` (which owned Puppeteer lifecycle management
 * exclusively until `invoicePdf.service.ts` needed the exact same thing) so both PDF
 * producers share one lazily-launched Chromium instance rather than each keeping its own
 * `browserPromise`/child process — two live headless Chromium instances per server process
 * would be pure waste for what's still one shared resource. No behavior change from the
 * original: same lazy-launch-on-first-use, same explicit `closePdfBrowser` for tests/
 * graceful shutdown, same orphaned-child-process cleanup on `exit`.
 */
let browserPromise: Promise<Browser> | null = null;

// Puppeteer's own child-process cleanup only fires on a graceful Node exit; a Vitest
// worker or dev-server restart that gets torn down without one leaves the spawned
// chrome.exe orphaned (confirmed repeatedly this project — see PHASE_6_TASKS.md Group 6/7
// notes). Killing the tracked pid directly on `exit` catches those cases too.
function registerExitCleanup(browser: Browser): void {
  const pid = browser.process()?.pid;
  if (!pid) return;
  process.once("exit", () => {
    try {
      process.kill(pid);
    } catch {
      // already exited
    }
  });
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const existing = await browserPromise;
    if (existing.connected) return existing;
    browserPromise = null;
  }
  browserPromise = puppeteer
    .launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] })
    .then((browser) => {
      registerExitCleanup(browser);
      return browser;
    });
  return browserPromise;
}

export async function closePdfBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

/**
 * `pdfOptions` defaults match `orderPdf.service.ts`'s original landscape-A4 shape;
 * `invoicePdf.service.ts` overrides to portrait (matching legacy's own portrait invoice
 * template) via this same param rather than a second copy of this function. `jobSlipPdf.
 * service.ts` overrides further still, to a narrow receipt-printer page via `width`/`height`
 * — Puppeteer only honors those when `format` is unset, so the default below backs off
 * `format: "A4"` whenever a caller supplies its own `width`/`height` instead.
 */
export async function renderHtmlToPdfBuffer(html: string, pdfOptions: Partial<PDFOptions> = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // `domcontentloaded`, not `networkidle0`: the page has no external resources (QR
    // codes are inline data URIs) other than possible retailer-logo/reference-image/
    // customer-image/tenant-logo URLs, and we don't want PDF generation to hang or fail on
    // a slow/unreachable image host.
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    const buffer = await page.pdf({
      // Conditionally spread rather than `format: ... ? "A4" : undefined` — under
      // `exactOptionalPropertyTypes`, explicitly assigning `undefined` to `format` doesn't
      // typecheck, but omitting the key entirely (what this does when width/height are set) does.
      ...(pdfOptions.width || pdfOptions.height ? {} : { format: "A4" as const }),
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "16mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      // Puppeteer's own page-number interpolation convention: these two class names,
      // not literal "X"/"Y" text — populated by Chromium itself at render time.
      footerTemplate:
        '<div style="width:100%; font-size:9px; text-align:center; color:#666;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      ...pdfOptions,
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/**
 * Catalog names (products, super products, measurement definitions, free-text feature
 * values) are stored as casual freeform text — often lowercase ("jacket", "fabric 1") —
 * capitalized here for display only, per explicit feedback that generated documents should
 * read like real production paperwork, not a raw DB dump. Capitalizes the first letter of
 * every word, leaves the rest of each word untouched (never force-lowercases the remainder,
 * in case a name is already deliberately mixed-case, e.g. an acronym like "FAB-100").
 */
export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
