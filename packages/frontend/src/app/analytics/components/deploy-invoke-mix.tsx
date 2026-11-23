"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "./panel";
import { ChartTooltip } from "./chart-tooltip";
import { QueryState } from "./query-state";
import { SERIES, axisLabelStyle, axisProps, gridProps, tooltipCursor } from "../chart-theme";
import { analyticsKeys, fetchActivity, type RangeKey } from "../api";
import { evenlySpaced, formatBucketFull, formatBucketTick, formatNumber, spansYears } from "@/lib/format";

/** Weekly stacked deploys vs invokes, with the overall ratio for the range. */
export function DeployInvokeMix({ range }: { range: RangeKey }) {
  const query = useQuery({
    queryKey: analyticsKeys.activity(range, "week"),
    queryFn: () => fetchActivity(range, "week"),
    placeholderData: keepPreviousData,
  });
  const data = useMemo(() => query.data ?? [], [query.data]);

  const totals = useMemo(
    () => data.reduce((acc, d) => ({ deploys: acc.deploys + d.deployments, invokes: acc.invokes + d.invocations }), { deploys: 0, invokes: 0 }),
    [data],
  );
  const buckets = useMemo(() => data.map((d) => d.bucket), [data]);
  const ticks = useMemo(() => evenlySpaced(buckets, 6), [buckets]);
  const withYear = spansYears(buckets);
  const labels = useMemo(() => new Map(data.map((d) => [d.bucket, d.label])), [data]);
  const ratio = totals.deploys > 0 ? (totals.invokes / totals.deploys).toFixed(1) : "—";

  return (
    <Panel
      title="Deploys vs Invokes · weekly"
      actions={
        <span className="text-xs text-ide-muted" title={`${formatNumber(totals.deploys)} deploys, ${formatNumber(totals.invokes)} invokes`}>
          Deploy : Invoke <span className="font-medium tabular-nums text-ide-text">1 : {ratio}</span>
        </span>
      }
    >
      <QueryState
        query={query}
        height={300}
        isEmpty={(rows) => rows.every((r) => r.deployments + r.invocations + ("compiles" in r ? r.compiles : 0) === 0)}
      >
        {() => (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="bucket"
            {...axisProps}
            ticks={ticks}
            interval="preserveStartEnd"
                minTickGap={16}
            tickFormatter={(b: string) => formatBucketTick(b, "week", withYear)}
            label={{ value: "ISO week (UTC)", position: "insideBottom", offset: -12, style: axisLabelStyle }}
          />
          <YAxis {...axisProps} allowDecimals={false} width={44} />
          <Tooltip
            cursor={tooltipCursor}
            content={
              <ChartTooltip
                formatLabel={(b) => formatBucketFull(String(b), "week", labels.get(String(b)))}
                footer={(payload) => `Total ${formatNumber(payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0))}`}
              />
            }
          />
          <Legend verticalAlign="top" align="right" iconType="square" height={28} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="deployments" name={SERIES.DEPLOY.label} stackId="tx" fill={SERIES.DEPLOY.color} maxBarSize={36} />
          <Bar dataKey="invocations" name={SERIES.INVOKE.label} stackId="tx" fill={SERIES.INVOKE.color} radius={[3, 3, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
        )}
      </QueryState>
    </Panel>
  );
}
