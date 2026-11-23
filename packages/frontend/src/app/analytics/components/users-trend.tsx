"use client";

import { formatWeekLabel, formatWeekRange } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Panel } from "./panel";
import { ChartTooltip } from "./chart-tooltip";
import { SERIES, axisProps, gridProps } from "../chart-theme";

export async function getActivityOverTime() {
  const data = await axios.get("/api/analytics/unique-users-per-day");
  return (data.data || []) as { date: string; users: number }[];
}

export function UserTrendChart() {
  const { data } = useQuery({
    queryKey: ["unique-users-per-day"],
    queryFn: getActivityOverTime,
    initialData: [],
  });

  return (
    <Panel title="Weekly Unique Users">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={formatWeekLabel} />
          <YAxis {...axisProps} />
          <Tooltip content={<ChartTooltip formatLabel={(l) => formatWeekRange(String(l))} />} />
          <Line type="monotone" dataKey="users" stroke={SERIES.INVOKE.color} dot={false} strokeWidth={2} name="Unique Users" />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}
