import { promises as fs } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import puppeteer, { type Browser } from "puppeteer";
import QRCode from "qrcode";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { orders, orderGroups, customers, products, superProducts, measurementDefinitions, features, styles, styleOptions, processes } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOrder, assembleOrderDetail } from "./orders.service";
import { requireRetailer } from "./customers.service";

const PDF_DIR = path.join(process.cwd(), "pdf");

type OrderDetail = Awaited<ReturnType<typeof assembleOrderDetail>>;
type DetailItem = OrderDetail["items"][number];
type DetailComponent = DetailItem["components"][number];
type DetailFeature = DetailComponent["features"][number];
type FeatureRow = typeof features.$inferSelect;
type Retailer = Awaited<ReturnType<typeof requireRetailer>>;
type Customer = NonNullable<Awaited<ReturnType<Transaction["query"]["customers"]["findFirst"]>>>;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/**
 * Batches every catalog/process lookup this PDF needs into one round of `inArray`
 * queries — same technique `assembleOrderDetail` itself uses — so rendering an order with
 * any number of items/components stays a fixed number of queries, not one per row.
 */
async function loadDisplayData(tx: Transaction, detail: OrderDetail) {
  const productIds = unique(detail.items.flatMap((item) => item.components.map((c) => c.productId)));
  const superProductIds = unique(detail.items.map((item) => item.superProductId));
  const measurementDefinitionIds = unique(
    detail.items.flatMap((item) => item.components.flatMap((c) => c.measurements.map((m) => m.measurementDefinitionId)))
  );
  const featureIds = unique(detail.items.flatMap((item) => item.components.flatMap((c) => c.features.map((f) => f.featureId))));
  const styleIds = unique(
    detail.items.flatMap((item) =>
      item.components.flatMap((c) => c.features.map((f) => f.styleId).filter((id): id is string => id !== null))
    )
  );
  const styleOptionIds = unique(
    detail.items.flatMap((item) =>
      item.components.flatMap((c) => c.features.map((f) => f.styleOptionId).filter((id): id is string => id !== null))
    )
  );
  const processIds = unique(detail.items.flatMap((item) => item.components.flatMap((c) => c.manufacturingSteps.map((s) => s.processId))));

  const [productRows, superProductRows, measurementDefinitionRows, featureRows, styleRows, styleOptionRows, processRows] = await Promise.all([
    productIds.length ? tx.query.products.findMany({ where: inArray(products.id, productIds) }) : Promise.resolve([]),
    superProductIds.length ? tx.query.superProducts.findMany({ where: inArray(superProducts.id, superProductIds) }) : Promise.resolve([]),
    measurementDefinitionIds.length
      ? tx.query.measurementDefinitions.findMany({ where: inArray(measurementDefinitions.id, measurementDefinitionIds) })
      : Promise.resolve([]),
    featureIds.length ? tx.query.features.findMany({ where: inArray(features.id, featureIds) }) : Promise.resolve([]),
    styleIds.length ? tx.query.styles.findMany({ where: inArray(styles.id, styleIds) }) : Promise.resolve([]),
    styleOptionIds.length ? tx.query.styleOptions.findMany({ where: inArray(styleOptions.id, styleOptionIds) }) : Promise.resolve([]),
    processIds.length ? tx.query.processes.findMany({ where: inArray(processes.id, processIds) }) : Promise.resolve([]),
  ]);

  return {
    productById: new Map(productRows.map((p) => [p.id, p])),
    superProductById: new Map(superProductRows.map((sp) => [sp.id, sp])),
    measurementDefinitionById: new Map(measurementDefinitionRows.map((m) => [m.id, m])),
    featureById: new Map(featureRows.map((f) => [f.id, f])),
    styleById: new Map(styleRows.map((s) => [s.id, s])),
    styleOptionById: new Map(styleOptionRows.map((o) => [o.id, o])),
    processById: new Map(processRows.map((p) => [p.id, p])),
  };
}

