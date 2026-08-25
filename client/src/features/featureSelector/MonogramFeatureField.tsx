import { useId } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { FeatureStyle } from "./featuresApi";

/**
 * Monogram's `structured` sub-fields, per REWRITE_ARCHITECTURE.md §"Unified
 * feature model": "Monogram becomes `type: structured` (font/side/color/
 * line-two as a JSON payload)". `text`/`text2` are legacy `MissingFabric.jsx`'s
 * "Tag"/"Tag Optional" inputs. `side` is deliberately absent here — Monogram
 * Position is now its own `render_slot`-based `choice` feature (Decision 4),
 * composed in via the `position` prop below rather than living in this payload.
 */
export interface MonogramStructuredValue {
  text?: string;
  text2?: string;
  font?: string;
  color?: string;
}

/**
 * Legacy `MissingFabric.jsx`'s module-level `fontStyle` array, ported verbatim
 * (own hardcoded frontend constants, not catalog data — see PHASE_9_TASKS.md
 * Group 4). Images copied byte-for-byte from
 * `siamClient/public/ImagesFabric/Monogram-Font-Style/` into `client/public/`.
 */
const FONT_STYLES = [
  { id: 1, image: "/ImagesFabric/Monogram-Font-Style/011.jpg", styleName: "Style-01" },
  { id: 2, image: "/ImagesFabric/Monogram-Font-Style/021.jpg", styleName: "Style-02" },
  { id: 3, image: "/ImagesFabric/Monogram-Font-Style/031.jpg", styleName: "Style-03" },
  { id: 4, image: "/ImagesFabric/Monogram-Font-Style/041.jpg", styleName: "Style-04" },
  { id: 5, image: "/ImagesFabric/Monogram-Font-Style/051.jpg", styleName: "Style-05" },
  { id: 6, image: "/ImagesFabric/Monogram-Font-Style/061.jpg", styleName: "Style-06" },
  { id: 7, image: "/ImagesFabric/Monogram-Font-Style/071.jpg", styleName: "Style-07" },
  { id: 8, image: "/ImagesFabric/Monogram-Font-Style/081.jpg", styleName: "Style-08" },
  { id: 9, image: "/ImagesFabric/Monogram-Font-Style/091.jpg", styleName: "Style-09" },
];

/** Legacy `MissingFabric.jsx`'s module-level `colorData` array, ported verbatim. */
const COLOR_DATA = [
  { id: "1", color: "#CD3534", value: "1102" },
  { id: "2", color: "#B94E9C", value: "1157J" },
  { id: "3", color: "#CBCD2C", value: "1318" },
  { id: "4", color: "#F7DF0D", value: "1309" },
  { id: "5", color: "#0E6835", value: "1466" },
  { id: "6", color: "#AF9E34", value: "1325" },
  { id: "7", color: "#451E5F", value: "1613" },
  { id: "8", color: "#633513", value: "1721" },
  { id: "9", color: "#666867", value: "1875" },
  { id: "10", color: "#262827", value: "1901" },
  { id: "11", color: "#ffffff", value: "1902" },
  { id: "12", color: "#981A1E", value: "6007" },
  { id: "13", color: "#620C0D", value: "6008" },
  { id: "14", color: "#F03C23", value: "6012" },
  { id: "15", color: "#F6E1EA", value: "6023" },
  { id: "16", color: "#E5BAD6", value: "6024" },
  { id: "17", color: "#D9A7CC", value: "6025" },
  { id: "18", color: "#BE70AE", value: "6026" },
  { id: "19", color: "#F6E1EA", value: "6029" },
  { id: "20", color: "#F89A38", value: "6033" },
  { id: "21", color: "#FBCB9A", value: "6036" },
  { id: "22", color: "#2F1111", value: "6073" },
  { id: "23", color: "#DCCA22", value: "6085" },
  { id: "24", color: "#FCFBCF", value: "6087" },
  { id: "25", color: "#666867", value: "6092" },
  { id: "26", color: "#989898", value: "6095" },
  { id: "27", color: "#451E5F", value: "6104" },
  { id: "28", color: "#E3CBE3", value: "6117" },
  { id: "29", color: "#0C1131", value: "6122" },
  { id: "30", color: "#34469A", value: "6128" },
  { id: "31", color: "#1683C6", value: "6134" },
  { id: "32", color: "#7CC7EF", value: "6135" },
  { id: "33", color: "#98D5F4", value: "6136" },
  { id: "34", color: "#A2DEF8", value: "6140" },
  { id: "35", color: "#A9DDE8", value: "6148" },
  { id: "36", color: "#183219", value: "6156" },
  { id: "37", color: "#183219", value: "6157" },
  { id: "38", color: "#4BBE95", value: "6172" },
  { id: "39", color: "#F7EB35", value: "7005" },
  { id: "40", color: "#9960A7", value: "7013" },
  { id: "41", color: "#CDA4CE", value: "7020" },
  { id: "42", color: "#333333", value: "9093" },
];

