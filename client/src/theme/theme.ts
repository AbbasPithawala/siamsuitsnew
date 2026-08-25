/**
 * MUI v5 theme for the Siam Suits rewrite.
 *
 * Per REWRITE_ARCHITECTURE.md §3 ("Visual design is carried over from
 * `siamClient`, not redesigned"), the values below are pulled from the
 * legacy app's actual CSS rather than invented. Source files (all under
 * `siamClient/src/`):
 *
 *  - App.css                                        — brand blue #1c4d8f, hover/dark
 *                                                      shade #025 (`.custom-btn`,
 *                                                      `.outline-back-btn`, `.next-button`,
 *                                                      `.b-btn:hover`), body background
 *                                                      #F3F8FF, Montserrat font import,
 *                                                      button border-radius (~7px), card
 *                                                      shadow `rgba(0,0,0,.08) 0 6px 20px`.
 *  - index.css                                       — fallback system font stack (loses
 *                                                      to App.css's Montserrat import,
 *                                                      which is applied later in the
 *                                                      component tree, but recorded here
 *                                                      as the fallback).
 *  - components/login/login.css                      — `.custom-btn-nav` uses the same
 *                                                      #025 dark-blue accent; rounded
 *                                                      form card (30px radius on desktop).
 *  - components/superAdmin/header/header.css and
 *    components/retailerAdmin/RetailerHeader/RetailerHeader.css
 *                                                      — header/app-bar background #f3f8ff,
 *                                                      icon/text color #242424, logout
 *                                                      button #1c4d8f -> #025 on hover.
 *  - components/superAdmin/sidebar/sidebar.css        — nav text color #363636, active/hover
 *                                                      state color #1c4d8f, pill/rounded nav
 *                                                      item radii.
 *  - components/superAdmin/pages/dashboard/dashboard.css and
 *    .../superAdmin/pages/order/order.css              — content-card radius 10px + the same
 *                                                      `rgba(0,0,0,.08) 0 6px 20px` shadow,
 *                                                      #1c4d8f used for emphasis text/badges,
 *                                                      #025 used for outlined badges
 *                                                      (`.orderlist-new`), literal `red` for
 *                                                      error/delete affordances.
 *
 * Phase 5 component work should keep using this file as the palette/typography
 * source of truth, but still open the specific legacy component + its .css file
 * for layout/markup details this theme doesn't (and shouldn't) capture.
 */
import { createTheme } from "@mui/material/styles";

const brandBlue = "#1c4d8f";
const brandBlueDark = "#002255"; // legacy shorthand `#025`
const brandBlueLight = "#1851a7"; // legacy `.link-btn` accent, between main and dark

export const theme = createTheme({
  palette: {
    primary: {
      main: brandBlue,
      dark: brandBlueDark,
      light: brandBlueLight,
      contrastText: "#ffffff",
    },
    error: {
      main: "#ff0000", // legacy uses literal `red` throughout for error/delete states
    },
    background: {
      default: "#F3F8FF", // legacy body / header background
      paper: "#ffffff",
    },
    text: {
      primary: "#363636", // legacy sidebar/table body text color
    },
  },
  typography: {
    fontFamily: '"Montserrat", "Noto Sans Thai", "Helvetica Neue", Arial, sans-serif',
    fontWeightMedium: 600,
  },
  shape: {
    borderRadius: 7, // legacy `.custom-btn` / `.next-button` radius
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 7,
          padding: "10px 24px",
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: brandBlueDark,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#f3f8ff",
          color: "#242424",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 10, // legacy `.content-wrapper` / dashboard card radius
        },
      },
    },
  },
});

export default theme;