type DisplayData = Awaited<ReturnType<typeof loadDisplayData>>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/**
 * Shared choice-feature resolution: a style/style-option pair (or just a style) resolves
 * to a display label and, where set, an image — the style option's image takes precedence
 * over the style's own (a selected sub-option is the more specific choice), same precedence
 * `FeatureSelector`'s own picker uses client-side.
 */
function describeChoiceSelection(link: DetailFeature, display: DisplayData): { label: string; image: string | null } {
  const style = link.styleId ? display.styleById.get(link.styleId) : undefined;
  const option = link.styleOptionId ? display.styleOptionById.get(link.styleOptionId) : undefined;
  const label = [style?.name, option?.name].filter((v): v is string => Boolean(v)).join(" / ") || "-";
  const image = option?.image ?? style?.image ?? null;
  return { label, image };
}

function findFeatureRows(
  component: DetailComponent,
  display: DisplayData,
  predicate: (feature: FeatureRow) => boolean
): { link: DetailFeature; feature: FeatureRow }[] {
  const entries: { link: DetailFeature; feature: FeatureRow }[] = [];
  for (const link of component.features) {
    const feature = display.featureById.get(link.featureId);
    if (feature && predicate(feature)) entries.push({ link, feature });
  }
  return entries;
}

/**
 * The generic replacement for legacy's hardcoded `fabric_code` — every `text`-type feature
 * actually linked to this component, sorted by name for a deterministic "first" (insertion
 * order of `order_item_component_features` rows isn't guaranteed without an explicit
 * `ORDER BY`, so this can't rely on array position).
 */
function findInlineTextFeatures(component: DetailComponent, display: DisplayData): { link: DetailFeature; feature: FeatureRow }[] {
  return findFeatureRows(component, display, (feature) => feature.type === "text").sort((a, b) => a.feature.name.localeCompare(b.feature.name));
}

/**
 * Partitions a component's features into the dedicated sections Group 2 renders
 * specifically (inline text/fabric-lining-piping cards, the structured Monogram feature,
 * any `render_slot`-tagged feature) versus everything left over, which still goes through
 * the generic choice-feature table exactly as before this pass.
 */
function partitionFeatures(component: DetailComponent, display: DisplayData) {
  const textEntries = findInlineTextFeatures(component, display);
  const structuredEntries = findFeatureRows(component, display, (feature) => feature.type === "structured");
  const structuredEntry = structuredEntries[0];
  const renderSlotEntries = findFeatureRows(component, display, (feature) => feature.renderSlot !== null);

  const excludedFeatureIds = new Set([
    ...textEntries.map((e) => e.link.featureId),
    ...(structuredEntry ? [structuredEntry.link.featureId] : []),
    ...renderSlotEntries.map((e) => e.link.featureId),
  ]);

  const remainingFeatures = component.features.filter((link) => !excludedFeatureIds.has(link.featureId));

  return { textEntries, structuredEntry, renderSlotEntries, remainingFeatures };
}

