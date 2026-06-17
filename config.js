// Tunable knobs. Entries are uploaded as an .ods file in the page itself.
export const CONFIG = {
  // Email domains whose entries are dropped before the wheel (employees / test
  // accounts). Matches the domain exactly OR any subdomain, case-insensitive.
  EXCLUDE_DOMAINS: ["honeycomb.io"],

  // Above this many entrants, slices render without text (names become unreadable).
  MAX_LABELS: 40,

  // Slice colors (cycled). Tweak to match your event/brand.
  COLORS: ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#EF9F27", "#639922", "#D4537E"],
};
