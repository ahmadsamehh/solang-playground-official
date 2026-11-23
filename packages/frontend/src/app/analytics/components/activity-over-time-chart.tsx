"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Panel } from "./panel";
import { ChartTooltip } from "./chart-tooltip";
import { SERIES, axisProps, gridProps } from "../chart-theme";

export async function getActivityOverTime() {
  const data = await axios.get("/api/analytics/activity-over-time");
  return (data.data || []) as { date: string; deployments: number; invocations: number; compiles: number }[];
}

const shortDate = (tick: string) => new Date(tick).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ActivityOverTimeChart() {
  const { data } = useQuery({
    queryKey: ["activity-over-time"],
    queryFn: getActivityOverTime,
    initialData: [],
  });
  return (
    <Panel title="Activity Over Time">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} />
          <YAxis {...axisProps} />
          <Tooltip content={<ChartTooltip formatLabel={(l) => shortDate(String(l))} />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="deployments" stroke={SERIES.DEPLOY.color} dot={false} strokeWidth={2} name={SERIES.DEPLOY.label} />
          <Line type="monotone" dataKey="invocations" stroke={SERIES.INVOKE.color} dot={false} strokeWidth={2} name={SERIES.INVOKE.label} />
          <Line type="monotone" dataKey="compiles" stroke={SERIES.COMPILE.color} dot={false} strokeWidth={2} name={SERIES.COMPILE.label} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}
