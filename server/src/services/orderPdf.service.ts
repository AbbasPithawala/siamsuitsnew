import { eq, inArray } from "drizzle-orm";
import puppeteer, { type Browser } from "puppeteer";
import QRCode from "qrcode";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { orders, orderGroups, customers, products, superProducts, measurementDefinitions, features, styles, styleOptions, processes } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOrder, assembleOrderDetail } from "./orders.service";
import { requireRetailer } from "./customers.service";
import { storageBackend } from "./storage.service";

type OrderDetail = Awaited<ReturnType<typeof assembleOrderDetail>>;
type DetailItem = OrderDetail["items"][number];
type DetailComponent = DetailItem["components"][number];
type DetailFeature = DetailComponent["features"][number];
type FeatureRow = typeof features.$inferSelect;
type ProductRow = typeof products.$inferSelect;
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
 * to a display label, Thai name, and, where set, an image — the style option's image takes
 * precedence over the style's own (a selected sub-option is the more specific choice), same
 * precedence `FeatureSelector`'s own picker uses client-side. `styleOptions` carries no Thai
 * name column of its own (checked against `db/schema/catalog.ts` directly, not assumed) —
 * `thaiName` always comes from the parent style, `null` when the style itself has none set.
 */
function describeChoiceSelection(link: DetailFeature, display: DisplayData): { label: string; thaiName: string | null; image: string | null } {
  const style = link.styleId ? display.styleById.get(link.styleId) : undefined;
  const option = link.styleOptionId ? display.styleOptionById.get(link.styleOptionId) : undefined;
  const label = [style?.name, option?.name].filter((v): v is string => Boolean(v)).join(" / ") || "-";
  const image = option?.image ?? style?.image ?? null;
  const thaiName = style?.thaiName ?? null;
  return { label, thaiName, image };
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
 * Partitions a component's features into the dedicated sections every detail page renders
 * specifically: inline text/fabric-lining-piping cards, the structured Monogram feature,
 * any `render_slot`-tagged feature, and — the split that closes this pass's biggest visual
 * gap — every remaining `choice` feature bucketed by `features.is_additional`, the direct
 * generic equivalent of legacy's per-feature `groupStyle[x]/style[x].additional` flag
 * (verified against `db/schema/catalog.ts`: it lives on `features`, not per-selection, same
 * as legacy). `is_additional === false` is legacy's large image-icon grid (page 2);
 * `is_additional === true` is legacy's smaller text-only "additional details" row (page 3).
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

  const remaining: { link: DetailFeature; feature: FeatureRow }[] = [];
  for (const link of component.features) {
    if (excludedFeatureIds.has(link.featureId)) continue;
    const feature = display.featureById.get(link.featureId);
    if (feature) remaining.push({ link, feature });
  }

  return {
    textEntries,
    structuredEntry,
    renderSlotEntries,
    iconFeatures: remaining.filter((e) => !e.feature.isAdditional),
    additionalFeatures: remaining.filter((e) => e.feature.isAdditional),
  };
}

/**
 * Measurements table (audit item 2/legacy's `skin`/`FIT`/`TTL` columns) — row label is
 * `"{name}[{thai_name}]"` matching legacy exactly when a Thai name is set, just the plain
 * name when it isn't (legacy always had one; our catalog data doesn't guarantee it).
 */
