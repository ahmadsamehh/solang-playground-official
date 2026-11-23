"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "./panel";
import { ChartTooltip } from "./chart-tooltip";
import { QueryState } from "./query-state";
import { GranularityToggle, X_AXIS_LABEL } from "./active-users-chart";
import { PRIMARY, SECONDARY, axisLabelStyle, axisProps, gridProps, tooltipCursor } from "../chart-theme";
import { analyticsKeys, fetchNewVsReturning, type RangeKey } from "../api";
import { evenlySpaced, formatBucketFull, formatBucketTick, formatNumber, spansYears, type Granularity } from "@/lib/format";

const HEIGHT = 280;

interface Props {
  range: RangeKey;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

export function NewVsReturning({ range, granularity, onGranularityChange }: Props) {
  const query = useQuery({
    queryKey: analyticsKeys.newVsReturning(range, granularity),
    queryFn: () => fetchNewVsReturning(range, granularity),
    placeholderData: keepPreviousData,
  });
  const data = useMemo(() => query.data ?? [], [query.data]);
  const buckets = useMemo(() => data.map((d) => d.bucket), [data]);
  const ticks = useMemo(() => evenlySpaced(buckets, 8), [buckets]);
  const withYear = spansYears(buckets);
  const labels = useMemo(() => new Map(data.map((d) => [d.bucket, d.label])), [data]);

  return (
    <Panel
      title="New vs Returning"
      actions={<GranularityToggle range={range} value={granularity} onChange={onGranularityChange} />}
    >
      <QueryState query={query} height={HEIGHT} isEmpty={(rows) => rows.every((r) => r.newUsers + r.returningUsers === 0)}>
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
                  <ChartTooltip
                    formatLabel={(b) => formatBucketFull(String(b), granularity, labels.get(String(b)))}
                    footer={(payload) =>
                      `Active ${formatNumber(payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0))}`
                    }
                  />
                }
              />
              <Legend verticalAlign="top" align="right" iconType="square" height={28} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="newUsers" name="New wallets" stackId="users" fill={PRIMARY} maxBarSize={48} />
              <Bar dataKey="returningUsers" name="Returning wallets" stackId="users" fill={SECONDARY} radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </QueryState>
    </Panel>
  );
}
