import { brand, ide, read } from "@/lib/theme-tokens";

/** One colour per activity type, used for KPI icons, chart series, legends and badges. */
export const SERIES = {
  DEPLOY: { label: "Deployments", color: brand.DEFAULT, soft: brand.soft, muted: brand.muted },
  INVOKE: { label: "Invocations", color: read.DEFAULT, soft: read.soft, muted: read.muted },
  COMPILE: { label: "Compiles", color: ide.muted, soft: ide.subtle, muted: "rgb(139 148 158 / 0.15)" },
} as const;

export type SeriesKey = keyof typeof SERIES;

/** Primary single-series colour (e.g. active users). */
export const PRIMARY = brand.DEFAULT;

export const axisProps = {
  stroke: ide.faint,
  tick: { fill: ide.muted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: ide.border },
} as const;

export const gridProps = {
  stroke: "rgb(255 255 255 / 0.06)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export const axisLabelStyle = { fill: ide.faint, fontSize: 11 } as const;

export const tooltipCursor = { fill: "rgb(255 255 255 / 0.04)" } as const;
