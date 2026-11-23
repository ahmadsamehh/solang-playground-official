"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NetworkStatus = "checking" | "online" | "offline";

/** Testnet RPC health pill (polls the /api/network/health route every 30s). */
function NetworkPill() {
  const [status, setStatus] = useState<NetworkStatus>("checking");
  const [rpcUrl, setRpcUrl] = useState("");

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      let next: { status: NetworkStatus; url: string } = { status: "offline", url: "" };
      try {
        const response = await fetch("/api/network/health", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.status === "online" && payload?.rpcUrl) {
          next = { status: "online", url: payload.rpcUrl };
        }
      } catch {
        // keep offline status if the health endpoint fails
      }
      if (disposed) return;
      setStatus(next.status);
      setRpcUrl(next.url);
    };

    run();
    const interval = window.setInterval(run, 30000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  const dot = { online: "bg-emerald-500", offline: "bg-red-500", checking: "bg-amber-400" }[status];
  const ping = { online: "bg-emerald-400", offline: "bg-red-400", checking: "bg-amber-300" }[status];
  const title =
    status === "online"
      ? `Testnet RPC: ${rpcUrl}`
      : status === "offline"
        ? "No reachable testnet RPC endpoint"
        : "Checking testnet RPC…";

  return (
    <div
      title={title}
      className="flex h-8 items-center gap-2 rounded-full border border-ide-border bg-ide-elevated px-3 text-xs text-ide-subtle"
    >
      <span className="relative flex h-2 w-2">
        {status !== "offline" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", ping)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span className="font-medium text-ide-text">Testnet</span>
      {status === "offline" && <span className="text-red-400">RPC down</span>}
      {status === "checking" && <span className="text-ide-muted">checking…</span>}
    </div>
  );
}

export default NetworkPill;