function renderMeasurements(component: DetailComponent, display: DisplayData): string {
  if (component.measurements.length === 0) return "<p class=\"empty\">No measurements recorded.</p>";
  const rows = component.measurements
    .map((m) => {
      const def = display.measurementDefinitionById.get(m.measurementDefinitionId);
      const changed = m.changedFromProfile === true ? '<span class="changed-check" title="Changed from customer profile">&#10003;</span>' : "";
      return `<tr><td>${escapeHtml(def?.name ?? m.measurementDefinitionId)}</td><td>${m.value ?? "-"}</td><td>${m.adjustmentValue ?? "-"}</td><td>${m.totalValue ?? "-"}</td><td class="changed-col">${changed}</td></tr>`;
    })
    .join("");
  return `<table class="measurements"><thead><tr><th>Measurement</th><th>Value</th><th>Adj.</th><th>Total</th><th>Changed</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** The generic choice-feature table — every feature left over once the dedicated fabric/lining/piping cards, the Monogram block, and any render-slot section have claimed theirs. */
function renderFeatureTable(featureLinks: DetailFeature[], display: DisplayData): string {
  if (featureLinks.length === 0) return "<p class=\"empty\">No additional styling selected.</p>";
  const rows = featureLinks
    .map((f) => {
      const feature = display.featureById.get(f.featureId);
      const label = feature?.name ?? f.featureId;
      const value = feature?.type === "choice" ? describeChoiceSelection(f, display).label : (f.textValue ?? "-");
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    })
    .join("");
  return `<table class="features"><thead><tr><th>Feature</th><th>Selection</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Fabric/Lining/Piping (audit item 4) — one bordered card per `text`-type feature actually linked to the component, labeled generically off the feature's own name, never a hardcoded field name. */
function renderTextFeatureCards(textEntries: { link: DetailFeature; feature: FeatureRow }[]): string {
  if (textEntries.length === 0) return "";
  const cards = textEntries
    .map(
      ({ link, feature }) => `
      <div class="detail-card">
        <h5>${escapeHtml(feature.name)}</h5>
        <p>${escapeHtml(link.textValue ?? "-")}</p>
      </div>`
    )
    .join("");
  return `<div class="detail-cards">${cards}</div>`;
}

/**
 * Shoulder Type / Pant Type (audit item 5) — any feature with a non-null `render_slot ===
 * 'shoulder_type'`, resolved generically: the enum has exactly one value for this concept
 * (`monogram_position` is handled separately, inside the Monogram block below), and the
 * feature's own catalog `name` (e.g. "Shoulder Type" on a jacket, a differently-named
 * feature on a pant product) supplies the legacy per-product "Shoulder Type"/"Pant Type"
 * label without this function ever branching on product identity.
 */
function renderRenderSlotSection(renderSlotEntries: { link: DetailFeature; feature: FeatureRow }[], display: DisplayData): string {
  const entries = renderSlotEntries.filter((e) => e.feature.renderSlot === "shoulder_type");
  if (entries.length === 0) return "";
  const blocks = entries
    .map(({ link, feature }) => {
      const { label, image } = describeChoiceSelection(link, display);
      return `
        <div class="render-slot-block">
          <h5>${escapeHtml(feature.name)}</h5>
          <p>${escapeHtml(label)}</p>
          ${image ? `<img class="render-slot-image" src="${escapeHtml(image)}" alt="${escapeHtml(feature.name)}" />` : ""}
        </div>`;
    })
    .join("");
  return `<div class="render-slot-section">${blocks}</div>`;
}

interface MonogramStructuredValueShape {
  text?: string;
  text2?: string;
  font?: string;
  color?: string;
}

/**
 * A real Monogram detail block (audit item 4's other half) — Position/Style/Color/Name/
 * Line 2, derived generically from the component's `structured`-type feature (its shape is
 * `MonogramFeatureField`'s `MonogramStructuredValue` — `client/src/features/featureSelector/
 * MonogramFeatureField.tsx`) plus its paired `render_slot='monogram_position'` feature,
 * never product/feature-name literals. Replaces the prior raw `JSON.stringify(...)` dump.
 */
function renderMonogramBlock(
  structuredEntry: { link: DetailFeature; feature: FeatureRow } | undefined,
  renderSlotEntries: { link: DetailFeature; feature: FeatureRow }[],
  display: DisplayData
): string {
  if (!structuredEntry) return "";
  const positionEntry = renderSlotEntries.find((e) => e.feature.renderSlot === "monogram_position");
  const position = positionEntry ? describeChoiceSelection(positionEntry.link, display).label : "-";
  const value = (structuredEntry.link.structuredValue ?? {}) as MonogramStructuredValueShape;

  return `
    <div class="monogram-block">
      <h4>${escapeHtml(structuredEntry.feature.name)}</h4>
      <table class="monogram-fields">
        <tbody>
          <tr><td>Position</td><td>${escapeHtml(position)}</td></tr>
          <tr><td>Style</td><td>${escapeHtml(value.font ?? "-")}</td></tr>
          <tr><td>Color</td><td>${escapeHtml(value.color ?? "-")}</td></tr>
          <tr><td>Name</td><td>${escapeHtml(value.text ?? "-")}</td></tr>
          <tr><td>Line 2</td><td>${escapeHtml(value.text2 ?? "-")}</td></tr>
        </tbody>
      </table>
    </div>`;
}

function renderManufacturingSteps(component: DetailComponent, display: DisplayData): string {
  if (component.manufacturingSteps.length === 0) return "";
  const items = component.manufacturingSteps
    .map((s) => `<span class="step step-${s.status}">${escapeHtml(display.processById.get(s.processId)?.name ?? s.processId)}: ${s.status}</span>`)
    .join(" &rarr; ");
  return `<p class="steps">${items}</p>`;
}

function renderCustomerName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter((v): v is string => Boolean(v)).join(" ");
}

