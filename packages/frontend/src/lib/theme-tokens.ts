/**
 * Single source of truth for the Playground palette.
 * Consumed by tailwind.config.ts (utility classes) and by JS that needs literal
 * colours, such as Recharts series.
 */

// IDE surface layers (dark, GitHub-style slate)
export const ide = {
  bg: "#0D1117",
  panel: "#161B22",
  elevated: "#1C2128",
  hover: "#21262D",
  border: "rgb(255 255 255 / 0.08)",
  "border-strong": "rgb(255 255 255 / 0.14)",
  text: "#E6EDF3",
  subtle: "#C9D1D9",
  muted: "#8B949E",
  faint: "#6E7681",
} as const;

// Electric indigo primary accent
export const brand = {
  DEFAULT: "#6366F1",
  hover: "#4F46E5",
  soft: "#818CF8",
  muted: "rgb(99 102 241 / 0.15)",
} as const;

// Read-only / simulate calls (also the Invoke colour)
export const read = {
  DEFAULT: "#06B6D4",
  hover: "#0891B2",
  soft: "#22D3EE",
  muted: "rgb(6 182 212 / 0.12)",
} as const;
