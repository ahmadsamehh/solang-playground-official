"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Server } from "@stellar/stellar-sdk/rpc";
import { TESTNET_RPC_URLS } from "@/constants";

export type BalanceStatus = "idle" | "loading" | "funded" | "unfunded" | "error";

const STROOPS_PER_XLM = 10_000_000;
const REFRESH_MS = 30_000;

function isNotFound(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return /not found|resource missing/i.test(msg);
}

/** Native XLM balance of a testnet account, read from Soroban RPC (with URL fallback). */
function useAccountBalance(publicKey: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<BalanceStatus>("idle");
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    const id = ++requestId.current;
    setStatus((prev) => (prev === "idle" ? "loading" : prev));

    for (const url of TESTNET_RPC_URLS) {
      try {
        const server = new Server(url, { allowHttp: true });
        const entry = await server.getAccountEntry(publicKey);
        if (id !== requestId.current) return;
        setBalance(Number(entry.balance().toString()) / STROOPS_PER_XLM);
        setStatus("funded");
        return;
      } catch (error) {
        if (isNotFound(error)) {
          if (id !== requestId.current) return;
          setBalance(0);
          setStatus("unfunded");
          return;
        }
        // try the next RPC URL
      }
    }

    if (id === requestId.current) setStatus("error");
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;
    refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [publicKey, refresh]);

  return { balance, status, refresh };
}

export default useAccountBalance;