/**
 * Old Order / Rush / Repeat / Modified banners (audit item 8), styled with legacy's
 * red/green color-coding *intent* rather than byte-identical markup. The "Modified"
 * banner reads `orders.last_modified_at`, stamped by PHASE_10_TASKS.md Workstream E
 * Group 6.2's status-transition action (`setOrderStatus`) — `lastModifiedAt` alone,
 * not `status === "Modified"`, since `reassignOrderRetailer`/`editOrderItems` also
 * stamp it on any real edit, and a re-generated PDF should always show the true
 * last-touched date regardless of which specific status the order currently holds.
 */
function renderBanners(detail: OrderDetail, oldOrderNumber: string | null, groupOrderNumber: string | null): string {
  const badges: string[] = [];
  if (detail.isRush) badges.push('<span class="badge badge-rush">RUSH</span>');
  if (detail.isRepeat) badges.push('<span class="badge badge-repeat">REPEAT</span>');

  const rows: string[] = [];
  if (badges.length > 0) rows.push(`<div class="badges">${badges.join(" ")}</div>`);
  if (oldOrderNumber) rows.push(`<div class="banner banner-old-order">Old Order #: ${escapeHtml(oldOrderNumber)}</div>`);
  if (groupOrderNumber) rows.push(`<div class="banner banner-group-order">Group Order #: ${escapeHtml(groupOrderNumber)}</div>`);
  if (detail.lastModifiedAt) {
    rows.push(`<div class="banner banner-modified">Modified on: ${escapeHtml(new Date(detail.lastModifiedAt).toLocaleDateString())}</div>`);
  }
  if (rows.length === 0) return "";
  return `<div class="order-banners">${rows.join("")}</div>`;
}

function renderOrderHeader(
  detail: OrderDetail,
  retailer: Retailer,
  customer: Customer,
  oldOrderNumber: string | null,
  groupOrderNumber: string | null
): string {
  return `
    <div class="order-header">
      ${retailer.logo ? `<img class="retailer-logo" src="${escapeHtml(retailer.logo)}" alt="${escapeHtml(retailer.name)}" />` : ""}
      <div>
        <h1>Order ${escapeHtml(detail.orderNumber)}</h1>
        <div class="meta">
          <div>Retailer: ${escapeHtml(retailer.name)}</div>
          <div>Customer: ${escapeHtml(renderCustomerName(customer))}${customer.gender ? ` (${escapeHtml(customer.gender)})` : ""}</div>
          <div>Status: ${escapeHtml(detail.status)}</div>
          <div>Type: ${escapeHtml(detail.type)}</div>
          <div>Order date: ${new Date(detail.orderDate).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
    ${renderBanners(detail, oldOrderNumber, groupOrderNumber)}`;
}

/**
 * Tier (a) — one summary page, one row per real `order_item_components` row (1-3,
 * whatever the super product actually defines). Deliberately NOT legacy's hardcoded
 * suit/tuxedo `rowspan=2` trick (PHASE_10_TASKS.md Workstream B's disclosed intentional
 * deviation) — every component gets its own row regardless of how many siblings it has.
 */
async function renderSummaryRow(component: DetailComponent, display: DisplayData): Promise<string> {
  const product = display.productById.get(component.productId);
  const qrDataUrl = await QRCode.toDataURL(component.id, { margin: 1, width: 90 });
  const primary = findInlineTextFeatures(component, display)[0];
  const primaryLabel = primary ? `${escapeHtml(primary.feature.name)}: ${escapeHtml(primary.link.textValue ?? "-")}` : "-";

  return `
    <tr class="summary-row" data-component-id="${escapeHtml(component.id)}">
      <td class="qr-cell"><img src="${qrDataUrl}" alt="QR code for ${escapeHtml(component.id)}" /></td>
      <td>${escapeHtml(product?.name ?? component.slotLabel)}<br /><span class="slot-label">${escapeHtml(component.slotLabel)}</span></td>
      <td class="primary-detail">${primaryLabel}</td>
    </tr>`;
}

