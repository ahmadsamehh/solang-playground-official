"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Filter, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { explorerUrl } from "@/lib/explorer";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { CopyableCell } from "./copyable-cell";
import { ActionBadge } from "./action-badge";
import { RelativeTime } from "./relative-time";
import { EmptyState, ErrorState, Skeleton } from "./query-state";
import {
  ACTIVITY_PAGE_SIZE,
  activityExportUrl,
  analyticsKeys,
  contractLabel,
  fetchActivityPage,
  type ActivityFilters,
  type ActivitySort,
  type RangeKey,
} from "../api";

const COLUMNS: { key: ActivitySort | null; label: string; className?: string }[] = [
  { key: "wallet", label: "Wallet" },
  { key: "contract", label: "Contract" },
  { key: "action", label: "Action" },
  { key: null, label: "Transaction hash" },
  { key: "timestamp", label: "When", className: "text-right" },
];

const TYPE_LABEL: Record<ActivityFilters["type"], string> = {
  all: "All actions",
  DEPLOY: "Deploy",
  INVOKE: "Invoke",
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

interface ActivityTableProps {
  range: RangeKey;
  wallet: string | null;
  onWalletChange: (wallet: string | null) => void;
}

export function ActivityTable({ range, wallet, onWalletChange }: ActivityTableProps) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const [type, setType] = useState<ActivityFilters["type"]>("all");
  const [sort, setSort] = useState<ActivitySort>("timestamp");
  const [order, setOrder] = useState<ActivityFilters["order"]>("desc");
  const [page, setPage] = useState(1);

  const filters: ActivityFilters = { type, wallet, q, sort, order };

  // Any filter change starts again from the first page.
  useEffect(() => setPage(1), [range, type, wallet, q, sort, order]);

  const query = useQuery({
    queryKey: analyticsKeys.activityPage(range, filters, page),
    queryFn: () => fetchActivityPage(range, filters, page),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const last = Math.min(page * ACTIVITY_PAGE_SIZE, total);

  const toggleSort = (key: ActivitySort) => {
    if (sort === key) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setOrder(key === "timestamp" ? "desc" : "asc");
    }
  };

  return (
    <Panel
      title="Recent Activity"
      bodyClassName="p-0"
      actions={
        <a
          href={activityExportUrl(range, filters)}
          download
          className="flex h-7 items-center gap-1.5 rounded-md border border-ide-border px-2.5 text-xs text-ide-subtle transition-colors hover:bg-ide-hover hover:text-ide-text"
          title="Download the filtered rows as CSV (up to 50,000)"
        >
          <Download size={12} /> Export CSV
        </a>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ide-border px-4 py-2.5">
        <div className="relative w-full sm:w-72">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ide-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallet, contract or hash"
            aria-label="Search activity"
            className="h-8 border-ide-border bg-ide-bg pl-8 text-xs md:text-xs focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-0"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as ActivityFilters["type"])}>
          <SelectTrigger
            aria-label="Action type"
            className="h-8 w-[130px] border-ide-border bg-ide-bg text-xs focus:ring-1 focus:ring-brand focus:ring-offset-0"
          >
            <SelectValue>{TYPE_LABEL[type]}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-ide-border bg-ide-panel">
            {(Object.keys(TYPE_LABEL) as ActivityFilters["type"][]).map((value) => (
              <SelectItem key={value} value={value} className="text-xs">
                {TYPE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {wallet && (
          <span className="flex h-8 items-center gap-1.5 rounded-md border border-brand/40 bg-brand-muted pl-2.5 pr-1 text-xs text-brand-soft">
            <Filter size={12} />
            <span className="font-mono" title={wallet}>
              {wallet.slice(0, 6)}…{wallet.slice(-6)}
            </span>
            <button
              type="button"
              onClick={() => onWalletChange(null)}
              aria-label="Clear wallet filter"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10"
            >
              <X size={12} />
            </button>
          </span>
        )}
        <span className="ml-auto text-[11px] text-ide-faint" aria-live="polite">
          {query.data ? `${formatNumber(total)} ${total === 1 ? "transaction" : "transactions"}` : ""}
        </span>
      </div>

      {/* Table */}
      {query.isError ? (
        <ErrorState height={240} onRetry={() => void query.refetch()} />
      ) : (
        <div className="overflow-x-auto">
          <table className={cn("w-full min-w-[760px] text-left text-xs transition-opacity", query.isPlaceholderData && "opacity-60")}>
            <thead className="text-[10px] uppercase tracking-wider text-ide-faint">
              <tr className="border-b border-ide-border">
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    className={cn("px-4 py-2 font-semibold", col.className)}
                    aria-sort={col.key && sort === col.key ? (order === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key!)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ide-text",
                          sort === col.key && "text-ide-subtle",
                        )}
                      >
                        {col.label}
                        {sort === col.key ? (
                          order === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                        ) : (
                          <ArrowUpDown size={11} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.isPending
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className="border-b border-ide-border">
                      {COLUMNS.map((col) => (
                        <td key={col.label} className="px-4 py-3">
                          <Skeleton className="h-3.5 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : query.data.rows.map((row) => (
                    <tr key={row.id} className="border-b border-ide-border transition-colors last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <div className="flex items-center">
                          <CopyableCell text={row.wallet ?? ""} href={row.wallet ? explorerUrl.account(row.wallet) : undefined} />
                          {row.wallet && row.wallet !== wallet && (
                            <button
                              type="button"
                              onClick={() => onWalletChange(row.wallet)}
                              title="Show only this wallet"
                              aria-label="Filter by this wallet"
                              className="flex h-6 w-6 items-center justify-center rounded text-ide-faint transition-colors hover:bg-ide-hover hover:text-ide-text"
                            >
                              <Filter size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <CopyableCell text={row.contract ?? ""} href={row.contract ? explorerUrl.contract(row.contract) : undefined} />
                        {row.contractName && (
                          <div className="mt-0.5 text-[11px] text-ide-faint">{contractLabel(row.contractName)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <ActionBadge action={row.action} />
                          {row.method && <code className="font-mono text-[11px] text-ide-muted">{row.method}()</code>}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <CopyableCell text={row.hash ?? ""} href={row.hash ? explorerUrl.tx(row.hash) : undefined} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-ide-muted">
                        <RelativeTime value={row.timestamp} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {query.data && query.data.rows.length === 0 && (
            <EmptyState height={180} message={q || wallet || type !== "all" ? "No transactions match these filters" : "No transactions in this period"} />
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ide-border px-4 py-2 text-xs text-ide-muted">
        <span className="tabular-nums">
          {total > 0 ? `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)}` : " "}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || query.isFetching}
            aria-label="Previous page"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-ide-border transition-colors hover:bg-ide-hover disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 tabular-nums">
            Page {formatNumber(page)} of {formatNumber(pages)}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages || query.isFetching}
            aria-label="Next page"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-ide-border transition-colors hover:bg-ide-hover disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Panel>
  );
}