function renderMeasurements(component: DetailComponent, display: DisplayData): string {
  if (component.measurements.length === 0) return "<p class=\"empty\">No measurements recorded.</p>";
  const rows = component.measurements
    .map((m) => {
      const def = display.measurementDefinitionById.get(m.measurementDefinitionId);
      const name = def?.name ?? m.measurementDefinitionId;
      const label = def?.thaiName ? `${name}[${def.thaiName}]` : name;
      const changed = m.changedFromProfile === true ? '<span class="changed-check" title="Changed from customer profile">&#10003;</span>' : "";
      return `<tr><td>${escapeHtml(label)}</td><td>${m.value ?? "-"}</td><td>${m.adjustmentValue ?? "-"}</td><td class="ttl-value">${m.totalValue ?? "-"}</td><td class="changed-col">${changed}</td></tr>`;
    })
    .join("");
  return `<table class="measurements">
    <thead><tr><th></th><th>skin<span class="thai">นิ้ว</span></th><th>FIT<span class="thai">(+)</span></th><th>TTL<span class="thai">นิ้ว</span></th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Manual Size (Workstream E Group 6): `component.manualSizeImage` if the order was
 * annotated, else the product's own static `measurementDiagramImage` fallback diagram —
 * generic per-product, never a per-product-name-literal file path the way legacy built
 * `PicBaseUrl3 + "images/manual/" + item_code + "_manual.png"`. Omitted entirely (not a
 * broken-image placeholder) when neither is set, matching this file's existing degrade-
 * gracefully convention for `referenceImage`/`manualSizeImage`.
 *
 * Legacy's "Manual size : {fitting_type}" label text has no equivalent field anywhere in
 * this schema (`order_item_components` has no fitting-type column, and
 * PHASE_10_TASKS.md Workstream E's Manual Size redesign is documented as a rasterized
 * annotated-diagram image only, never carrying a separate fitting-type string) — flagged in
 * this pass's report rather than invented; only the "Manual Size" heading + image render.
 */
function renderManualSizeSection(component: DetailComponent, product: ProductRow | undefined): string {
  const image = component.manualSizeImage ?? product?.measurementDiagramImage ?? null;
  if (!image) return "";
  return `
    <div class="manual-size-image">
      <h4>Manual Size</h4>
      <img src="${escapeHtml(image)}" alt="Manual Size" />
    </div>`;
}

/**
 * Measurement Note + Shoulder/Pant Type (audit item 5), combined into the one small table
 * legacy renders them in. The render-slot feature's own catalog `name` supplies the label
 * generically ("Shoulder Type" on a jacket, a differently-named feature on another product)
 * — this function never branches on product identity, only on whether a `shoulder_type`
 * render-slot feature happens to be linked to this component.
 */
function renderMeasurementNoteTable(
  component: DetailComponent,
  renderSlotEntries: { link: DetailFeature; feature: FeatureRow }[],
  display: DisplayData
): string {
  const shoulderEntry = renderSlotEntries.find((e) => e.feature.renderSlot === "shoulder_type");
  const rows = [`<tr><td>Measurement Note:</td><td>${escapeHtml(component.measurementNote ?? "N/A")}</td><td></td></tr>`];
  if (shoulderEntry) {
    const { label, image } = describeChoiceSelection(shoulderEntry.link, display);
    rows.push(
      `<tr><td>${escapeHtml(shoulderEntry.feature.name)}:</td><td>${escapeHtml(label)}</td><td>${
        image ? `<img class="render-slot-image" src="${escapeHtml(image)}" alt="${escapeHtml(shoulderEntry.feature.name)}" />` : ""
      }</td></tr>`
    );
  }
  return `<table class="measurement-note-table"><tbody>${rows.join("")}</tbody></table>`;
}

/** Fabric/Lining/Piping (audit item 4) — one bordered card per `text`-type feature actually linked to the component, labeled generically off the feature's own name, never a hardcoded field name. Rendered identically on both of a unit's detail pages (legacy literally repeats this section on its second page too). */
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
 * The visual styling icon grid (the biggest fidelity gap this pass closes) — one bordered
 * card per non-additional `choice` feature actually selected on this component, with a real
 * `<img>` of the selected style/style-option's image, the feature name as a label, and the
 * selected value's name + Thai name underneath — matching legacy's `groupStyle`/`style`
 * icon-grid section exactly in content, generically (no product/feature-name branching).
 * A real choice feature can legitimately have no image set on either its style or the
 * selected style-option (`styles.image`/`style_options.image` are both nullable) — falls
 * back to a text-only card in the same grid position rather than a different layout
 * entirely, so the grid stays visually uniform regardless of catalog completeness.
 */
function renderStylingIconGrid(iconFeatures: { link: DetailFeature; feature: FeatureRow }[], display: DisplayData): string {
  if (iconFeatures.length === 0) return "<p class=\"empty\">No additional styling selected.</p>";
  const cards = iconFeatures
    .map(({ link, feature }) => {
      const { label, thaiName, image } = describeChoiceSelection(link, display);
      return `
        <div class="icon-card">
          <h6>${escapeHtml(feature.name)}</h6>
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(label)}" />` : ""}
          <p>${escapeHtml(label)}</p>
          ${thaiName ? `<p class="thai-name">${escapeHtml(thaiName)}</p>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="styling-icon-grid">${cards}</div>`;
}

