import { eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { orders, orderGroups, customers, products, superProducts, measurementDefinitions, features, styles, styleOptions, processes } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { requireOrder, assembleOrderDetail } from "./orders.service";
import { requireRetailer } from "./customers.service";
import { storageBackend, resolveServerImageUrl } from "./storage.service";
import { PDF_FONT_FACE_CSS } from "./pdfFonts";
import { closePdfBrowser, escapeHtml, renderHtmlToPdfBuffer, titleCase } from "./pdfRenderer";

export { closePdfBrowser };

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
      const name = titleCase(def?.name ?? m.measurementDefinitionId);
      const label = def?.thaiName ? `${name} [${def.thaiName}]` : name;
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
      <img src="${escapeHtml(resolveServerImageUrl(image))}" alt="Manual Size" />
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
  const rows = [`<tr><td>Measurement Note:</td><td>${escapeHtml(component.measurementNote ?? "N/A")}</td></tr>`];
  if (shoulderEntry) {
    // Value only (audit item: the image column added visual noise for no benefit — the shoulder
    // type's own selected image is a picker aid on the order-builder side, not something a
    // production ticket needs repeated here).
    const { label } = describeChoiceSelection(shoulderEntry.link, display);
    rows.push(`<tr><td>${escapeHtml(shoulderEntry.feature.name)}:</td><td>${escapeHtml(label)}</td></tr>`);
  }
  return `<table class="measurement-note-table"><tbody>${rows.join("")}</tbody></table>`;
}

/**
 * Fabric/Lining/Piping (audit item 4) — one bordered card per `text`-type feature actually
 * linked to the component, PLUS the `renderSlot === "piping"` feature if one's linked (a real
 * reported gap: Piping is a `choice` feature, not `text`, so it needs its selected style's
 * name, not a `textValue`, to land in this same row — the real user-facing requirement is
 * "Piping belongs in this exact box with Fabric/Lining, not off on its own"). Labeled
 * generically off each feature's own name/Thai name (legacy's real "FABRIC ผ้า"/"LINING
 * ซับใน" labels are exactly this: an uppercase English name plus the feature's own Thai name,
 * not a hardcoded field), never a hardcoded field name. Rendered identically on both of a
 * unit's detail pages (legacy literally repeats this section on its second page too).
 */
