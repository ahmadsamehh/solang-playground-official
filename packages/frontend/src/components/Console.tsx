"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "@xstate/store/react";
import { MessageType } from "vscode-languageserver-protocol";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ScrollText,
  SquareTerminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { store } from "@/state";
import { MessageTypeName } from "@/types/log";
import { TxRecord } from "@/types/contracts";
import { cn } from "@/lib/utils";
import { LINKABLE_PATTERN, explorerUrl, explorerUrlFor, formatTime, shortId } from "@/lib/explorer";
import ResizeHandle, { usePanelSize } from "./ResizeHandle";

type ConsoleTab = "output" | "logs" | "transactions";

const LEVEL_STYLE: Record<number, string> = {
  [MessageType.Error]: "bg-red-500/10 text-red-400",
  [MessageType.Warning]: "bg-amber-500/10 text-amber-400",
  [MessageType.Info]: "bg-read-muted text-read-soft",
  [MessageType.Log]: "bg-white/5 text-ide-muted",
  [MessageType.Debug]: "bg-white/5 text-ide-muted",
};

/** Turn tx hashes and contract/account IDs inside text into Stellar Expert links. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(LINKABLE_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        const url = i % 2 === 1 ? explorerUrlFor(part) : null;
        return url ? (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-soft underline decoration-brand-soft/30 underline-offset-2 hover:decoration-brand-soft"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </>
  );
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Minimal JSON syntax highlighting for structured log messages. */
function JsonView({ text }: { text: string }) {
  const parts = text.split(JSON_TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i} className="text-ide-muted">{part}</span>;
        const cls = part.endsWith(":")
          ? "text-[#9cdcfe]"
          : part.startsWith('"')
            ? "text-[#ce9178]"
            : /true|false|null/.test(part)
              ? "text-[#569cd6]"
              : "text-[#b5cea8]";
        return (
          <span key={i} className={cls}>
            {part.startsWith('"') && !part.endsWith(":") ? <Linkified text={part} /> : part}
          </span>
        );
      })}
    </>
  );
}

