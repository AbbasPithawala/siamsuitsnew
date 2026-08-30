import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { resolveUploadUrl } from "../uploads/uploadsApi";

interface StyleOptionButtonProps {
  selected: boolean;
  label: string;
  secondaryLabel?: string | null;
  image?: string | null;
  onClick: () => void;
}

/**
 * A single selectable style/style-option tile — the MUI rebuild of the
 * legacy `Styles.jsx`/`Options.jsx` image-radio pattern (a hidden radio
 * input + an `<img>`-containing `<label>`), now a real button so it's
 * keyboard/screen-reader accessible without the hidden-input trick.
 *
 * `image` is whatever raw value the backend stores on the style/option row —
 * a real uploaded `/uploads/...` path (`resolveUploadUrl` expands this to
 * the API origin; rendered as-is otherwise, a `<img src="/uploads/...">`
 * resolves against the *page's* origin by default, the Vite dev server in
 * dev, which doesn't have the file — a real reported bug), a client-public-
 * folder path (Shoulder Type/Monogram Position's seeded `/ImagesFabric/...`
 * images), or a bare not-yet-migrated legacy filename — the latter two are
 * left untouched by `resolveUploadUrl`'s own narrow scoping. `onError` still
 * hides a genuinely broken image gracefully instead of showing a broken-
 * image icon.
 */
export function StyleOptionButton({ selected, label, secondaryLabel, image, onClick }: StyleOptionButtonProps) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 0.5,
        p: 1,
        width: 112,
        minHeight: 96,
        borderRadius: "10px",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        backgroundColor: selected ? "rgba(28, 77, 143, 0.08)" : "transparent",
        textAlign: "center",
      }}
    >
      {image ? (
        <Box
          component="img"
          src={resolveUploadUrl(image)}
          alt=""
          sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: "8px" }}
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <Typography variant="body2" align="center">
        {label}
      </Typography>
      {secondaryLabel ? (
        <Typography variant="caption" color="text.secondary" align="center">
          {secondaryLabel}
        </Typography>
      ) : null}
    </ButtonBase>
  );
}
