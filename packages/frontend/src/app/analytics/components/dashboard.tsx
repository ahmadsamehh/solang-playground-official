"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Gauge, Rocket, Users, Zap } from "lucide-react";
import { brand, ide } from "@/lib/theme-tokens";
import type { Granularity } from "@/lib/format";
import { AnalyticsTopBar } from "./analytics-top-bar";
import { RangePicker } from "./range-picker";
import { RefreshControl } from "./refresh-control";
import { KpiCard } from "./kpi-card";
import { ActivityChart } from "./activity-chart";
import { ActiveUsersChart } from "./active-users-chart";
import { NewVsReturning } from "./new-vs-returning";
import { DeployInvokeMix } from "./deploy-invoke-mix";
import { ActivityHeatmap } from "./activity-heatmap";
import { TopContracts } from "./top-contracts";
import { TopWallets } from "./top-wallets";
import { ActivityTable } from "./activity-table";
import { ErrorState } from "./query-state";
import { SERIES } from "../chart-theme";
import { allowedGranularities, analyticsKeys, fetchOverview } from "../api";
import { useRange } from "../use-range";

const RANGE_TITLE = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" } as const;

export function AnalyticsDashboard() {
  const [range, setRange] = useRange();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [wallet, setWallet] = useState<string | null>(null);

  // Keep the shared granularity valid for the selected range.
  useEffect(() => {
    const allowed = allowedGranularities(range);
    if (!allowed.includes(granularity)) setGranularity(allowed[allowed.length - 1]);
  }, [range, granularity]);

  const overview = useQuery({ queryKey: analyticsKeys.overview(range), queryFn: () => fetchOverview(range) });
  const kpis = overview.data?.kpis;

  const filterWallet = useCallback((next: string | null) => {
    setWallet(next);
    if (next) document.getElementById("activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-ide-bg font-sans text-ide-text">
      <AnalyticsTopBar>
        <RefreshControl lastUpdated={overview.data?.lastUpdated} />
      </AnalyticsTopBar>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ide-text">Playground usage</h1>
            <p className="text-xs text-ide-muted">{RANGE_TITLE[range]} · Stellar testnet · times in UTC unless noted</p>
          </div>
          <RangePicker value={range} onChange={setRange} />
        </div>

        {overview.isError ? (
          <section className="rounded-lg border border-ide-border bg-ide-panel">
            <ErrorState height={140} onRetry={() => void overview.refetch()} />
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard title="Deployments" icon={<Rocket size={16} />} color={SERIES.DEPLOY.color} tint={SERIES.DEPLOY.muted} range={range} kpi={kpis?.deploys} />
            <KpiCard title="Invocations" icon={<Zap size={16} />} color={SERIES.INVOKE.color} tint={SERIES.INVOKE.muted} range={range} kpi={kpis?.invokes} />
            <KpiCard title="Active wallets" icon={<Users size={16} />} color={brand.soft} tint={brand.muted} range={range} kpi={kpis?.uniqueUsers} />
            <KpiCard title="Unique contracts" icon={<Boxes size={16} />} color={ide.subtle} tint={SERIES.COMPILE.muted} range={range} kpi={kpis?.uniqueContracts} />
            <KpiCard
              title="Invokes / contract"
              icon={<Gauge size={16} />}
              color={SERIES.INVOKE.soft}
              tint={SERIES.INVOKE.muted}
              range={range}
              kpi={kpis?.avgInvocationsPerContract}
              format={(n) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            />
          </div>
        )}

        <ActivityChart range={range} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActiveUsersChart range={range} granularity={granularity} onGranularityChange={setGranularity} />
          <NewVsReturning range={range} granularity={granularity} onGranularityChange={setGranularity} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DeployInvokeMix range={range} />
          <ActivityHeatmap range={range} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopContracts range={range} />
          <TopWallets range={range} activeWallet={wallet} onFilterWallet={filterWallet} />
        </div>

        <div id="activity" className="scroll-mt-16">
          <ActivityTable range={range} wallet={wallet} onWalletChange={filterWallet} />
        </div>
      </main>
    </div>
  );
}
