"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Panel } from "./panel";
import { ChartTooltip } from "./chart-tooltip";
import { SERIES } from "../chart-theme";

const COLORS: Record<string, string> = { Deploy: SERIES.DEPLOY.color, Invoke: SERIES.INVOKE.color };

export async function getTransactionDistribution() {
  const { data } = await axios.get("/api/analytics/transaction-distribution");
  return (data || []) as { name: string; value: number }[];
}

export function TransactionDistributionChart() {
  const { data } = useQuery({
    queryKey: ["transaction-distribution"],
    queryFn: getTransactionDistribution,
    initialData: [],
  });

  return (
    <Panel title="Transaction Distribution">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" stroke="none">
            {data?.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] ?? SERIES.COMPILE.color} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </Panel>
  );
}
