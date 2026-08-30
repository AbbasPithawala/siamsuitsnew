import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import type { FeatureStyle, FeatureStyleOption, FeatureValue, ProductFeature } from "./featuresApi";
import { StyleOptionButton } from "./StyleOptionButton";
import { resolveUploadUrl } from "../uploads/uploadsApi";

interface ChoiceFeatureFieldProps {
  feature: ProductFeature;
  styleId?: string | undefined;
  styleOptionId?: string | undefined;
  onSelect: (patch: Pick<FeatureValue, "styleId" | "styleOptionId">) => void;
}

/**
 * Renders one `type: "choice"` feature's style list — the generic replacement for legacy's
 * per-garment `Styles.jsx` + `Options.jsx` pair. Ported verbatim from legacy's own real,
 * per-style branch (`Styles.jsx` lines ~220-296), not a feature-level choice: EACH style
 * independently renders as either a plain image card (`style.options.length === 0`, e.g.
 * "Back Pocket" with no sub-choices) or a compact radio row that expands its own sub-option
 * picker inline directly beneath it once selected (`style.options.length > 0`, e.g. "Notch
 * Lapel" with "2.5 inches"/"3 inches" sub-options) — legacy's real `Options.jsx` component,
 * one instance per qualifying style, not a single shared "selected style's options" section
 * at the bottom of the whole grid. A feature whose styles are ALL sub-option-bearing (like
 * legacy's real "Front Button" tab) ends up rendering as a plain radio list with no cards
 * mixed in at all, purely as a consequence of the real per-style data, matching legacy's own
 * visual exactly without special-casing which feature this is.
 */
export function ChoiceFeatureField({ feature, styleId, styleOptionId, onSelect }: ChoiceFeatureFieldProps) {
  const styles = feature.styles ?? [];

  return (
    <Box className="form-group frontbutton-info" sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
      {styles.map((style) =>
        style.options.length === 0 ? (
          <StyleOptionButton
            key={style.id}
            selected={style.id === styleId}
            label={style.name}
            secondaryLabel={style.thaiName}
            image={style.image}
            onClick={() => onSelect({ styleId: style.id, styleOptionId: undefined })}
          />
        ) : (
          <StyleWithSubOptions
            key={style.id}
            style={style}
            selected={style.id === styleId}
            selectedOptionId={style.id === styleId ? styleOptionId : undefined}
            onSelectStyle={() => onSelect({ styleId: style.id, styleOptionId: undefined })}
            onSelectOption={(optionId) => onSelect({ styleId: style.id, styleOptionId: optionId })}
          />
        )
      )}
    </Box>
  );
}

interface StyleWithSubOptionsProps {
  style: FeatureStyle;
  selected: boolean;
  selectedOptionId: string | undefined;
  onSelectStyle: () => void;
  onSelectOption: (optionId: string) => void;
}

/**
 * Legacy `Options.jsx`'s real shape: a real, visible radio + the style's bare name only (legacy's
 * own `styleHeading` — `<label>{styles['name']}</label>` — never appends the Thai name here,
 * unlike the image-card path's own separate secondary line), not an image card — `Styles.jsx`'s
 * own hidden-radio-plus-image treatment is reserved for styles with no sub-options — and, only
 * while this particular style is the selected one, its sub-option picker rendered directly
 * beneath this same row.
 */
function StyleWithSubOptions({ style, selected, selectedOptionId, onSelectStyle, onSelectOption }: StyleWithSubOptionsProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FormControlLabel
        control={<Radio checked={selected} onChange={onSelectStyle} />}
        label={style.name}
        sx={{ textTransform: "capitalize" }}
      />
      {selected && <SubOptionField style={style} selectedOptionId={selectedOptionId} onSelect={onSelectOption} />}
    </Box>
  );
}

interface SubOptionFieldProps {
  style: FeatureStyle;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}

/**
 * Legacy `Options.jsx`'s real tri-mode logic (PHASE_9_TASKS.md Group 4), ported
 * verbatim rather than re-derived: (1) any option has a real image → an image
 * grid, one tile per option, falling back to the parent style's own image if a
 * given option has none ("Priority: 1) Option image, 2) Main style image as
 * fallback", `Options.jsx`'s own comment); (2) no option has an image, but the
 * parent style itself does → a single shared image plus a `<select>` dropdown of
 * option names; (3) neither the options nor the parent style have any image →
 * a plain text/radio list. Driven purely by presence/absence of `image` on the
 * real data, never by feature/style name.
 */
function SubOptionField({ style, selectedOptionId, onSelect }: SubOptionFieldProps) {
  const options = style.options;
  const anyOptionHasImage = options.some((option) => Boolean(option.image));

  if (anyOptionHasImage) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, pl: 2 }} className="styleOptions">
        {options.map((option) => (
          <div className="styleOptions2 frontbutton-info" key={option.id}>
            <StyleOptionButton
              selected={option.id === selectedOptionId}
              label={option.name}
              image={option.image ?? style.image}
              onClick={() => onSelect(option.id)}
            />
          </div>
        ))}
      </Box>
    );
  }

  if (style.image) {
    return <ImageDropdownSubOptions style={style} options={options} selectedOptionId={selectedOptionId} onSelect={onSelect} />;
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, pl: 2 }} className="styleOptions">
      {options.map((option) => (
        <div className="styleOptions2 frontbutton-info" key={option.id}>
          <StyleOptionButton selected={option.id === selectedOptionId} label={option.name} onClick={() => onSelect(option.id)} />
        </div>
      ))}
    </Box>
  );
}

interface ImageDropdownSubOptionsProps {
  style: FeatureStyle;
  options: FeatureStyleOption[];
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}

function ImageDropdownSubOptions({ style, options, selectedOptionId, onSelect }: ImageDropdownSubOptionsProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, pl: 2 }}>
      <Box
        component="img"
        src={style.image ? resolveUploadUrl(style.image) : undefined}
        alt=""
        sx={{ width: 100, height: 130, objectFit: "cover" }}
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <select
        aria-label={`${style.name} options`}
        value={selectedOptionId ?? ""}
        onChange={(event) => {
          if (event.target.value) onSelect(event.target.value);
        }}
      >
        <option value="" disabled>
          Select an option
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </Box>
  );
}
