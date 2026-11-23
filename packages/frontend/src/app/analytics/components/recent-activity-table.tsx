import { getAnalyticsUrl } from "@/lib/utils";
import { CopyableCell } from "./copyable-cell";
import { ActionBadge } from "./action-badge";
import { Panel } from "./panel";
import { RelativeTime } from "./relative-time";

async function getRecentActivity() {
  const url = getAnalyticsUrl();
  const resp = await fetch(`${url}/analytics/recent`, {
    cache: "no-store", // Ensure fresh data
  });
  const data = await resp.json();
  return (data || []) as {
    wallet: string;
    contract: string;
    action: string;
    hash: string;
    timestamp: string;
    id: string;
  }[];
}

export async function RecentActivityTable() {
  const recentActivity = await getRecentActivity();

  return (
    <Panel title="Recent Activity" bodyClassName="p-0">
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-ide-panel text-[10px] uppercase tracking-wider text-ide-faint">
            <tr className="border-b border-ide-border">
              <th className="px-4 py-2 font-semibold">Wallet</th>
              <th className="px-4 py-2 font-semibold">Contract</th>
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 font-semibold">Transaction hash</th>
              <th className="px-4 py-2 text-right font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((activity) => (
              <tr key={activity.id} className="border-b border-ide-border transition-colors last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2">
                  <CopyableCell text={activity.wallet} />
                </td>
                <td className="px-4 py-2">
                  <CopyableCell text={activity.contract || ""} />
                </td>
                <td className="px-4 py-2">
                  <ActionBadge action={activity.action} />
                </td>
                <td className="px-4 py-2">
                  <CopyableCell text={activity.hash || ""} />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-ide-muted">
                  <RelativeTime value={activity.timestamp} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