function renderFabricLiningPipingCards(
  textEntries: { link: DetailFeature; feature: FeatureRow }[],
  pipingEntry: { link: DetailFeature; feature: FeatureRow } | undefined,
  display: DisplayData
): string {
  const entries: { feature: FeatureRow; value: string }[] = textEntries.map(({ link, feature }) => ({
    feature,
    value: link.textValue ?? "-",
  }));
  if (pipingEntry) {
    entries.push({ feature: pipingEntry.feature, value: describeChoiceSelection(pipingEntry.link, display).label });
  }
  if (entries.length === 0) return "";

  const cards = entries
    .map(({ feature, value }) => {
      const label = feature.thaiName ? `${feature.name.toUpperCase()} ${feature.thaiName}` : feature.name.toUpperCase();
      return `
      <div class="detail-card">
        <h5>${escapeHtml(label)}</h5>
        <p>${escapeHtml(value)}</p>
      </div>`;
    })
    .join("");
  // Column count matches the real entry count, not a fixed 3 — so this box always spans the
  // same full width as the Measurement Note table above it (a real reported mismatch: with
  // Piping now folded in here too, a 2-entry order previously left a fixed 3rd grid column
  // empty, visibly narrowing the box relative to its neighbor).
  return `<div class="detail-cards" style="grid-template-columns: repeat(${entries.length}, 1fr);">${cards}</div>`;
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
          ${image ? `<img src="${escapeHtml(resolveServerImageUrl(image))}" alt="${escapeHtml(label)}" />` : ""}
          <p>${escapeHtml(label)}</p>
          ${thaiName ? `<p class="thai-name">${escapeHtml(thaiName)}</p>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="styling-icon-grid">${cards}</div>`;
}

/**
 * Its own separate, distinctly-boxed "Additional styles" section on the second unit-detail
 * page — never merged into the normal styling icon grid on the first page, matching the
 * order builder's own real "Show Additional styles" split (`FeatureSelector.tsx`'s
 * `AdditionalStylesSection`), just always-visible here since a PDF has no checkbox to
 * gate it behind. Same real picture-card look as the normal grid (a real reported gap —
 * this used to be text-only, no image, unlike the order builder's own additional-styles
 * tiles, which are the exact same `StyleOptionButton` picture cards as normal styles).
 */
function renderAdditionalFeatureCards(additionalFeatures: { link: DetailFeature; feature: FeatureRow }[], display: DisplayData): string {
  if (additionalFeatures.length === 0) return "";
  const cards = additionalFeatures
    .map(({ link, feature }) => {
      const { label, thaiName, image } = describeChoiceSelection(link, display);
      return `
        <div class="additional-card">
          <h6>${escapeHtml(feature.name)}</h6>
          ${image ? `<img src="${escapeHtml(resolveServerImageUrl(image))}" alt="${escapeHtml(label)}" />` : ""}
          <p>${escapeHtml(label)}</p>
          ${thaiName ? `<p class="thai-name">${escapeHtml(thaiName)}</p>` : ""}
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
  const heading = structuredEntry.feature.thaiName
    ? `${structuredEntry.feature.name} / ${structuredEntry.feature.thaiName}`
    : structuredEntry.feature.name;

  return `
    <div class="monogram-block">
      <h4>${escapeHtml(heading)}</h4>
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

function renderCustomerName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter((v): v is string => Boolean(v)).join(" ");
}

/**
 * Rush / Repeat / Modified banners (audit item 8) — matches legacy's real presentation
 * exactly: plain bold colored text rows in the header-left column (`Modified on :`/`Rush
 * Order :` in red, `Repeat Order` in green), not colored "pill" badges. The "Modified"
 * banner reads `orders.last_modified_at`, stamped by PHASE_10_TASKS.md Workstream E
 * Group 6.2's status-transition action (`setOrderStatus`) — `lastModifiedAt` alone, not
 * `status === "Modified"`, since `reassignOrderRetailer`/`editOrderItems` also stamp it on
 * any real edit, and a re-generated PDF should always show the true last-touched date
 * regardless of which specific status the order currently holds.
 *
 * Old Order # and Group Order # are deliberately NOT repeated here — `renderPageHeader`'s
 * own `left`/`middle` columns already show both exactly once (legacy shows each exactly
 * once too — a prior version of this function duplicated them a second time as banners,
 * which legacy never does). Class names (`badge-rush`/`badge-repeat`/`banner-modified`)
 * kept as-is even though the visual is now plain text, not a pill — existing callers/tests
 * key off them.
 */
function renderBanners(detail: OrderDetail): string {
  const rows: string[] = [];
  if (detail.isRush) rows.push('<div class="badge badge-rush">Rush Order :</div>');
  if (detail.isRepeat) rows.push('<div class="badge badge-repeat">Repeat Order</div>');
  if (detail.lastModifiedAt) {
    rows.push(
      `<div class="banner banner-modified">Modified on : ${escapeHtml(new Date(detail.lastModifiedAt).toLocaleDateString())}</div>`
    );
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
  /** The real component's own product — distinct from `superProductName` (audit item: "1 Suit" alone didn't say *which* of the Suit's components this particular page was for). */
  productName: string;
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
  const { detail, retailer, customer, oldOrderNumber, groupOrderNumber, orderTypeLabel, qrDataUrl, qrCaption, unit } = params;
  const genderLabel = customer.gender ?? "-";

  const left = `
    <div class="header-left">
      <div class="header-row"><span class="label">Name:</span><span>${escapeHtml(renderCustomerName(customer))}</span></div>
      <div class="header-row"><span class="label">${unit ? "order Date:" : "Date:"}</span><span>${new Date(detail.orderDate).toLocaleDateString()}</span>${
        unit ? "" : `<span class="gender-inline">${escapeHtml(genderLabel)}</span>`
      }</div>
      ${unit ? `<div class="header-row"><span class="label">Quantity</span><span>${unit.unitIndex} OF ${unit.totalUnits}</span></div>` : ""}
      <div class="header-row"><span class="label">Old Order:</span><span>${escapeHtml(oldOrderNumber ?? "None")}</span></div>
      ${renderBanners(detail)}
    </div>`;

  // The unit-level box's own `unit-label` ("1 Jacket") already says which item this page is
  // for — the whole-order `quantity-list` repeated the exact same text for a single-item
  // order (a real, reported redundancy), so it's summary-page-only now, in the footer bar.
  const middle = `
    <div class="header-middle">
      ${unit ? `<div class="gender-label">${escapeHtml(genderLabel)}</div>` : ""}
      <div class="order-info-box${unit ? " order-info-box-unit" : ""}">
        <div class="order-number">${escapeHtml(detail.orderNumber)}</div>
        <div>${escapeHtml(orderTypeLabel)}</div>
        ${groupOrderNumber ? `<div>${escapeHtml(groupOrderNumber)}</div>` : ""}
        ${unit ? `<div class="unit-label">${unit.unitIndex} ${escapeHtml(titleCase(unit.superProductName))} (${escapeHtml(titleCase(unit.productName))})</div>` : ""}
      </div>
    </div>`;

  const right = `
    <div class="header-right">
      <div class="header-qr"><img src="${qrDataUrl}" alt="QR code" /><span>${escapeHtml(qrCaption)}</span></div>
      ${retailer.logo ? `<img class="retailer-logo" src="${escapeHtml(resolveServerImageUrl(retailer.logo))}" alt="${escapeHtml(retailer.name)}" />` : ""}
    </div>`;

  return `<div class="page-header">${left}${middle}${right}</div>`;
}

/**
 * Tier (a) — one summary page, one row per real `order_item_components` row (1-3,
 * whatever the super product actually defines). Deliberately NOT legacy's hardcoded
 * suit/tuxedo `rowspan=2` trick (PHASE_10_TASKS.md Workstream B's disclosed intentional
 * deviation) — every component gets its own row regardless of how many siblings it has.
 */
async function renderSummaryRow(
  component: DetailComponent,
  display: DisplayData,
  unitLabel: string,
  superProductName: string
): Promise<{ html: string; primaryFeatureName: string | null }> {
  const qrDataUrl = await QRCode.toDataURL(component.id, { margin: 1, width: 90 });
  const primary = findInlineTextFeatures(component, display)[0];

  const html = `
    <tr class="summary-row" data-component-id="${escapeHtml(component.id)}">
      <td>${escapeHtml(titleCase(superProductName))}</td>
      <td>${escapeHtml(titleCase(unitLabel))}</td>
      <td class="primary-detail">${escapeHtml(titleCase(primary?.link.textValue ?? "-"))}</td>
      <td class="qr-cell"><img src="${qrDataUrl}" alt="QR code for ${escapeHtml(component.id)}" /><br /><span>${escapeHtml(component.id)}</span></td>
    </tr>`;
  return { html, primaryFeatureName: primary?.feature.name ?? null };
}

async function renderSummaryPage(
  detail: OrderDetail,
  display: DisplayData,
  headerHtml: string,
  quantityFooterHtml: string,
  unitLabelById: Map<string, string>,
  unitSuperProductNameById: Map<string, string>
): Promise<string> {
  const rows = await Promise.all(
    detail.items.flatMap((item) =>
      item.components.map((component) =>
        renderSummaryRow(
          component,
          display,
          unitLabelById.get(component.id) ?? component.slotLabel,
          unitSuperProductNameById.get(component.id) ?? "Item"
        )
      )
    )
  );
  // The column header names itself off whichever real text feature actually supplied the
  // "primary detail" values below it (first row that has one) — generic, not a hardcoded
  // "Fabric" literal, but in practice that's exactly what it resolves to for garments that
  // have one, since it's `findInlineTextFeatures`' alphabetically-first pick.
  const primaryColumnLabel = rows.find((r) => r.primaryFeatureName)?.primaryFeatureName ?? "Detail";
  // `headerHtml` lives inside the table's own `<thead>` (as a full-width row, not a sibling
  // element before the table) specifically so it repeats on every printed page this table
  // naturally overflows onto — a real reported bug: an order with enough line items to spill
  // onto a second page showed that continuation page with no header at all, since a plain
  // preceding `<div>` has no browser-native "repeat across page breaks" behavior the way a
  // `<thead>` row does. Chromium's print engine (`page.pdf()`) repeats `<thead>` content on
  // every page a `<table>` spans, so this needs no manual row-chunking/page-height guessing.
  return `
    <section class="summary-page">
      <table class="summary-table">
        <thead>
          <tr class="summary-page-header-row"><td colspan="4">${headerHtml}</td></tr>
          <tr><th>Product</th><th>Unit</th><th>${escapeHtml(titleCase(primaryColumnLabel))}</th><th>QR</th></tr>
        </thead>
        <tbody>${rows.map((r) => r.html).join("")}</tbody>
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
  const pipingEntry = renderSlotEntries.find((e) => e.feature.renderSlot === "piping");
  const fabricCards = renderFabricLiningPipingCards(textEntries, pipingEntry, display);

  const measurementsPage = `
    <section class="detail-page measurements-page" data-component-id="${escapeHtml(component.id)}">
      ${headerHtml}
      <div class="measurements-layout">
        <div class="measurements-column">
          ${renderMeasurements(component, display)}
        </div>
        <div class="manual-size-column">
          ${renderManualSizeSection(component, product)}
          ${renderMeasurementNoteTable(component, renderSlotEntries, display)}
          ${fabricCards}
        </div>
      </div>
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
      <img src="${escapeHtml(resolveServerImageUrl(component.referenceImage))}" alt="Reference" />
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
      <img class="customer-image" src="${escapeHtml(resolveServerImageUrl(customer.image))}" alt="Customer" />
    </section>`;
}

/**
 * Values below are taken directly from legacy `routes.order.js`'s `createPdf` handler's own
 * inline styles (its module comment/audit references its exact literal `font-size`/`color`/
 * `border` values), not approximated — this is the "same fonts, same font sizes, boxes,
 * tables, colors" fidelity pass. Applied to this file's existing generic, semantic class
 * names (`.detail-card`, `.icon-card`, etc.) rather than reintroducing legacy's own
 * inline-style-per-element/per-product-name-branch approach — the visual result matches,
 * the markup stays maintainable and product-agnostic.
 */
const STYLES = `
  ${PDF_FONT_FACE_CSS}

  /* Real reported bug: table borders rendered inconsistently dark/light across the same page —
     Chromium's print pipeline applies its own "economy" color adjustment to printed output by
     default, which can subtly vary border/text darkness page to page unless told not to. */
  body { font-family: 'Montserrat', 'Noto Sans Thai', sans-serif; font-size: 12px; font-weight: 400; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3, h4, h5, h6 { font-family: inherit; font-weight: 400; margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  th, td { border: 1px solid #000; padding: 3px 5px; text-align: left; font-size: 12px; }
  .empty { color: #999; font-style: italic; }
  .thai { display: block; font-size: 10px; color: #444; }

  .page-header { display: flex; justify-content: space-between; gap: 20px; border: 1px solid #000; padding: 10px 1rem; margin-bottom: 8px; }
  .header-left, .header-middle, .header-right { flex: 1; }
  .header-row { display: flex; gap: 8px; align-items: center; margin-bottom: .5rem; position: relative; }
  .header-row .label { color: #000; }
  .gender-inline { position: absolute; right: 0; text-transform: uppercase; font-size: 12px; }
  .header-middle { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
  .gender-label { font-size: 15px; }
  .order-info-box { border: 1px solid #000; padding: 4px 10px; display: flex; flex-direction: column; align-items: center; font-size: 15px; }
  .order-info-box-unit { font-size: 12px; }
  .order-number { text-decoration: underline; }
  .unit-label { text-transform: capitalize; }
  .header-right { display: flex; gap: 12px; justify-content: flex-end; align-items: flex-start; }
  .header-qr { text-align: center; }
  .header-qr img { width: 80px; height: 80px; object-fit: contain; }
  .header-qr span { display: block; font-size: .6rem; word-break: break-all; max-width: 100px; }
  .retailer-logo { max-height: 80px; max-width: 140px; object-fit: contain; }

  .order-banners { margin-top: 4px; }
  .badge, .banner { display: block; font-size: 15px; font-weight: 600; margin-bottom: .5rem; }
  .badge-rush, .banner-modified { color: #ff0000; }
  .badge-repeat { color: #008000; }

  .summary-page { margin-bottom: 12px; }
  .summary-page-header-row > td { border: none; padding: 0; }
  .summary-table th, .summary-table td { text-align: center; padding: 5px; }
  .summary-table td { font-weight: 600; }
  .summary-table .primary-detail { text-align: left; }
  .qr-cell img { width: 80px; height: 80px; }
  .qr-cell span { font-size: .6rem; font-weight: 400; }
  .quantity-footer-bar { display: flex; justify-content: space-evenly; border: 1px solid #000; padding: 6px; margin-top: 8px; }
  .quantity-line { text-transform: capitalize; font-size: 1rem; }

  .detail-page { page-break-before: always; padding-top: 4px; }

  .measurements-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  /* Fixed column widths (real reported bug: with table-layout: auto's default sizing, a long
     combined "Name [Thai Name]" label squeezed against the narrow value columns overflowed its
     own cell, visibly breaking the row borders next to it). The label column gets the bulk of
     the width and wraps normally; the numeric/checkmark columns stay narrow and fixed. */
  .measurements { table-layout: fixed; }
  .measurements th:first-child, .measurements td:first-child { width: 40%; word-break: break-word; }
  .measurements th:nth-child(2), .measurements td:nth-child(2),
  .measurements th:nth-child(3), .measurements td:nth-child(3),
  .measurements th:nth-child(4), .measurements td:nth-child(4) { width: 16%; }
  .measurements th:last-child, .measurements td:last-child { width: 12%; }
  /* box-shadow, not border-bottom: this table uses border-collapse: collapse, and a red
     border here would sit directly against this cell's own neighbors' plain black borders at
     the exact same shared edge — collapsed-border conflict resolution between differently
     colored borders on adjacent cells is what actually caused the reported "some lines render
     darker/lighter, not symmetric" defect (Chromium's real conflict-resolution behavior when
     collapsing differently-colored borders, not a fixed/predictable choice). box-shadow draws
     entirely outside the table border model, so it can never conflict with a neighbor's border. */
  .measurements th:nth-child(4) { box-shadow: inset 0 -2px 0 0 #ff0000; }
  .measurements td.ttl-value { font-weight: bold; color: #ff0000; }
  .changed-col { text-align: center; }
  .changed-check { color: #1f513a; font-weight: bold; font-size: 14px; }
  .manual-size-image img { width: 100%; max-width: 480px; max-height: 320px; object-fit: contain; }
  .measurement-note-table td { vertical-align: middle; }

  .detail-cards { display: grid; gap: 0; margin: 8px 0; }
  .detail-card { border: 1px solid #000; padding: 5px; text-align: center; }
  .detail-card h5 { font-size: 12px; padding-bottom: 5px; margin-bottom: 2px; border-bottom: 1px solid #000; }

  .styling-icon-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; align-items: stretch; }
  .icon-card { text-align: center; min-width: 110px; max-width: 150px; border: 1px solid #ccc; border-radius: 8px; padding: 6px; }
  .icon-card img { width: 90px; height: 90px; object-fit: contain; display: block; margin: 0 auto; }
  .icon-card h6 { margin: 2px; font-size: 12px; text-transform: capitalize; }
  .icon-card p { margin: 2px; font-size: 12px; text-transform: capitalize; }
  .thai-name { color: #333; }

  .additional-feature-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; align-items: stretch; }
  .additional-card { text-align: center; min-width: 110px; max-width: 150px; border: 1px solid #ccc; border-radius: 8px; padding: 6px; }
  .additional-card img { width: 90px; height: 90px; object-fit: contain; display: block; margin: 0 auto; }
  .additional-card h6 { margin: 2px; font-size: 12px; text-transform: capitalize; }
  .additional-card p { margin: 2px; font-size: 12px; text-transform: capitalize; }

  .monogram-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .monogram-block { border: 1px solid #000; }
  .monogram-block h4 { font-size: 14px; text-align: center; border-bottom: 1px solid #000; padding: 10px 0; }
  .monogram-fields td { padding: 8px 5px; }
  .styling-note-box { border: 1px solid #000; padding: 5px; margin-top: 8px; width: 98%; }
  .styling-note-box h5 { font-size: 12px; text-align: center; }
  .styling-note-box p { text-align: center; padding-top: 5px; margin-top: 10px; border-top: 1px solid #000; }

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
  });
  const summaryPage = await renderSummaryPage(detail, display, summaryHeader, quantitySummaryHtml, unitLabelById, unitSuperProductNameById);

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
        unit: {
          unitIndex: unitIndexById.get(component.id) ?? 0,
          totalUnits,
          superProductName: unitSuperProductNameById.get(component.id) ?? "Item",
          productName: product?.name ?? component.slotLabel,
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
