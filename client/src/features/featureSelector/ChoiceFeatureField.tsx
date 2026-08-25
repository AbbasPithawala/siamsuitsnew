import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { FeatureStyle, FeatureStyleOption, FeatureValue, ProductFeature } from "./featuresApi";
import { StyleOptionButton } from "./StyleOptionButton";

interface ChoiceFeatureFieldProps {
  feature: ProductFeature;
  styleId?: string | undefined;
  styleOptionId?: string | undefined;
  onSelect: (patch: Pick<FeatureValue, "styleId" | "styleOptionId">) => void;
}

/**
 * Renders one `type: "choice"` feature: a grid of its styles, and — once a
 * style with `style_options` is picked — a nested sub-option tier. This is
 * the generic replacement for the legacy's per-garment `Styles.jsx` +
 * `Options.jsx` pair; the same component renders "collar" (which has
 * style_options) and "back pocket" (which doesn't) identically, driven only
 * by whether the selected style's `options` array is empty.
 */
export function ChoiceFeatureField({ feature, styleId, styleOptionId, onSelect }: ChoiceFeatureFieldProps) {
  const styles = feature.styles ?? [];
  const selectedStyle = styles.find((style) => style.id === styleId);

  return (
    <Box className="form-group frontbutton-info">
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {styles.map((style) => (
          <StyleOptionButton
            key={style.id}
            selected={style.id === styleId}
            label={style.name}
            secondaryLabel={style.thaiName}
            image={style.image}
            onClick={() => onSelect({ styleId: style.id, styleOptionId: undefined })}
          />
        ))}
      </Box>
      {selectedStyle && selectedStyle.options.length > 0 && (
        <Box sx={{ mt: 2, pl: 2, borderLeft: "3px solid", borderColor: "primary.light" }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {selectedStyle.name} options
          </Typography>
          <SubOptionField
            style={selectedStyle}
            selectedOptionId={styleOptionId}
            onSelect={(optionId) => onSelect({ styleId: selectedStyle.id, styleOptionId: optionId })}
          />
        </Box>
      )}
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }} className="styleOptions">
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
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }} className="styleOptions">
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
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <Box
        component="img"
        src={style.image ?? undefined}
        alt=""
        sx={{ width: 100, height: 130, objectFit: "cover" }}
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <select
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
