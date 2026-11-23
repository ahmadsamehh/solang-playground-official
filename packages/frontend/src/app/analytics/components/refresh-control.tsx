"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsKeys } from "../api";
import { RelativeTime } from "./relative-time";

/** "Updated 2 minutes ago" + refresh-all button for the top bar. */
export function RefreshControl({ lastUpdated }: { lastUpdated?: string }) {
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: analyticsKeys.all }) > 0;

  return (
    <div className="flex items-center gap-1.5 text-xs text-ide-muted">
      {lastUpdated && (
        <span className="hidden sm:inline">
          Updated <RelativeTime value={lastUpdated} />
        </span>
      )}
      <button
        type="button"
        onClick={() => void queryClient.invalidateQueries({ queryKey: analyticsKeys.all })}
        disabled={fetching}
        title="Refresh all data"
        aria-label="Refresh all data"
        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-ide-hover hover:text-ide-text disabled:opacity-60"
      >
        <RotateCw size={14} className={cn(fetching && "animate-spin")} />
      </button>
    </div>
  );
}