/** Legacy's smaller text-only "additional details" row (page 3) — every `is_additional` choice feature, value + Thai name, no image (legacy never shows one here either). */
function renderAdditionalFeatureCards(additionalFeatures: { link: DetailFeature; feature: FeatureRow }[], display: DisplayData): string {
  if (additionalFeatures.length === 0) return "";
  const cards = additionalFeatures
    .map(({ link, feature }) => {
      const { label, thaiName } = describeChoiceSelection(link, display);
      const value = thaiName ? `${thaiName} / ${label}` : label;
      return `
        <div class="additional-card">
          <h6>${escapeHtml(feature.name)}</h6>
          <p>${escapeHtml(value)}</p>
        </div>`;
    })
    .join("");
  return `<div class="additional-feature-grid">${cards}</div>`;
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
 * Omitted entirely for a component with no Monogram feature at all, rather than legacy's
 * "N/A" in every field — a component with no `structured` feature genuinely doesn't support
 * monogramming, so a whole empty table would just be noise.
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
          <tr><td>Font Color</td><td>${escapeHtml(value.color ?? "-")}</td></tr>
          <tr><td>Monogram Name</td><td>${escapeHtml(value.text ?? "-")}</td></tr>
          <tr><td>Monogram Line 2</td><td>${escapeHtml(value.text2 ?? "-")}</td></tr>
        </tbody>
      </table>
    </div>`;
}

/** Always rendered, "No Note" fallback — matches legacy's always-present Styling Note box, not this file's prior conditional-render behavior. */
function renderStylingNoteBox(component: DetailComponent): string {
  return `
    <div class="styling-note-box">
      <h5>Styling Note</h5>
      <p>${escapeHtml(component.stylingNote ?? "No Note")}</p>
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
 * Now rendered once per page (inside `renderPageHeader`), not once for the whole document.
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

/** A line-item quantity summary ("1 Jacket", "2 Suit"), grouped by real `order_items.super_product_id` (legacy's own `order.order_items[].quantity/item_name`, generalized) — one line per distinct super product actually ordered, in first-appearance order, not one line per physical unit. Reused verbatim both on the summary page's footer bar and inline in every detail page's header. */
function renderQuantitySummary(detail: OrderDetail, display: DisplayData): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const item of detail.items) {
    if (!counts.has(item.superProductId)) order.push(item.superProductId);
    counts.set(item.superProductId, (counts.get(item.superProductId) ?? 0) + 1);
  }
  return order
    .map((superProductId) => {
      const name = display.superProductById.get(superProductId)?.name ?? "Item";
      return `<span class="quantity-line">${counts.get(superProductId) ?? 0} ${escapeHtml(name)}</span>`;
    })
    .join("");
}

interface HeaderUnitContext {
  unitIndex: number;
  totalUnits: number;
  superProductName: string;
}

interface PageHeaderParams {
  detail: OrderDetail;
  retailer: Retailer;
  customer: Customer;
  oldOrderNumber: string | null;
  groupOrderNumber: string | null;
  orderTypeLabel: string;
  qrDataUrl: string;
  qrCaption: string;
  quantitySummaryHtml: string;
  unit?: HeaderUnitContext;
}

