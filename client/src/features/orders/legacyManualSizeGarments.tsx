import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export type LegacyGarmentLayout = "jacket" | "pant" | "shirt" | "vest";

/**
 * Mirrors `editOrderWithManualSize.jsx`'s exact `manualSizeFor === "..."`
 * branching — legacy renders the *same* 4-image jacket diagram set for
 * "jacket", "longtail", and "overcoat" alike (not a bug, just three garments
 * sharing one measurement layout), one dedicated layout for "pant", one for
 * "shirt", one for "vest", and nothing hardcoded for any other product name
 * (suit/tuxedo aren't garments themselves in the new generalized-product
 * model — they're super-products whose jacket/pant *components* each
 * resolve to this same lookup individually). Any product name outside this
 * set has no legacy layout and falls back to `ManualSizeEditor.tsx`'s
 * generic single-diagram-image canvas.
 */
export function resolveLegacyGarmentLayout(productName: string | null | undefined): LegacyGarmentLayout | null {
  const normalized = (productName ?? "").trim().toLowerCase();
  if (normalized === "jacket" || normalized === "longtail" || normalized === "overcoat") return "jacket";
  if (normalized === "pant") return "pant";
  if (normalized === "shirt") return "shirt";
  if (normalized === "vest") return "vest";
  return null;
}

const DIAGRAM_BASE = "/ManualSizeDiagrams";

/**
 * Legacy's fixed-position overlay `<input>`/`<select>` fields
 * (`.manual_input-design`/`.fitting-dropdown` in `order.css`) were never
 * wired to React state — `value`/`onChange` are commented out in the
 * source. They only ever mattered as pixels: whatever the admin typed or
 * picked stayed on-screen and got baked into the `html-to-image` screenshot
 * taken on Save, same as the free-drag labels. Reproduced here the same
 * way — plain uncontrolled DOM elements, not wired to any React state —
 * since nothing downstream reads them as structured data either.
 */
const overlayInputSx = {
  width: 55,
  height: 45,
  bgcolor: "#f1f1f1",
  border: "1px solid #e1e1e1",
  color: "#000",
  fontSize: 16,
  textAlign: "center",
  boxSizing: "border-box",
  fontFamily: "inherit",
} as const;

const overlayDropdownSx = {
  width: 100,
  ml: "5px",
  bgcolor: "#f1f1f1",
  height: 29,
  border: "1px solid #e1e1e1",
  borderRadius: "2px",
  p: "4px",
  fontFamily: "inherit",
} as const;

const fieldLabelSx = { fontSize: 18, fontWeight: 500, whiteSpace: "nowrap" } as const;

function GarmentCard({
  image,
  alt,
  width = 220,
  height = 350,
  children,
}: {
  image: string;
  alt: string;
  width?: number;
  height?: number;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ position: "relative", width, flexShrink: 0 }}>
      <Box component="img" src={image} alt={alt} sx={{ width: "100%", height, objectFit: "contain", display: "block" }} />
      {children}
    </Box>
  );
}

/**
 * Legacy's `.capture-image{width:1250px; padding:60px 220px}` — a wide
 * canvas whose padding exists specifically to give the far-flung overlay
 * fields (e.g. the "ช่าง" tailor dropdown at `right:-200px` off the 4th
 * card) room to render without clipping. Reproduced here as generous
 * padding around a `width:"fit-content"` flex row rather than matching
 * legacy's exact 1250px/Bootstrap-style column math, which doesn't
 * translate 1:1 into this codebase's MUI flex layout — the fields keep
 * legacy's exact offsets *relative to their own image*, just inside a
 * container sized to comfortably contain them instead of legacy's precise
 * padding numbers.
 */
