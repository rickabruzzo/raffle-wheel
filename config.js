// The only file you edit. Paste your published Google Sheet link into SHEET_URL.
// The sheet must be shared as "anyone with the link can view" (or Published to web).
export const CONFIG = {
  // e.g. "https://docs.google.com/spreadsheets/d/<your-id>/edit#gid=0"
  // Leave as "./sample.csv" to preview with bundled sample data.
  SHEET_URL: "./sample.csv",

  // Above this many entrants, slices render without text (names become unreadable).
  MAX_LABELS: 40,

  // Slice colors (cycled). Tweak to match your event/brand.
  COLORS: ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#EF9F27", "#639922", "#D4537E"],
};