/**
 * The repeated per-page header (audit item 1's structural fix) — called once per page
 * (summary page + both detail pages of every unit), not once for the whole document.
 * `params.unit` distinguishes the two shapes: unset for the summary page (order-level QR,
 * no unit line/quantity index), set for a unit's own detail pages ("X OF Y", "{index}
 * {super product name}", the per-unit QR).
 */
function renderPageHeader(params: PageHeaderParams): string {
  const { detail, retailer, customer, oldOrderNumber, groupOrderNumber, orderTypeLabel, qrDataUrl, qrCaption, quantitySummaryHtml, unit } = params;
  const genderLabel = customer.gender ?? "-";

  const left = `
    <div class="header-left">
      <div class="header-row"><span class="label">Name:</span><span>${escapeHtml(renderCustomerName(customer))}</span></div>
      <div class="header-row"><span class="label">${unit ? "order Date:" : "Date:"}</span><span>${new Date(detail.orderDate).toLocaleDateString()}</span>${
        unit ? "" : `<span class="gender-inline">${escapeHtml(genderLabel)}</span>`
      }</div>
      ${unit ? `<div class="header-row"><span class="label">Quantity</span><span>${unit.unitIndex} OF ${unit.totalUnits}</span></div>` : ""}
      <div class="header-row"><span class="label">Old Order:</span><span>${escapeHtml(oldOrderNumber ?? "None")}</span></div>
      ${renderBanners(detail, oldOrderNumber, groupOrderNumber)}
    </div>`;

  const middle = `
    <div class="header-middle">
      ${unit ? `<div class="gender-label">${escapeHtml(genderLabel)}</div>` : ""}
      <div class="order-info-box">
        <div class="order-number">${escapeHtml(detail.orderNumber)}</div>
        <div>${escapeHtml(orderTypeLabel)}</div>
        ${groupOrderNumber ? `<div>${escapeHtml(groupOrderNumber)}</div>` : ""}
        ${unit ? `<div class="unit-label">${unit.unitIndex} ${escapeHtml(unit.superProductName)}</div>` : ""}
      </div>
      ${unit ? `<div class="quantity-list">${quantitySummaryHtml}</div>` : ""}
    </div>`;

  const right = `
    <div class="header-right">
      <div class="header-qr"><img src="${qrDataUrl}" alt="QR code" /><span>${escapeHtml(qrCaption)}</span></div>
      ${retailer.logo ? `<img class="retailer-logo" src="${escapeHtml(retailer.logo)}" alt="${escapeHtml(retailer.name)}" />` : ""}
    </div>`;

  return `<div class="page-header">${left}${middle}${right}</div>`;
}

/**
 * Tier (a) — one summary page, one row per real `order_item_components` row (1-3,
 * whatever the super product actually defines). Deliberately NOT legacy's hardcoded
 * suit/tuxedo `rowspan=2` trick (PHASE_10_TASKS.md Workstream B's disclosed intentional
 * deviation) — every component gets its own row regardless of how many siblings it has.
 */
async function renderSummaryRow(component: DetailComponent, display: DisplayData, unitLabel: string): Promise<string> {
  const product = display.productById.get(component.productId);
  const qrDataUrl = await QRCode.toDataURL(component.id, { margin: 1, width: 90 });
  const primary = findInlineTextFeatures(component, display)[0];
  const primaryLabel = primary ? `${escapeHtml(primary.feature.name)}: ${escapeHtml(primary.link.textValue ?? "-")}` : "-";

  return `
    <tr class="summary-row" data-component-id="${escapeHtml(component.id)}">
      <td>${escapeHtml(product?.name ?? component.slotLabel)}</td>
      <td>${escapeHtml(unitLabel)}</td>
      <td class="primary-detail">${primaryLabel}</td>
      <td class="qr-cell"><img src="${qrDataUrl}" alt="QR code for ${escapeHtml(component.id)}" /><br /><span>${escapeHtml(component.id)}</span></td>
    </tr>`;
}

