"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Filter } from "lucide-react";
import { explorerUrl, shortId } from "@/lib/explorer";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { QueryState } from "./query-state";
import { ListSkeleton } from "./top-contracts";
import CopyButton from "@/components/CopyButton";
import { SERIES } from "../chart-theme";
import { analyticsKeys, fetchTopWallets, type RangeKey } from "../api";

const HEIGHT = 320;
const PARTS = [
  { key: "deploys", series: SERIES.DEPLOY },
  { key: "invokes", series: SERIES.INVOKE },
  { key: "compiles", series: SERIES.COMPILE },
] as const;

interface TopWalletsProps {
  range: RangeKey;
  activeWallet: string | null;
  onFilterWallet: (wallet: string) => void;
}

export function TopWallets({ range, activeWallet, onFilterWallet }: TopWalletsProps) {
  const query = useQuery({ queryKey: analyticsKeys.topWallets(range), queryFn: () => fetchTopWallets(range) });

  return (
    <Panel
      title="Top Wallets"
      actions={
        <span className="flex items-center gap-2.5 text-[11px] text-ide-faint">
          {PARTS.map(({ key, series }) => (
            <span key={key} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: series.color }} />
              {series.label}
            </span>
          ))}
        </span>
      }
    >
      <QueryState
        query={query}
        height={HEIGHT}
        skeleton={<ListSkeleton />}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No wallet activity in this period"
      >
        {(rows) => {
          const max = Math.max(...rows.map((r) => r.total), 1);
          return (
            <ol className="space-y-3" style={{ minHeight: HEIGHT }}>
              {rows.map((row, index) => (
                <li key={row.wallet} className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 text-right tabular-nums text-ide-faint">{index + 1}</span>
                    <a
                      href={explorerUrl.account(row.wallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${row.wallet} · view on Stellar Expert`}
                      className="flex min-w-0 items-center gap-1 font-mono text-ide-text hover:text-brand-soft"
                    >
                      {shortId(row.wallet, 6, 6)}
                      <ExternalLink size={11} className="shrink-0 text-ide-muted" />
                    </a>
                    <CopyButton value={row.wallet} showLabel={false} title="Copy wallet address" className="shrink-0" />
                    <button
                      type="button"
                      onClick={() => onFilterWallet(row.wallet)}
                      title="Show this wallet's transactions"
                      aria-label="Filter activity by this wallet"
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-ide-hover hover:text-ide-text",
                        activeWallet === row.wallet ? "text-brand-soft" : "text-ide-muted",
                      )}
                    >
                      <Filter size={12} />
                    </button>
                    <span className="ml-auto shrink-0 font-medium tabular-nums text-ide-text">{formatNumber(row.total)}</span>
                  </div>
                  <div
                    className="ml-6 mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/[0.04]"
                    title={PARTS.map(({ key, series }) => `${series.label}: ${row[key]}`).join(" · ")}
                  >
                    {PARTS.map(({ key, series }) => (
                      <div key={key} style={{ width: `${(row[key] / max) * 100}%`, backgroundColor: series.color }} />
                    ))}
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