async function renderSummaryPage(detail: OrderDetail, display: DisplayData): Promise<string> {
  const rows = await Promise.all(detail.items.flatMap((item) => item.components.map((component) => renderSummaryRow(component, display))));
  return `
    <section class="summary-page">
      <h2>Order Summary</h2>
      <table class="summary-table">
        <thead><tr><th>QR</th><th>Product / Slot</th><th>Primary Detail</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </section>`;
}

/**
 * Tier (b) — one detail "page" per physical unit, `page-break-before: always` (CSS,
 * applied uniformly to every `.detail-page` so the first one breaks cleanly away from the
 * summary page too).
 */
async function renderComponentDetailPage(item: DetailItem, component: DetailComponent, display: DisplayData): Promise<string> {
  const product = display.productById.get(component.productId);
  const superProduct = display.superProductById.get(item.superProductId);
  const qrDataUrl = await QRCode.toDataURL(component.id, { margin: 1, width: 140 });
  const { textEntries, structuredEntry, renderSlotEntries, remainingFeatures } = partitionFeatures(component, display);

  return `
    <section class="detail-page" data-component-id="${escapeHtml(component.id)}">
      <div class="component-header">
        <div>
          <h2>${escapeHtml(superProduct?.name ?? "Item")} <span class="sequence">#${item.sequence}</span></h2>
          <h3>${escapeHtml(product?.name ?? component.slotLabel)}</h3>
          <p class="slot-label">${escapeHtml(component.slotLabel)}</p>
        </div>
        <div class="qr">
          <img src="${qrDataUrl}" alt="QR code for component ${escapeHtml(component.id)}" />
          <span>${escapeHtml(component.id)}</span>
        </div>
      </div>
      ${renderManufacturingSteps(component, display)}

      <h4>Measurements</h4>
      ${renderMeasurements(component, display)}

      ${renderRenderSlotSection(renderSlotEntries, display)}
      ${renderTextFeatureCards(textEntries)}
      ${renderMonogramBlock(structuredEntry, renderSlotEntries, display)}

      <h4>Additional Styling</h4>
      ${renderFeatureTable(remainingFeatures, display)}

      ${component.measurementNote ? `<div class="note measurement-note"><strong>Measurement Note:</strong> ${escapeHtml(component.measurementNote)}</div>` : ""}
      ${component.stylingNote ? `<div class="note styling-note"><strong>Styling Note:</strong> ${escapeHtml(component.stylingNote)}</div>` : ""}
      ${component.referenceImage ? `<div class="reference-image"><h4>Reference Image</h4><img src="${escapeHtml(component.referenceImage)}" alt="Reference" /></div>` : ""}
      ${component.manualSizeImage ? `<div class="manual-size-image"><h4>Manual Size</h4><img src="${escapeHtml(component.manualSizeImage)}" alt="Manual Size" /></div>` : ""}
    </section>`;
}

/** Final "Customer Image" page (audit item 13) — once per order, at the very end, only when the customer has one set. */
function renderCustomerImagePage(customer: Customer): string {
  if (!customer.image) return "";
  return `
    <section class="customer-image-page">
      <h2>Customer Image</h2>
      <img class="customer-image" src="${escapeHtml(customer.image)}" alt="Customer" />
    </section>`;
}

const STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; }
  .order-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 8px; }
  .order-header h1 { margin: 0 0 4px; font-size: 20px; }
  .order-header .meta div { margin-bottom: 2px; }
  .retailer-logo { max-height: 60px; max-width: 160px; object-fit: contain; }
  .order-banners { margin: 0 0 16px; }
  .badges { margin-bottom: 4px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-right: 6px; color: #fff; }
  .badge-rush { background: #c0392b; }
  .badge-repeat { background: #27ae60; }
  .banner { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; margin: 0 6px 4px 0; }
  .banner-old-order { background: #fdecea; color: #c0392b; border: 1px solid #c0392b; }
  .banner-group-order { background: #eafaf1; color: #1e8449; border: 1px solid #1e8449; }
  .banner-modified { background: #fff8e1; color: #b7791f; border: 1px solid #b7791f; }
  .summary-page { margin-bottom: 12px; }
  .summary-table { width: 100%; border-collapse: collapse; }
  .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; font-size: 11px; }
  .qr-cell img { width: 60px; height: 60px; }
  .detail-page { page-break-before: always; padding-top: 4px; }
  .component-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .component-header h2 { margin: 0; font-size: 16px; }
  .component-header h3 { margin: 2px 0 0; font-size: 14px; }
  .sequence { color: #666; font-weight: normal; }
  .slot-label { margin: 2px 0 0; color: #666; }
  .qr { text-align: center; }
  .qr img { width: 70px; height: 70px; }
  .qr span { display: block; font-size: 8px; word-break: break-all; max-width: 90px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  th, td { border: 1px solid #ddd; padding: 3px 5px; text-align: left; font-size: 11px; }
  .empty { color: #999; font-style: italic; }
  .steps { font-size: 10px; color: #444; }
  .changed-col { text-align: center; width: 50px; }
  .changed-check { color: #1e8449; font-weight: bold; font-size: 13px; }
  .render-slot-section { display: flex; gap: 12px; margin: 8px 0; }
  .render-slot-block { border: 1px solid #ddd; border-radius: 4px; padding: 6px 10px; }
  .render-slot-block h5 { margin: 0 0 4px; font-size: 11px; color: #555; }
  .render-slot-image { width: 80px; height: 80px; object-fit: contain; display: block; margin-top: 4px; }
  .detail-cards { display: flex; gap: 10px; margin: 8px 0; }
  .detail-card { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; flex: 1; }
  .detail-card h5 { margin: 0 0 4px; font-size: 11px; color: #555; }
  .monogram-block { border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin: 8px 0; max-width: 320px; }
  .monogram-block h4 { margin: 0 0 6px; font-size: 13px; }
  .monogram-fields td { border: none; padding: 2px 6px; font-size: 11px; }
  .note { margin: 6px 0; font-size: 11px; }
  .reference-image img { max-width: 200px; max-height: 200px; }
  .customer-image-page { page-break-before: always; text-align: center; }
  .customer-image { max-width: 80%; max-height: 80%; }
`;

async function renderOrderHtml(
  detail: OrderDetail,
  retailer: Retailer,
  customer: Customer,
  display: DisplayData,
  oldOrderNumber: string | null,
  groupOrderNumber: string | null
): Promise<string> {
  const header = renderOrderHeader(detail, retailer, customer, oldOrderNumber, groupOrderNumber);
  const summaryPage = await renderSummaryPage(detail, display);
  const detailPages = await Promise.all(
    detail.items.flatMap((item) => item.components.map((component) => renderComponentDetailPage(item, component, display)))
  );
  const customerImagePage = renderCustomerImagePage(customer);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${STYLES}</style>
  </head>
  <body>
    ${header}
    ${summaryPage}
    ${detailPages.join("")}
    ${customerImagePage}
  </body>
</html>`;
}

/** A single reused Chromium instance across calls, launched lazily on first use — cheaper than the legacy's launch-per-request, and closed explicitly by `closePdfBrowser` (tests, graceful shutdown). */
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

async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // `domcontentloaded`, not `networkidle0`: the page has no external resources (QR
    // codes are inline data URIs) other than possible retailer-logo/reference-image/
    // customer-image URLs, and we don't want PDF generation to hang or fail on a slow/
    // unreachable image host.
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    const buffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "16mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      // Puppeteer's own page-number interpolation convention: these two class names,
      // not literal "X"/"Y" text — populated by Chromium itself at render time.
      footerTemplate:
        '<div style="width:100%; font-size:9px; text-align:center; color:#666;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

/**
 * The customer's most recent *other* order, chronologically before this one (audit item 7)
 * — same technique legacy used (`routes.order.js`'s own old-order lookup: every order for
 * this customer sorted by date desc, take the one immediately after the current order in
 * that ordering), expressed directly as "the most recent order for this customer with an
 * earlier `orderDate`" rather than legacy's positional `[1]`-index trick, which silently
 * breaks if the "current" order isn't actually the customer's most recent (e.g. a PDF
 * regenerated for an older order after a newer one has since been placed) — this version
 * stays correct regardless of when the PDF is (re)generated.
 */
async function findOldOrderNumber(tx: Transaction, order: typeof orders.$inferSelect): Promise<string | null> {
  const oldOrder = await tx.query.orders.findFirst({
    where: (o, { and, eq: eqOp, lt, isNull }) => and(eqOp(o.customerId, order.customerId), lt(o.orderDate, order.orderDate), isNull(o.deletedAt)),
    orderBy: (o, { desc }) => desc(o.orderDate),
  });
  return oldOrder?.orderNumber ?? null;
}

/** Group Order ID (audit item 9) — looks up `order_groups.order_number` for a group child order. */
async function findGroupOrderNumber(tx: Transaction, order: typeof orders.$inferSelect): Promise<string | null> {
  if (order.type !== "group" || !order.groupId) return null;
  const group = await tx.query.orderGroups.findFirst({ where: eq(orderGroups.id, order.groupId) });
  return group?.orderNumber ?? null;
}

/** Exposed separately from `generateOrderPdf` so tests can inspect the exact HTML (and therefore the exact QR data URIs) fed to Puppeteer, without re-deriving it. */
export async function buildOrderPdfHtml(
  tenantId: string,
  orderId: string,
  actorRetailerId?: string | null
): Promise<{ html: string; detail: OrderDetail; oldOrderNumber: string | null; groupOrderNumber: string | null }> {
  const { detail, retailer, customer, display, oldOrderNumber, groupOrderNumber } = await withTenant(tenantId, async (tx) => {
    const order = await requireOrder(tx, orderId, actorRetailerId);
    const orderDetail = await assembleOrderDetail(tx, order);
    const orderRetailer = await requireRetailer(tx, order.retailerId);
    const orderCustomer = await tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) });
    if (!orderCustomer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", `Customer ${order.customerId} not found`);
    const orderDisplay = await loadDisplayData(tx, orderDetail);
    const [oldNumber, groupNumber] = await Promise.all([findOldOrderNumber(tx, order), findGroupOrderNumber(tx, order)]);
    return {
      detail: orderDetail,
      retailer: orderRetailer,
      customer: orderCustomer,
      display: orderDisplay,
      oldOrderNumber: oldNumber,
      groupOrderNumber: groupNumber,
    };
  });

  const html = await renderOrderHtml(detail, retailer, customer, display, oldOrderNumber, groupOrderNumber);
  return { html, detail, oldOrderNumber, groupOrderNumber };
}

/**
 * Generates the order/production-ticket PDF, writes it under the local `pdf/` directory
 * (sibling to `drizzle/` — S3 isn't wired up anywhere in this codebase yet, see
 * PHASE_6_TASKS.md Group 3's note; uploading there is a small follow-up, not blocking
 * scope here), and records the path on `orders.pdf_path`.
 */
export async function generateOrderPdf(
  tenantId: string,
  orderId: string,
  actorRetailerId?: string | null
): Promise<{ path: string; order: OrderDetail & { pdfPath: string } }> {
  const { html, detail } = await buildOrderPdfHtml(tenantId, orderId, actorRetailerId);
  const pdfBuffer = await renderHtmlToPdfBuffer(html);

  await fs.mkdir(PDF_DIR, { recursive: true });
  const filePath = path.join(PDF_DIR, `${detail.orderNumber}.pdf`);
  await fs.writeFile(filePath, pdfBuffer);

  await withTenant(tenantId, async (tx) => {
    await tx.update(orders).set({ pdfPath: filePath, updatedAt: new Date() }).where(eq(orders.id, orderId));
  });

  return { path: filePath, order: { ...detail, pdfPath: filePath } };
}
