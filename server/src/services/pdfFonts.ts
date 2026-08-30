import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts");

/**
 * Self-hosted, base64-embedded `@font-face` block for the order PDF — legacy's real font
 * stack (`Montserrat,sans-serif` everywhere, verified directly in `routes.order.js`'s
 * `createPdf` handler; Thai measurement/monogram labels like "นิ้ว"/"ผ้า"/"ซับใน" need Noto
 * Sans Thai, which legacy loaded the same way — an `App.css` Google Fonts `@import`).
 * Embedded as data URIs rather than a live Google Fonts `@import`/`<link>` because
 * `renderHtmlToPdfBuffer` deliberately uses `waitUntil: "domcontentloaded"` (see its own doc
 * comment — PDF generation shouldn't hang or fail on a slow/unreachable font CDN), which
 * doesn't wait for external stylesheets/fonts to finish loading before `page.pdf()` captures
 * the page. Read and base64-encoded once at module load (small, fixed set of files), not
 * per PDF request.
 */
function loadFontFaceCss(): string {
  const weights: { family: string; weight: number; file: string }[] = [
    { family: "Montserrat", weight: 400, file: "montserrat-400.ttf" },
    { family: "Montserrat", weight: 500, file: "montserrat-500.ttf" },
    { family: "Montserrat", weight: 600, file: "montserrat-600.ttf" },
    { family: "Montserrat", weight: 700, file: "montserrat-700.ttf" },
    { family: "Noto Sans Thai", weight: 400, file: "noto-sans-thai-400.ttf" },
    { family: "Noto Sans Thai", weight: 600, file: "noto-sans-thai-600.ttf" },
  ];

  return weights
    .map(({ family, weight, file }) => {
      const base64 = readFileSync(path.join(FONTS_DIR, file)).toString("base64");
      return `@font-face {
        font-family: '${family}';
        font-style: normal;
        font-weight: ${weight};
        src: url(data:font/ttf;base64,${base64}) format('truetype');
      }`;
    })
    .join("\n");
}

export const PDF_FONT_FACE_CSS = loadFontFaceCss();
