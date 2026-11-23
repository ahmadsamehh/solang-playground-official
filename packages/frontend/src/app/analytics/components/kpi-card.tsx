"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { StatCard } from "./stat-card";
import { Skeleton } from "./query-state";
import type { Kpi, RangeKey } from "../api";

const PREVIOUS_LABEL: Record<RangeKey, string> = { "7d": "prev. 7d", "30d": "prev. 30d", "90d": "prev. 90d", all: "" };

function Delta({ kpi, range, format }: { kpi: Kpi; range: RangeKey; format: (n: number) => string }) {
  if (range === "all") return <span className="text-ide-faint">All time</span>;
  if (kpi.changePct === null) {
    return (
      <span className="text-ide-muted" title={`Previous period: ${format(kpi.previous ?? 0)}`}>
        New · none in {PREVIOUS_LABEL[range]}
      </span>
    );
  }
  const up = kpi.changePct > 0;
  const flat = kpi.changePct === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1" title={`Previous period: ${format(kpi.previous ?? 0)}`}>
      <span className={cn("flex items-center font-medium tabular-nums", flat ? "text-ide-muted" : up ? "text-emerald-400" : "text-red-400")}>
        <Icon size={13} />
        {up ? "+" : ""}
        {kpi.changePct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%
      </span>
      <span className="text-ide-faint">vs {PREVIOUS_LABEL[range]}</span>
    </span>
  );
}

interface KpiCardProps {
  title: string;
  icon: ReactNode;
  color: string;
  tint: string;
  range: RangeKey;
  kpi?: Kpi;
  format?: (n: number) => string;
}

const defaultFormat = (n: number) => n.toLocaleString("en-US");

export function KpiCard({ title, icon, color, tint, range, kpi, format = defaultFormat }: KpiCardProps) {
  if (!kpi) {
    return (
      <StatCard title={title} value={<Skeleton className="h-6 w-20" />} icon={icon} color={color} tint={tint}>
        <Skeleton className="mt-2 h-3 w-28" />
        <Skeleton className="mt-2 h-8 w-full" />
      </StatCard>
    );
  }

  const points = kpi.sparkline.map((value, i) => ({ i, value }));
  return (
    <StatCard title={title} value={format(kpi.value)} icon={icon} color={color} tint={tint}>
      <div className="mt-1 text-[11px]">
        <Delta kpi={kpi} range={range} format={format} />
      </div>
      <div className="mt-2 h-8" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line type="linear" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </StatCard>
  );
}
