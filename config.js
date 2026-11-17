// Tunable knobs. Entries are uploaded as an .ods file in the page itself.
export const CONFIG = {
  // Email domains whose entries are dropped before the wheel (employees / test
  // accounts). Matches the domain exactly OR any subdomain, case-insensitive.
  EXCLUDE_DOMAINS: ["honeycomb.io"],

  // Above this many entrants, slices render without text (names become unreadable).
  MAX_LABELS: 40,

  // Slice colors (cycled). Galaxy edition: deep-space blues and violets with gold,
  // ion-blue and ember accents.
  COLORS: ["#1f2a5c", "#ffd166", "#2a3f8f", "#5cc8ff", "#3b2a6e", "#e0a51f", "#1b4d7a", "#ff5a4e"],

  // Text color per slice, so gold/blue labels stay readable on light slices.
  LABEL_COLORS: ["#ffd166", "#1a1200", "#eef1ff", "#06101f", "#ffd166", "#1a1200", "#eef1ff", "#1a0a08"],
};
