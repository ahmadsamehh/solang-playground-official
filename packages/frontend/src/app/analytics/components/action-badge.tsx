import { SERIES, type SeriesKey } from "../chart-theme";

/** Deploy / Invoke badge in the activity's series colour. */
export function ActionBadge({ action }: { action: string }) {
  const series = SERIES[action as SeriesKey] ?? SERIES.COMPILE;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: series.muted, color: series.soft }}
    >
      {action === "DEPLOY" ? "Deploy" : action === "INVOKE" ? "Invoke" : action}
    </span>
  );
}
