"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "./panel";
import { Segmented } from "./segmented";
import { ChartTooltip } from "./chart-tooltip";
import { QueryState } from "./query-state";
import { PRIMARY, axisLabelStyle, axisProps, gridProps, tooltipCursor } from "../chart-theme";
import { allowedGranularities, analyticsKeys, fetchActiveUsers, type RangeKey } from "../api";
import { evenlySpaced, formatBucketFull, formatBucketTick, spansYears, type Granularity } from "@/lib/format";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

export const X_AXIS_LABEL: Record<Granularity, string> = {
  day: "Day (UTC)",
  week: "ISO week (UTC)",
  month: "Month (UTC)",
};

const HEIGHT = 280;

export function GranularityToggle({
  range,
  value,
  onChange,
}: {
  range: RangeKey;
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  const allowed = allowedGranularities(range);
  return (
    <Segmented
      ariaLabel="Granularity"
      value={value}
      onChange={onChange}
      options={OPTIONS.map((o) => ({
        ...o,
        disabled: !allowed.includes(o.value),
        title: allowed.includes(o.value) ? undefined : "Pick a longer date range",
      }))}
    />
  );
}

interface Props {
  range: RangeKey;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

export function ActiveUsersChart({ range, granularity, onGranularityChange }: Props) {
  const query = useQuery({
    queryKey: analyticsKeys.activeUsers(range, granularity),
    queryFn: () => fetchActiveUsers(range, granularity),
    placeholderData: keepPreviousData,
  });
  const data = useMemo(() => query.data ?? [], [query.data]);
  const buckets = useMemo(() => data.map((d) => d.bucket), [data]);
  const withYear = spansYears(buckets);
  const ticks = useMemo(() => evenlySpaced(buckets, 8), [buckets]);
  const labels = useMemo(() => new Map(data.map((d) => [d.bucket, d.label])), [data]);

  return (
    <Panel title="Active Users" actions={<GranularityToggle range={range} value={granularity} onChange={onGranularityChange} />}>
      <QueryState query={query} height={HEIGHT} isEmpty={(rows) => rows.every((r) => r.users === 0)}>
        {() => (
          <ResponsiveContainer width="100%" height={HEIGHT}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="bucket"
                {...axisProps}
                ticks={ticks}
                interval="preserveStartEnd"
                minTickGap={16}
                tickFormatter={(b: string) => formatBucketTick(b, granularity, withYear)}
                label={{ value: X_AXIS_LABEL[granularity], position: "insideBottom", offset: -12, style: axisLabelStyle }}
              />
              <YAxis
                {...axisProps}
                allowDecimals={false}
                width={44}
                label={{ value: "Wallets", angle: -90, position: "insideLeft", offset: 12, style: axisLabelStyle }}
              />
              <Tooltip
                cursor={tooltipCursor}
                content={
                  <ChartTooltip formatLabel={(b) => formatBucketFull(String(b), granularity, labels.get(String(b)))} />
                }
              />
              <Bar dataKey="users" name="Active wallets" fill={PRIMARY} radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </QueryState>
    </Panel>
  );
}