function prettyJson(message: string): string | null {
  const trimmed = message.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

function OutputView() {
  const logs = useSelector(store, (state) => state.context.logs);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0) {
    return <EmptyState icon={SquareTerminal} text="Compiler and network output will appear here" />;
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto px-3 py-2 font-mono text-[12px] leading-5">
      {logs.map((item) => {
        const json = prettyJson(item.message);
        return (
          <div key={item.id} className="flex gap-2 rounded px-1 py-0.5 hover:bg-white/[0.02]">
            <span
              className={cn(
                "mt-0.5 h-4 w-12 shrink-0 rounded text-center text-[10px] font-semibold uppercase leading-4",
                LEVEL_STYLE[item.type] ?? LEVEL_STYLE[MessageType.Log],
              )}
            >
              {MessageTypeName[item.type] ?? "Log"}
            </span>
            <pre
              className={cn(
                "min-w-0 flex-1 whitespace-pre-wrap break-words font-mono",
                item.type === MessageType.Error ? "text-red-300" : item.type === MessageType.Warning ? "text-amber-200" : "text-ide-subtle",
              )}
            >
              {json ? <JsonView text={json} /> : <Linkified text={item.message} />}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function LogsView({ transactions }: { transactions: TxRecord[] }) {
  const withLogs = transactions.filter((tx) => tx.logs && tx.logs.length > 0);

  if (withLogs.length === 0) {
    return <EmptyState icon={ScrollText} text="Contract logs from invocations will appear here" />;
  }

  return (
    <div className="h-full space-y-2 overflow-auto px-3 py-2 font-mono text-[12px] leading-5">
      {[...withLogs].reverse().map((tx) => (
        <div key={tx.id} className="rounded-md border border-ide-border bg-ide-panel">
          <div className="flex items-center gap-2 border-b border-ide-border px-2.5 py-1 text-[11px]">
            <span className="text-[#dcdcaa]">{tx.label}</span>
            {tx.contractId && <span className="text-ide-faint">{shortId(tx.contractId, 5, 5)}</span>}
            <span className="ml-auto text-ide-faint">{formatTime(tx.timestamp)}</span>
          </div>
          <div className="px-2.5 py-1.5">
            {tx.logs!.map((log, i) => (
              <p key={i} className="flex min-w-0 gap-1.5">
                <span className="select-none text-ide-faint">›</span>
                <span className="min-w-0 break-all text-ide-subtle">{log}</span>
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionsView({ transactions }: { transactions: TxRecord[] }) {
  if (transactions.length === 0) {
    return <EmptyState icon={ArrowLeftRight} text="Deployments and invocations will appear here" />;
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-left text-[12px]">
        <thead className="sticky top-0 bg-ide-panel text-[10px] uppercase tracking-wider text-ide-faint">
          <tr>
            <th className="px-3 py-1.5 font-semibold">Status</th>
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 font-semibold">Function / Contract</th>
            <th className="px-3 py-1.5 font-semibold">Contract ID</th>
            <th className="px-3 py-1.5 font-semibold">Tx hash</th>
            <th className="px-3 py-1.5 font-semibold">Result</th>
            <th className="px-3 py-1.5 text-right font-semibold">Time</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {[...transactions].reverse().map((tx) => (
            <tr key={tx.id} className="border-t border-ide-border transition-colors hover:bg-white/[0.02]">
              <td className="px-3 py-1.5">
                {tx.status === "success" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={12} /> ok
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <XCircle size={12} /> failed
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={cn(
                    "rounded px-1.5 py-px font-sans text-[10px] font-medium",
                    tx.kind === "deploy" ? "bg-brand-muted text-brand-soft" : "bg-read-muted text-read-soft",
                  )}
                >
                  {tx.kind === "deploy" ? "Deploy" : "Invoke"}
                </span>
              </td>
              <td className="px-3 py-1.5 text-ide-text">{tx.label}</td>
              <td className="px-3 py-1.5">
                {tx.contractId ? (
                  <ExplorerLink href={explorerUrl.contract(tx.contractId)} label={shortId(tx.contractId, 5, 5)} title={tx.contractId} />
                ) : (
                  <span className="text-ide-faint">—</span>
                )}
              </td>
              <td className="px-3 py-1.5">
                {tx.hash ? (
                  <ExplorerLink href={explorerUrl.tx(tx.hash)} label={shortId(tx.hash, 8, 6)} title={tx.hash} />
                ) : (
                  <span className="text-ide-faint">{tx.status === "success" ? "simulated" : "—"}</span>
                )}
              </td>
              <td className="max-w-[280px] truncate px-3 py-1.5" title={tx.error ?? tx.returnValue}>
                {tx.error ? (
                  <span className="text-red-300">{tx.error}</span>
                ) : tx.returnValue !== undefined ? (
                  <span className="text-emerald-300">{tx.returnValue}</span>
                ) : (
                  <span className="text-ide-faint">—</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right text-ide-muted">{formatTime(tx.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExplorerLink({ href, label, title }: { href: string; label: string; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${title ?? label} · view on Stellar Expert`}
      className="inline-flex items-center gap-1 text-brand-soft hover:underline"
    >
      {label}
      <ExternalLink size={11} className="opacity-60" />
    </a>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof ScrollText; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-ide-faint">
      <Icon size={20} />
      <p className="text-xs">{text}</p>
    </div>
  );
}

function Console() {
  const logs = useSelector(store, (state) => state.context.logs);
  const transactions = useSelector(store, (state) => state.context.transactions);
  const [tab, setTab] = useState<ConsoleTab>("output");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { size, setSize, persist, reset } = usePanelSize("console", 220, 120, 640);

  const logCount = useMemo(() => transactions.reduce((n, tx) => n + (tx.logs?.length ?? 0), 0), [transactions]);
  const errorCount = useMemo(() => logs.filter((l) => l.type === MessageType.Error).length, [logs]);

  const tabs: { id: ConsoleTab; label: string; count?: number; icon: typeof ScrollText }[] = [
    { id: "output", label: "Output", count: logs.length, icon: SquareTerminal },
    { id: "logs", label: "Logs", count: logCount, icon: ScrollText },
    { id: "transactions", label: "Transactions", count: transactions.length, icon: ArrowLeftRight },
  ];

  const canClear = tab === "output" ? logs.length > 0 : tab === "transactions" ? transactions.length > 0 : false;
  const clear = () => {
    if (tab === "output") store.send({ type: "clearLogs" });
    if (tab === "transactions") store.send({ type: "clearTransactions" });
  };

  const openTab = (id: ConsoleTab) => {
    setTab(id);
    setIsCollapsed(false);
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col border-t border-ide-border bg-ide-panel",
        !dragging && "transition-[height] duration-200 ease-out",
      )}
      style={{ height: isCollapsed ? 36 : size }}
    >
      {!isCollapsed && (
        <ResizeHandle
          axis="y"
          invert
          className="top-0"
          size={size}
          onResize={setSize}
          onResizeEnd={persist}
          onReset={reset}
          onDraggingChange={setDragging}
        />
      )}

      <div className="flex h-9 shrink-0 items-center justify-between border-b border-ide-border px-2">
        <div className="flex items-center gap-0.5" role="tablist">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id && !isCollapsed}
              onClick={() => openTab(id)}
              className={cn(
                "relative flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                tab === id && !isCollapsed ? "bg-ide-hover text-ide-text" : "text-ide-muted hover:bg-ide-hover/60 hover:text-ide-subtle",
              )}
            >
              <Icon size={13} />
              {label}
              {!!count && (
                <span className="rounded-full bg-white/5 px-1.5 text-[10px] tabular-nums text-ide-muted">{count}</span>
              )}
              {id === "output" && errorCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title={`${errorCount} errors`} />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          {canClear && !isCollapsed && (
            <button
              type="button"
              onClick={clear}
              title={`Clear ${tab}`}
              aria-label={`Clear ${tab}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
            aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="min-h-0 flex-1 bg-ide-bg">
          {tab === "output" && <OutputView />}
          {tab === "logs" && <LogsView transactions={transactions} />}
          {tab === "transactions" && <TransactionsView transactions={transactions} />}
        </div>
      )}
    </div>
  );
}

export default Console;
