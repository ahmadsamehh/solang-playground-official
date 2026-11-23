"use client";

import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.04]", className)} style={style} />;
}

/** Placeholder shaped like a bar/line chart. */
export function ChartSkeleton({ height }: { height: number }) {
  const bars = [42, 65, 38, 80, 55, 70, 48, 90, 60, 75, 52, 66];
  return (
    <div className="flex items-end gap-2 px-2" style={{ height }} aria-busy="true" aria-label="Loading">
      {bars.map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ height, message = "No activity in this period" }: { height: number; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-ide-faint" style={{ height }}>
      <Inbox size={20} />
      <p className="text-xs">{message}</p>
    </div>
  );
}

export function ErrorState({ height, onRetry }: { height: number; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }} role="alert">
      <AlertTriangle size={18} className="text-amber-400" />
      <p className="text-xs text-ide-muted">Couldn&apos;t load this data.</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-7 items-center gap-1.5 rounded-md border border-ide-border px-2.5 text-xs text-ide-subtle transition-colors hover:bg-ide-hover hover:text-ide-text"
      >
        <RotateCw size={12} /> Retry
      </button>
    </div>
  );
}

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  height: number;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}

/** Loading skeleton → error with retry → empty state → content. */
export function QueryState<T>({ query, height, isEmpty, emptyMessage, skeleton, children }: QueryStateProps<T>) {
  if (query.isPending) return <>{skeleton ?? <ChartSkeleton height={height} />}</>;
  if (query.isError) return <ErrorState height={height} onRetry={() => void query.refetch()} />;
  if (isEmpty?.(query.data)) return <EmptyState height={height} message={emptyMessage} />;
  return (
    <div className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}>{children(query.data)}</div>
  );
}
