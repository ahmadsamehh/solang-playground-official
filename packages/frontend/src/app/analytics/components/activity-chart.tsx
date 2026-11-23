"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "./panel";
import { ChartTooltip } from "./chart-tooltip";
import { SERIES, axisLabelStyle, axisProps, gridProps } from "../chart-theme";
import { analyticsKeys, fetchActivity, timeseriesGranularity, type RangeKey } from "../api";
import { bucketToTs, evenlySpaced, formatBucketFull, formatBucketTick, spansYears } from "@/lib/format";

const LINES = [
  { key: "deployments", series: SERIES.DEPLOY },
  { key: "invocations", series: SERIES.INVOKE },
  { key: "compiles", series: SERIES.COMPILE },
] as const;

export function ActivityChart({ range }: { range: RangeKey }) {
  const granularity = timeseriesGranularity(range);
  const { data = [] } = useQuery({
    queryKey: analyticsKeys.activity(range, granularity),
    queryFn: () => fetchActivity(range, granularity),
  });

  // Continuous time axis: x is a timestamp, every bucket present (zeros included).
  const points = useMemo(() => data.map((d) => ({ ...d, ts: bucketToTs(d.bucket) })), [data]);
  const timestamps = useMemo(() => points.map((p) => p.ts), [points]);
  const ticks = useMemo(() => evenlySpaced(timestamps, 8), [timestamps]);
  const withYear = spansYears(timestamps);
  const labels = useMemo(() => new Map(points.map((p) => [p.ts, p.label])), [points]);

  return (
    <Panel title={`Activity Over Time · per ${granularity}`}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            {...axisProps}
            ticks={ticks}
            tickFormatter={(ts: number) => formatBucketTick(ts, granularity, withYear)}
            label={{ value: granularity === "day" ? "Day (UTC)" : "ISO week (UTC)", position: "insideBottom", offset: -12, style: axisLabelStyle }}
          />
          <YAxis
            {...axisProps}
            allowDecimals={false}
            width={44}
            label={{ value: "Events", angle: -90, position: "insideLeft", offset: 12, style: axisLabelStyle }}
          />
          <Tooltip content={<ChartTooltip formatLabel={(ts) => formatBucketFull(Number(ts), granularity, labels.get(Number(ts)))} />} />
          <Legend verticalAlign="top" align="right" iconType="plainline" height={28} wrapperStyle={{ fontSize: 12 }} />
          {LINES.map(({ key, series }) => (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}
