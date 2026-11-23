"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatNumber } from "@/lib/format";
import { Panel } from "./panel";
import { QueryState } from "./query-state";
import { PRIMARY, withAlpha } from "../chart-theme";
import { analyticsKeys, fetchHeatmap, type RangeKey } from "../api";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HEIGHT = 260;
const pad = (h: number) => String(h).padStart(2, "0");

function useViewerTimeZone() {
  return useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);
}

/** Activity by day of week × hour of day in the viewer's local time zone. */
export function ActivityHeatmap({ range }: { range: RangeKey }) {
  const tz = useViewerTimeZone();
  const query = useQuery({ queryKey: analyticsKeys.heatmap(range, tz), queryFn: () => fetchHeatmap(range, tz) });
  const [hovered, setHovered] = useState<{ dow: number; hour: number; count: number } | null>(null);

  return (
    <Panel
      title="When People Build"
      actions={<span className="text-[11px] text-ide-faint">{query.data?.timezone ?? tz} time</span>}
    >
      <QueryState query={query} height={HEIGHT} isEmpty={(d) => d.cells.every((c) => c.count === 0)}>
        {(data) => {
          const max = Math.max(...data.cells.map((c) => c.count), 1);
          const grid = new Map(data.cells.map((c) => [`${c.dow}:${c.hour}`, c]));
          return (
            <div style={{ minHeight: HEIGHT }}>
              <div className="overflow-x-auto">
                <div className="grid min-w-[520px] grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[3px]" onMouseLeave={() => setHovered(null)}>
                  {DAYS.map((day, d) => (
                    <div key={day} className="contents">
                      <div className="flex items-center text-[10px] text-ide-muted">{day}</div>
                      {HOURS.map((hour) => {
                        const cell = grid.get(`${d + 1}:${hour}`) ?? { dow: d + 1, hour, count: 0 };
                        const intensity = cell.count / max;
                        return (
                          <div
                            key={hour}
                            onMouseEnter={() => setHovered(cell)}
                            title={`${DAY_NAMES[d]} ${pad(hour)}:00–${pad(hour)}:59 · ${formatNumber(cell.count)} events`}
                            className="aspect-square rounded-[3px] ring-inset ring-ide-border-strong hover:ring-1"
                            style={{
                              backgroundColor: cell.count === 0 ? "rgb(255 255 255 / 0.03)" : withAlpha(PRIMARY, 0.15 + 0.85 * intensity),
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                  <div />
                  {HOURS.map((hour) => (
                    <div key={hour} className="text-center text-[9px] tabular-nums text-ide-faint">
                      {hour % 3 === 0 ? pad(hour) : ""}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ide-muted">
                <span aria-live="polite">
                  {hovered
                    ? `${DAY_NAMES[hovered.dow - 1]}, ${pad(hovered.hour)}:00–${pad(hovered.hour)}:59 · ${formatNumber(hovered.count)} events`
                    : "Compiles, deploys and invocations by local hour"}
                </span>
                <span className="flex items-center gap-1.5">
                  Less
                  {[0.15, 0.4, 0.65, 1].map((a) => (
                    <span key={a} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: withAlpha(PRIMARY, a) }} />
                  ))}
                  More
                </span>
              </div>
            </div>
          );
        }}
      </QueryState>
    </Panel>
  );
}
