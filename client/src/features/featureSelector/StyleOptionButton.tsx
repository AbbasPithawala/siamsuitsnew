import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";

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
 * `image` is whatever raw value the backend stores on the style/option row
 * (currently just a bare filename — `siam/server` has no image storage/CDN
 * mechanism yet, a known gap noted in REWRITE_ARCHITECTURE.md). Rather than
 * inventing an unconfirmed base-URL convention, this renders it as-is and
 * relies on `onError` to hide a broken image gracefully instead of showing
 * a broken-image icon.
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
          src={image}
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