async function renderSummaryPage(
  detail: OrderDetail,
  display: DisplayData,
  headerHtml: string,
  quantityFooterHtml: string,
  unitLabelById: Map<string, string>
): Promise<string> {
  const rows = await Promise.all(
    detail.items.flatMap((item) =>
      item.components.map((component) => renderSummaryRow(component, display, unitLabelById.get(component.id) ?? component.slotLabel))
    )
  );
  return `
    <section class="summary-page">
      ${headerHtml}
      <table class="summary-table">
        <thead><tr><th>Product</th><th>Unit</th><th>Primary Detail</th><th>QR</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
      <div class="quantity-footer-bar">${quantityFooterHtml}</div>
    </section>`;
}

/**
 * Tier (b) — two detail pages per physical unit (measurements + monogram/fabric recap),
 * plus an optional third (reference image), each `page-break-before: always`. Every page a
 * unit gets repeats the same `headerHtml` (built once per unit by the caller, since it's
 * identical across both/all of that unit's own pages and only the per-page QR differs from
 * the summary page's order-level one).
 */
function renderComponentDetailPages(
  orderNumber: string,
  item: DetailItem,
  component: DetailComponent,
  product: ProductRow | undefined,
  display: DisplayData,
  headerHtml: string
): string {
  const { textEntries, structuredEntry, renderSlotEntries, iconFeatures, additionalFeatures } = partitionFeatures(component, display);
  const fabricCards = renderTextFeatureCards(textEntries);

  const measurementsPage = `
    <section class="detail-page measurements-page" data-component-id="${escapeHtml(component.id)}">
      ${headerHtml}
      ${renderManufacturingSteps(component, display)}
      <div class="measurements-layout">
        <div class="measurements-column">
          <h4>Measurements</h4>
          ${renderMeasurements(component, display)}
        </div>
        <div class="manual-size-column">
          ${renderManualSizeSection(component, product)}
          ${renderMeasurementNoteTable(component, renderSlotEntries, display)}
        </div>
      </div>
      ${fabricCards}
      ${renderStylingIconGrid(iconFeatures, display)}
    </section>`;

  const monogramPage = `
    <section class="detail-page monogram-page" data-component-id="${escapeHtml(component.id)}">
      ${headerHtml}
      ${renderAdditionalFeatureCards(additionalFeatures, display)}
      <div class="monogram-layout">
        ${renderMonogramBlock(structuredEntry, renderSlotEntries, display)}
        <div class="monogram-fabric-recap">
          ${fabricCards}
          ${renderStylingNoteBox(component)}
        </div>
      </div>
    </section>`;

  const referencePage = component.referenceImage
    ? `
    <section class="detail-page reference-image-page" data-component-id="${escapeHtml(component.id)}">
      <h3>${escapeHtml(`${product?.name ?? component.slotLabel} (${orderNumber})`)}</h3>
      <img src="${escapeHtml(component.referenceImage)}" alt="Reference" />
    </section>`
    : "";

  return measurementsPage + monogramPage + referencePage;
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
  h1, h2, h3, h4, h5, h6 { font-family: inherit; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  th, td { border: 1px solid #ddd; padding: 3px 5px; text-align: left; font-size: 11px; }
  .empty { color: #999; font-style: italic; }
  .thai { display: block; font-size: 9px; color: #777; }

  .page-header { display: flex; justify-content: space-between; gap: 16px; border: 1px solid #1a1a1a; padding: 8px; margin-bottom: 8px; }
  .header-left, .header-middle, .header-right { flex: 1; }
  .header-row { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; position: relative; }
  .header-row .label { color: #444; }
  .gender-inline { position: absolute; right: 0; text-transform: uppercase; font-size: 10px; }
  .header-middle { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
  .gender-label { font-weight: bold; }
  .order-info-box { border: 1px solid #1a1a1a; padding: 4px 10px; display: flex; flex-direction: column; align-items: center; }
  .order-number { text-decoration: underline; }
  .unit-label { text-transform: capitalize; }
  .quantity-list { display: flex; flex-direction: column; gap: 2px; font-size: 10px; }
  .header-right { display: flex; gap: 12px; justify-content: flex-end; align-items: flex-start; }
  .header-qr { text-align: center; }
  .header-qr img { width: 70px; height: 70px; }
  .header-qr span { display: block; font-size: 8px; word-break: break-all; max-width: 90px; }
  .retailer-logo { max-height: 60px; max-width: 140px; object-fit: contain; }

  .order-banners { margin-top: 4px; }
  .badges { margin-bottom: 4px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-right: 6px; color: #fff; }
  .badge-rush { background: #c0392b; }
  .badge-repeat { background: #27ae60; }
  .banner { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; margin: 0 6px 4px 0; }
  .banner-old-order { background: #fdecea; color: #c0392b; border: 1px solid #c0392b; }
  .banner-group-order { background: #eafaf1; color: #1e8449; border: 1px solid #1e8449; }
  .banner-modified { background: #fff8e1; color: #b7791f; border: 1px solid #b7791f; }

  .summary-page { margin-bottom: 12px; }
  .summary-table th, .summary-table td { text-align: center; }
  .summary-table .primary-detail { text-align: left; }
  .qr-cell img { width: 60px; height: 60px; }
  .quantity-footer-bar { display: flex; justify-content: space-evenly; border: 1px solid #1a1a1a; padding: 6px; margin-top: 8px; }
  .quantity-line { text-transform: capitalize; }

  .detail-page { page-break-before: always; padding-top: 4px; }
  .steps { font-size: 10px; color: #444; }

  .measurements-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  .measurements td.ttl-value { font-weight: bold; color: #c0392b; }
  .changed-col { text-align: center; width: 30px; }
  .changed-check { color: #1e8449; font-weight: bold; font-size: 13px; }
  .manual-size-image img { width: 100%; max-width: 420px; max-height: 220px; object-fit: contain; }
  .measurement-note-table td { vertical-align: middle; }
  .render-slot-image { width: 50px; height: 50px; object-fit: contain; }

  .detail-cards { display: flex; gap: 10px; margin: 8px 0; }
  .detail-card { border: 1px solid #1a1a1a; border-radius: 4px; padding: 6px 10px; flex: 1; text-align: center; }
  .detail-card h5 { margin: 0 0 4px; font-size: 11px; }

  .styling-icon-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; }
  .icon-card { border: 1px solid #ccc; border-radius: 4px; padding: 6px; width: 110px; text-align: center; }
  .icon-card img { width: 90px; height: 90px; object-fit: contain; display: block; margin: 4px auto; }
  .icon-card h6 { margin: 0; font-size: 10px; text-transform: capitalize; }
  .icon-card p { margin: 2px 0; font-size: 10px; text-transform: capitalize; }
  .thai-name { color: #666; }

  .additional-feature-grid { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  .additional-card { border: 1px solid #1a1a1a; border-radius: 4px; padding: 4px 8px; text-align: center; min-width: 90px; }
  .additional-card h6 { margin: 0 0 4px; font-size: 10px; text-transform: capitalize; }

  .monogram-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .monogram-block { border: 1px solid #1a1a1a; border-radius: 4px; padding: 8px; }
  .monogram-block h4 { margin: 0 0 6px; font-size: 13px; text-align: center; }
  .monogram-fields td { border: none; padding: 2px 6px; font-size: 11px; }
  .styling-note-box { border: 1px solid #1a1a1a; padding: 6px; margin-top: 8px; text-align: center; }
  .styling-note-box h5 { margin: 0 0 4px; }

  .reference-image-page { text-align: center; }
  .reference-image-page img { max-width: 100%; max-height: 70vh; object-fit: contain; }
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
  const allUnits = detail.items.flatMap((item) => item.components.map((component) => ({ item, component })));
  const totalUnits = allUnits.length;

  // Legacy's numbered unit label ("jacket 1", "jacket 2") counts occurrences per real
  // *product*, generically — not a per-product-name-literal counter — across the whole
  // order, in the same order the flattened unit list is walked.
  const productOccurrence = new Map<string, number>();
  const unitLabelById = new Map<string, string>();
  const unitSuperProductNameById = new Map<string, string>();
  const unitIndexById = new Map<string, number>();
  allUnits.forEach(({ item, component }, idx) => {
    const product = display.productById.get(component.productId);
    const occurrence = (productOccurrence.get(component.productId) ?? 0) + 1;
    productOccurrence.set(component.productId, occurrence);
    unitLabelById.set(component.id, `${product?.name ?? component.slotLabel} ${occurrence}`);
    unitSuperProductNameById.set(component.id, display.superProductById.get(item.superProductId)?.name ?? "Item");
    unitIndexById.set(component.id, idx + 1);
  });

  const orderTypeLabel = detail.type === "group" ? "Group Order" : "Normal Order";
  const quantitySummaryHtml = renderQuantitySummary(detail, display);

  const orderQrDataUrl = await QRCode.toDataURL(detail.orderNumber, { margin: 1, width: 90 });
  const summaryHeader = renderPageHeader({
    detail,
    retailer,
    customer,
    oldOrderNumber,
    groupOrderNumber,
    orderTypeLabel,
    qrDataUrl: orderQrDataUrl,
    qrCaption: detail.orderNumber,
    quantitySummaryHtml,
  });
  const summaryPage = await renderSummaryPage(detail, display, summaryHeader, quantitySummaryHtml, unitLabelById);

  const detailPages = await Promise.all(
    allUnits.map(async ({ item, component }) => {
      const product = display.productById.get(component.productId);
      const qrDataUrl = await QRCode.toDataURL(component.id, { margin: 1, width: 140 });
      const unitHeader = renderPageHeader({
        detail,
        retailer,
        customer,
        oldOrderNumber,
        groupOrderNumber,
        orderTypeLabel,
        qrDataUrl,
        qrCaption: component.id,
        quantitySummaryHtml,
        unit: {
          unitIndex: unitIndexById.get(component.id) ?? 0,
          totalUnits,
          superProductName: unitSuperProductNameById.get(component.id) ?? "Item",
        },
      });
      return renderComponentDetailPages(detail.orderNumber, item, component, product, display, unitHeader);
    })
  );

  const customerImagePage = renderCustomerImagePage(customer);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${STYLES}</style>
  </head>
  <body>
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
 * Generates the order/production-ticket PDF and uploads it through the same
 * `storageBackend` abstraction `uploads.routes.ts` already uses for reference
 * images/Manual Size annotations — local disk (served back out via the `/uploads`
 * static route in `app.ts`) in dev/test, S3 automatically once real AWS credentials
 * are provisioned (`storage.service.ts`'s `createStorageBackend`). `orders.pdf_path`
 * stores the real, resolvable URL this returns (`resolveUploadUrl` on the client can
 * use it directly), not a server-local filesystem path — a prior version wrote
 * straight to a local `pdf/` directory with no static route serving it at all, so a
 * generated PDF had no way to actually be viewed (PHASE_10_TASKS.md follow-up).
 */
export async function generateOrderPdf(
  tenantId: string,
  orderId: string,
  actorRetailerId?: string | null
): Promise<{ path: string; order: OrderDetail & { pdfPath: string } }> {
  const { html, detail } = await buildOrderPdfHtml(tenantId, orderId, actorRetailerId);
  const pdfBuffer = await renderHtmlToPdfBuffer(html);

  const { url } = await storageBackend.upload(pdfBuffer, "application/pdf", "order-pdfs");

  await withTenant(tenantId, async (tx) => {
    await tx.update(orders).set({ pdfPath: url, updatedAt: new Date() }).where(eq(orders.id, orderId));
  });

  return { path: url, order: { ...detail, pdfPath: url } };
}
