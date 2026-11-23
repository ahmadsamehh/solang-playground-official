"use client";

import type { ReactNode } from "react";

interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: unknown;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  /** Formats the hovered x value (date / bucket) into a full, unambiguous label. */
  formatLabel?: (label: string | number, payload: ReadonlyArray<TooltipEntry>) => ReactNode;
  /** Extra line under the series values, e.g. a total. */
  footer?: (payload: ReadonlyArray<TooltipEntry>) => ReactNode;
}

const numberFormat = new Intl.NumberFormat("en-US");

/** Tooltip in the Playground panel style; shows exact values per series. */
export function ChartTooltip({ active, payload, label, formatLabel, footer }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[160px] rounded-md border border-ide-border-strong bg-ide-elevated px-3 py-2 text-xs shadow-lg shadow-black/40">
      {label !== undefined && (
        <div className="mb-1.5 font-medium text-ide-text">{formatLabel ? formatLabel(label, payload) : label}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey ?? entry.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ide-muted">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-ide-text">
              {typeof entry.value === "number" ? numberFormat.format(entry.value) : String(entry.value ?? "")}
            </span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1.5 border-t border-ide-border pt-1.5 text-ide-muted">{footer(payload)}</div>}
    </div>
  );
}
