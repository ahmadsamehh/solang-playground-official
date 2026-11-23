"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "./panel";
import { Segmented } from "./segmented";
import { ChartTooltip } from "./chart-tooltip";
import { PRIMARY, axisLabelStyle, axisProps, gridProps, tooltipCursor } from "../chart-theme";
import { allowedGranularities, analyticsKeys, fetchActiveUsers, type RangeKey } from "../api";
import { evenlySpaced, formatBucketFull, formatBucketTick, spansYears, type Granularity } from "@/lib/format";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const X_LABEL: Record<Granularity, string> = { day: "Day (UTC)", week: "ISO week (UTC)", month: "Month (UTC)" };

export function ActiveUsersChart({ range }: { range: RangeKey }) {
  const allowed = allowedGranularities(range);
  const [granularity, setGranularity] = useState<Granularity>(allowed.includes("week") ? "week" : "day");

  // Fall back when the range shrinks below what the current granularity can show.
  useEffect(() => {
    if (!allowed.includes(granularity)) setGranularity(allowed[allowed.length - 1]);
  }, [allowed, granularity]);

  const { data = [] } = useQuery({
    queryKey: analyticsKeys.activeUsers(range, granularity),
    queryFn: () => fetchActiveUsers(range, granularity),
  });

  const buckets = useMemo(() => data.map((d) => d.bucket), [data]);
  const withYear = spansYears(buckets);
  const ticks = useMemo(() => evenlySpaced(buckets, 8), [buckets]);
  const labels = useMemo(() => new Map(data.map((d) => [d.bucket, d.label])), [data]);

  return (
    <Panel
      title="Active Users"
      actions={
        <Segmented
          ariaLabel="Active users granularity"
          value={granularity}
          onChange={setGranularity}
          options={OPTIONS.map((o) => ({
            ...o,
            disabled: !allowed.includes(o.value),
            title: allowed.includes(o.value) ? undefined : "Pick a longer date range",
          }))}
        />
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="bucket"
            {...axisProps}
            ticks={ticks}
            interval={0}
            tickFormatter={(b: string) => formatBucketTick(b, granularity, withYear)}
            label={{ value: X_LABEL[granularity], position: "insideBottom", offset: -12, style: axisLabelStyle }}
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
    </Panel>
  );
}
