"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { explorerUrl, shortId } from "@/lib/explorer";
import { formatNumber } from "@/lib/format";
import { Panel } from "./panel";
import { QueryState, Skeleton } from "./query-state";
import { RelativeTime } from "./relative-time";
import CopyButton from "@/components/CopyButton";
import { SERIES } from "../chart-theme";
import { analyticsKeys, contractLabel, fetchTopContracts, type RangeKey } from "../api";

const HEIGHT = 320;

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3" style={{ minHeight: HEIGHT }} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TopContracts({ range }: { range: RangeKey }) {
  const query = useQuery({ queryKey: analyticsKeys.topContracts(range), queryFn: () => fetchTopContracts(range) });

  return (
    <Panel title="Top Contracts" actions={<span className="text-[11px] text-ide-faint">by invocations</span>}>
      <QueryState
        query={query}
        height={HEIGHT}
        skeleton={<ListSkeleton />}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No invocations in this period"
      >
        {(rows) => {
          const max = Math.max(...rows.map((r) => r.invocations), 1);
          return (
            <ol className="space-y-3" style={{ minHeight: HEIGHT }}>
              {rows.map((row, index) => (
                <li key={row.address} className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 text-right tabular-nums text-ide-faint">{index + 1}</span>
                    <span className="min-w-0 truncate font-medium text-ide-text">{contractLabel(row.name) ?? "Unnamed"}</span>
                    <a
                      href={explorerUrl.contract(row.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${row.address} · view on Stellar Expert`}
                      className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-ide-muted hover:text-brand-soft"
                    >
                      {shortId(row.address, 4, 4)}
                      <ExternalLink size={11} />
                    </a>
                    <CopyButton value={row.address} showLabel={false} title="Copy contract address" className="shrink-0" />
                    <span className="ml-auto shrink-0 font-medium tabular-nums text-ide-text">{formatNumber(row.invocations)}</span>
                  </div>
                  <div className="ml-6 mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(row.invocations / max) * 100}%`, backgroundColor: SERIES.INVOKE.color }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-ide-faint">
                      {formatNumber(row.uniqueCallers)} {row.uniqueCallers === 1 ? "caller" : "callers"} ·{" "}
                      <RelativeTime value={row.lastActivity} />
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          );
        }}
      </QueryState>
    </Panel>
  );
}
