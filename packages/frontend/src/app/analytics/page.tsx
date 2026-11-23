import { Activity, TrendingUp, Users, Zap } from "lucide-react";
export const dynamic = "force-dynamic";
import { StatCard } from "./components/stat-card";
import { ActivityOverTimeChart } from "./components/activity-over-time-chart";
import { TransactionDistributionChart } from "./components/transaction-distribution-chart";
import { RecentActivityTable } from "./components/recent-activity-table";
import { getAnalyticsUrl } from "@/lib/utils";
import { UserTrendChart } from "./components/users-trend";
import { ActiveUsersChart } from "./components/active-users";
import { AnalyticsTopBar } from "./components/analytics-top-bar";
import { SERIES } from "./chart-theme";
import { brand } from "@/lib/theme-tokens";

async function getSummaryData() {
  const url = getAnalyticsUrl();
  const resp = await fetch(`${url}/analytics/summary`);
  const data = await resp.json();
  return data as {
    users: number;
    transactions: number;
    deploys: number;
    invokes: number;
  };
}

export default async function AnalyticsDashboard() {
  const { users, transactions, deploys, invokes } = await getSummaryData();
  return (
    <div className="min-h-screen bg-ide-bg font-sans text-ide-text">
      <AnalyticsTopBar />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Deployments" value={deploys} icon={<Activity size={16} />} color={SERIES.DEPLOY.color} tint={SERIES.DEPLOY.muted} />
          <StatCard title="Contract Invocations" value={invokes} icon={<Zap size={16} />} color={SERIES.INVOKE.color} tint={SERIES.INVOKE.muted} />
          <StatCard title="Unique Users" value={users} icon={<Users size={16} />} color={brand.soft} tint={brand.muted} />
          <StatCard title="Total Transactions" value={transactions} icon={<TrendingUp size={16} />} color={SERIES.COMPILE.soft} tint={SERIES.COMPILE.muted} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActiveUsersChart />
          <UserTrendChart />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <ActivityOverTimeChart />
          </div>
          <TransactionDistributionChart />
        </div>

        <RecentActivityTable />
      </main>
    </div>
  );
}
