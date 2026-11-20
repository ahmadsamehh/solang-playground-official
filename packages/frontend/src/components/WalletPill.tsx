"use client";

import { useEffect, useState } from "react";
import { Droplets, Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useSelector } from "@xstate/store/react";
import { store } from "@/state";
import useWallet from "@/hooks/useWallet";
import useAccountBalance from "@/hooks/useAccountBalance";
import { RpcService } from "@/lib/services/rpc";
import { TESTNET_RPC_URLS } from "@/constants";
import { explorerUrl, shortId } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import CopyButton from "./CopyButton";

const balanceFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function WalletPill({ className }: { className?: string }) {
  const { publicKey } = useWallet();
  const { balance, status, refresh } = useAccountBalance(publicKey);
  const [funding, setFunding] = useState(false);
  // Deploys and invocations spend fees, so refresh after each recorded transaction.
  const txCount = useSelector(store, (state) => state.context.transactions.length);

  useEffect(() => {
    if (txCount > 0) refresh();
  }, [txCount, refresh]);

  const handleFund = async () => {
    if (!publicKey || funding) return;
    setFunding(true);
    const toastId = toast.loading("Requesting testnet XLM from Friendbot…");
    try {
      const ok = await new RpcService(TESTNET_RPC_URLS[0]).fundAccount(publicKey);
      if (!ok) throw new Error("Friendbot is unavailable, please retry in a moment");
      toast.success("Account funded with testnet XLM", { id: toastId });
      // Friendbot returns before RPC sees the new balance on some nodes.
      await refresh();
      window.setTimeout(refresh, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Funding failed", { id: toastId });
    } finally {
      setFunding(false);
    }
  };

  if (!publicKey) return null;

  const balanceLabel =
    status === "funded" && balance !== null
      ? `${balanceFormat.format(balance)} XLM`
      : status === "unfunded"
        ? "Unfunded"
        : status === "error"
          ? "Balance unavailable"
          : "…";

  return (
    <div
      className={cn(
        "flex h-8 items-center rounded-full border border-ide-border bg-ide-elevated pl-2.5 pr-1 text-xs text-ide-subtle",
        className,
      )}
    >
      <Wallet size={13} className="text-ide-muted" />
      <a
        href={explorerUrl.account(publicKey)}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-1.5 font-mono text-ide-text hover:text-brand-soft"
        title={`${publicKey} · view on Stellar Expert`}
      >
        {shortId(publicKey)}
      </a>
      <CopyButton value={publicKey} showLabel={false} title="Copy address" className="ml-0.5 h-6 w-6 justify-center p-0" />
      <span className="mx-1.5 h-3.5 w-px bg-ide-border" />
      <button
        type="button"
        onClick={() => refresh()}
        title="Refresh balance"
        className={cn(
          "group inline-flex items-center gap-1 tabular-nums transition-colors hover:text-ide-text",
          status === "unfunded" && "text-amber-400",
        )}
      >
        {balanceLabel}
        <RefreshCw size={11} className="opacity-0 transition-opacity group-hover:opacity-70" />
      </button>
      <button
        type="button"
        onClick={handleFund}
        disabled={funding}
        title="Fund with Friendbot (testnet)"
        className={cn(
          "ml-1.5 inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium transition-colors disabled:opacity-60",
          status === "unfunded"
            ? "bg-brand text-white hover:bg-brand-hover"
            : "text-ide-muted hover:bg-ide-hover hover:text-ide-text",
        )}
      >
        {funding ? <Loader2 size={12} className="animate-spin" /> : <Droplets size={12} />}
        <span>Fund</span>
      </button>
    </div>
  );
}

export default WalletPill;
