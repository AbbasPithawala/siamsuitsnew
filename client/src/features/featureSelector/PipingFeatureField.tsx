import Box from "@mui/material/Box";
import type { ProductFeature } from "./featuresApi";
import { StyleOptionButton } from "./StyleOptionButton";

interface PipingFeatureFieldProps {
  feature: ProductFeature;
  styleId: string | undefined;
  onSelect: (styleId: string) => void;
}

/**
 * Legacy never modeled Piping as a `Feature`/`Style` pair — it was its own Mongo collection,
 * rendered as an always-visible swatch grid (`colored-style-boX`, verified in
 * `MissingFabric.jsx` — the exact same CSS class Monogram Color uses), never a tab in the
 * `Styles`/`AdditionalStyles` picker. This renders that same "always visible, not a tab" idea
 * with `StyleOptionButton` (the same real, already-proven tile `ChoiceFeatureField` uses for
 * every no-sub-option style elsewhere) rather than porting legacy's hidden-native-radio +
 * `<label>` markup verbatim — that construct, ported as-is, caused a real hang under
 * `StylingAccordion`'s live test (multiple simultaneous mounts sharing `useId`-scoped radio
 * groups); `StyleOptionButton` has none of that native-radio-grouping machinery and is already
 * exercised the same way (many simultaneous instances) elsewhere without issue.
 */
export function PipingFeatureField({ feature, styleId, onSelect }: PipingFeatureFieldProps) {
  const styles = feature.styles ?? [];

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, maxHeight: 400, overflowY: "auto", p: 0.5 }}>
      {styles.map((style) => (
        <StyleOptionButton
          key={style.id}
          selected={style.id === styleId}
          label={style.name}
          image={style.image}
          onClick={() => onSelect(style.id)}
        />
      ))}
    </Box>
  );
}