export function JacketGarmentLayout() {
  return (
    <Box sx={{ display: "flex", flexWrap: "nowrap", gap: "40px", pl: "140px", pr: "260px", pt: "120px", pb: "100px", width: "fit-content" }}>
      <GarmentCard image={`${DIAGRAM_BASE}/JACKET.png`} alt="Jacket front">
        <Stack sx={{ position: "absolute", top: 100, left: -99 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 500 }}>อก =</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 500 }}>เอา =</Typography>
        </Stack>
        <Box component="input" placeholder="type" sx={{ ...overlayInputSx, position: "absolute", top: 0, left: -55 }} />
        <Box component="input" name="input_two" placeholder="type" sx={{ ...overlayInputSx, position: "absolute", top: 50, right: -44 }} />
      </GarmentCard>

      <GarmentCard image={`${DIAGRAM_BASE}/JACKET-1.png`} alt="Jacket lining">
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ position: "absolute", bottom: -60, right: -60 }}>
          <Typography sx={fieldLabelSx}>อัดชั้น :</Typography>
          <Box component="select" name="dropdown_bottom" defaultValue="" sx={overlayDropdownSx}>
            <option value="">-Select-</option>
            <option value="ชีฟอง">ชีฟอง</option>
            <option value="หนังไก่">หนังไก่</option>
          </Box>
        </Stack>
      </GarmentCard>

      <GarmentCard image={`${DIAGRAM_BASE}/JACKET-2.png`} alt="Jacket back" width={140} />

      <GarmentCard image={`${DIAGRAM_BASE}/JACKET-3.png`} alt="Jacket detail">
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ position: "absolute", top: -47, right: -72 }}>
          <Typography sx={fieldLabelSx}>หนุนไหล่ :</Typography>
          <Box component="select" name="dropdown_top" defaultValue="" sx={overlayDropdownSx}>
            <option value="">-Select-</option>
            <option value="บางมาก">บางมาก</option>
            <option value="กลาง">กลาง</option>
            <option value="เต็ม">เต็ม</option>
            <option value="ไม่ใส่">ไม่ใส่</option>
          </Box>
        </Stack>
        <Box component="input" name="input_three" placeholder="type" sx={{ ...overlayInputSx, position: "absolute", top: 57, right: -34 }} />
        <Box component="input" name="input_four" placeholder="type" sx={{ ...overlayInputSx, position: "absolute", bottom: -24, left: -65 }} />
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ position: "absolute", top: 140, right: -200 }}>
          <Typography sx={fieldLabelSx}>ช่าง :</Typography>
          <Box component="select" name="dropdown_three" defaultValue="" sx={overlayDropdownSx}>
            <option value="">-Select-</option>
            <option value="ลุง">ลุง</option>
            <option value="ควร">ควร</option>
            <option value="pattern + ควร">pattern + ควร</option>
          </Box>
        </Stack>
      </GarmentCard>
    </Box>
  );
}

/** Legacy's `pant` block: one image, one fixed `.manualinput` (base offsets — not inside `.capture-image`, so none of that selector's override applies here, unlike the jacket 4th card's `input_four`). */
export function PantGarmentLayout() {
  return (
    <Box sx={{ p: "100px 140px", width: "fit-content", mx: "auto" }}>
      <GarmentCard image={`${DIAGRAM_BASE}/PANT.png`} alt="Pant" width={360}>
        <Box component="input" name="input_one" placeholder="type" sx={{ ...overlayInputSx, position: "absolute", bottom: 80, left: -65 }} />
      </GarmentCard>
    </Box>
  );
}

/** Legacy's `shirt` block: two images side by side (`.shirt-fiitting-img`), no overlay fields at all — free-drag labels only. */
export function ShirtGarmentLayout() {
  return (
    <Box sx={{ display: "flex", gap: 2, p: "60px", width: "fit-content", mx: "auto" }}>
      <Box component="img" src={`${DIAGRAM_BASE}/SHIRT.png`} alt="Shirt front" sx={{ width: 220, height: 350, objectFit: "contain" }} />
      <Box component="img" src={`${DIAGRAM_BASE}/SHIRT-1.png`} alt="Shirt back" sx={{ width: 320, height: 350, objectFit: "contain" }} />
    </Box>
  );
}

/** Legacy's `vest` block: single image, no overlay fields — free-drag labels only. */
export function VestGarmentLayout() {
  return (
    <Box sx={{ p: "60px", width: "fit-content", mx: "auto" }}>
      <Box component="img" src={`${DIAGRAM_BASE}/VEST.png`} alt="Vest" sx={{ width: 500, height: 220, objectFit: "contain" }} />
    </Box>
  );
}