export interface MonogramPositionProps {
  /** The real "Left Side"/"Right Side" styles of the `render_slot = 'monogram_position'` feature. */
  styles: FeatureStyle[];
  selectedStyleId: string | undefined;
  onSelect: (styleId: string) => void;
}

interface MonogramFeatureFieldProps {
  value: MonogramStructuredValue | undefined;
  onChange: (value: MonogramStructuredValue) => void;
  /**
   * `<FeatureSelector>` composes the separate `render_slot = 'monogram_position'`
   * feature in here (PHASE_9_TASKS.md Decision 4) rather than this component
   * knowing about that feature itself — omitted entirely when the product has
   * no such feature linked (e.g. legacy's real jacket/tuxedojacket/shirt-only list).
   */
  position?: MonogramPositionProps | undefined;
}

/**
 * `type: "structured"` features are deliberately hardcoded here to
 * monogram's known sub-fields (font, color, a second text line) — this is
 * NOT a generic structured-schema renderer. Monogram is currently the only
 * `structured` feature in the catalog and `siam/server` has no mechanism to
 * describe an arbitrary structured shape to the frontend. If a second
 * `structured` feature is ever introduced, this component (and possibly the
 * `features` table itself) needs deliberate revisiting then — don't
 * generalize this file speculatively now.
 */
export function MonogramFeatureField({ value, onChange, position }: MonogramFeatureFieldProps) {
  const current = value ?? {};
  const set = (patch: Partial<MonogramStructuredValue>) => onChange({ ...current, ...patch });
  const positionName = useId();
  const fontName = useId();
  const colorName = useId();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", gap: "15px", alignItems: "flex-start" }}>
        <div className="form-group monogram-info" style={{ flex: 1 }}>
          <TextField
            fullWidth
            label="Tag"
            placeholder="Tag"
            value={current.text ?? ""}
            onChange={(event) => set({ text: event.target.value })}
          />
        </div>
        <div className="form-group monogram-info" style={{ flex: 1 }}>
          <TextField
            fullWidth
            label="Tag Optional"
            placeholder="Tag Optional"
            value={current.text2 ?? ""}
            onChange={(event) => set({ text2: event.target.value })}
          />
        </div>
      </Box>

      {position && position.styles.length > 0 && (
        <div className="form-group monogram-info">
          <p>Monogram Position</p>
          <ul>
            {position.styles.map((style) => {
              const inputId = `${positionName}-${style.id}`;
              return (
                <li key={style.id}>
                  <input
                    type="radio"
                    name={positionName}
                    id={inputId}
                    checked={position.selectedStyleId === style.id}
                    onChange={() => position.onSelect(style.id)}
                  />
                  <label htmlFor={inputId}>
                    <h5>{style.name}</h5>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="form-group monogram-foont-style">
        <p>Monogram Font Style</p>
        <ul>
          {FONT_STYLES.map((fontStyle) => {
            const inputId = `${fontName}-${fontStyle.id}`;
            return (
              <li key={fontStyle.id}>
                <input
                  type="radio"
                  name={fontName}
                  id={inputId}
                  checked={current.font === fontStyle.styleName}
                  onChange={() => set({ font: fontStyle.styleName })}
                />
                <label htmlFor={inputId}>
                  <img src={fontStyle.image} alt="Monogram Font Style" />
                  <p>{fontStyle.styleName}</p>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="form-group colored-style-boX">
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Monogram Color
        </Typography>
        <ul style={{ display: "block", overflowY: "auto", height: "400px" }}>
          {COLOR_DATA.map((data) => {
            const inputId = `${colorName}-${data.id}`;
            return (
              <li key={data.id}>
                <input
                  type="radio"
                  className="radio"
                  name={colorName}
                  id={inputId}
                  style={{ display: "none" }}
                  checked={current.color === data.value}
                  onChange={() => set({ color: data.value })}
                />
                <label htmlFor={inputId}>
                  <div className="colored-boxes" style={{ backgroundColor: data.color }} />
                  <p>{data.value}</p>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Box>
  );
}
