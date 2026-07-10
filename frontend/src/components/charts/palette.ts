/**
 * Chart palette — reference instance from the dataviz skill (references/palette.md),
 * light mode only (this app has no dark-mode toggle anywhere else, so charts match).
 * Validated: node scripts/validate_palette.js on the categorical set — all checks pass
 * (3 slots sub-3:1 contrast, mitigated by always pairing color with a direct label,
 * per the palette's own relief rule).
 */

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export type StatusRole = keyof typeof STATUS_COLORS;

export const SEQUENTIAL_BLUE = {
  track: "#cde2fb", // step 100 — lightest, "near zero" / unfilled track
  fill: "#2a78d6", // step 450 — default sequential hue
} as const;

export const CHART_INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
  surface: "#fcfcfb",
} as const;

/** Loan status -> severity role. Not a generic categorical mapping — this genuinely
 * encodes portfolio health, which is what the status palette is for. */
export const LOAN_STATUS_ROLE: Record<string, StatusRole> = {
  ACTIVE: "good",
  CLOSED: "good",
  PENDING: "warning",
  OVERDUE: "warning",
  NPA: "critical",
  WRITTEN_OFF: "critical",
};

export const COLLECTION_STATUS_ROLE: Record<string, StatusRole> = {
  OPEN: "warning",
  FOLLOW_UP: "warning",
  PROMISE_TO_PAY: "warning",
  CLOSED: "good",
};
