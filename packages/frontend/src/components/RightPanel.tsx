"use client";

import { useEffect, useRef, useState } from "react";
import { useSelector } from "@xstate/store/react";
import { Boxes, ChevronLeft, ChevronRight, FileCode2, Hammer, Rocket, Settings2 } from "lucide-react";
import { store } from "@/state";
import { cn } from "@/lib/utils";
import { getLatestCompiled, getLatestDeployedAddress } from "@/state/utils";
import { timeAgo } from "@/lib/explorer";
import useNow from "@/hooks/useNow";
import CompilerOptionsModal from "./CompilerOptionsModal";
import DeployExplorer from "./DeployExplorer";
import ResizeHandle, { usePanelSize } from "./ResizeHandle";

type RightTab = "Build" | "Deploy";

const COLLAPSED_WIDTH = 44;

const TABS: { id: RightTab; label: string; icon: typeof Hammer }[] = [
  { id: "Build", label: "Build", icon: Hammer },
  { id: "Deploy", label: "Deploy & Run", icon: Rocket },
];

function BuildTab({ onOpenCompile }: { onOpenCompile: () => void }) {
  const now = useNow();
  const selected = useSelector(store, (state) => state.context.currentFile);
  const compiled = useSelector(store, (state) => state.context.compiled);
  const latest = getLatestCompiled(compiled);
  const isCurrentFileCompiled = compiled.some((item) => item.path === selected);
  const hasFile = Boolean(selected && selected !== "home");

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ide-muted">Compiler</h3>
        <button
          type="button"
          onClick={onOpenCompile}
          disabled={!hasFile}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand text-[13px] font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Settings2 size={14} />
          {isCurrentFileCompiled ? "Recompile with options" : "Compile with options"}
        </button>
        {!hasFile && <p className="text-center text-xs text-ide-muted">Select a contract file to compile</p>}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ide-muted">
          Artifacts
          {compiled.length > 0 && <span className="font-normal normal-case tracking-normal">{compiled.length}</span>}
        </h3>
        {compiled.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ide-border px-4 py-6 text-center">
            <Boxes size={18} className="mx-auto mb-2 text-ide-faint" />
            <p className="text-xs text-ide-muted">No artifacts yet</p>
            <p className="mt-1 text-[11px] text-ide-faint">Compile a contract to produce WASM</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {[...compiled]
              .sort((a, b) => b.compiledAt - a.compiledAt)
              .map((item) => (
                <li
                  key={item.path}
                  onClick={() => store.send({ type: "setCurrentPath", path: item.path })}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-ide-elevated px-3 py-2 transition-colors hover:border-ide-border-strong",
                    item.path === selected ? "border-brand/50" : "border-ide-border",
                  )}
                >
                  <FileCode2 size={14} className="shrink-0 text-brand-soft" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-ide-text">{item.name}</div>
                    <div className="text-[11px] text-ide-muted">WASM · compiled {timeAgo(item.compiledAt, now)}</div>
                  </div>
                  {latest?.path === item.path && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      Latest
                    </span>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RightPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("Build");
  const [openCompile, setOpenCompile] = useState(false);
  const { size, setSize, persist, reset } = usePanelSize("right", 340, 280, 640);

  const deployed = useSelector(store, (state) => state.context.contract.deployed);
  const latestDeployedAddress = getLatestDeployedAddress(deployed);
  const previousLatest = useRef(latestDeployedAddress);

  // Jump to Deploy & Run whenever a new deployment lands.
  useEffect(() => {
    if (latestDeployedAddress && latestDeployedAddress !== previousLatest.current) {
      setActiveTab("Deploy");
      setCollapsed(false);
    }
    previousLatest.current = latestDeployedAddress;
  }, [latestDeployedAddress]);

  useEffect(() => {
    const collapseForViewport = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    collapseForViewport();
    window.addEventListener("resize", collapseForViewport);
    return () => window.removeEventListener("resize", collapseForViewport);
  }, []);

  const openTab = (tab: RightTab) => {
    setActiveTab(tab);
    setCollapsed(false);
  };

  return (
    <aside
      style={{ width: collapsed ? COLLAPSED_WIDTH : size }}
      className={cn(
        "relative flex h-full shrink-0 flex-col border-l border-ide-border bg-ide-panel text-ide-subtle",
        !dragging && "transition-[width] duration-200 ease-out",
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-1 pt-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => openTab(id)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                activeTab === id ? "bg-brand-muted text-brand-soft" : "text-ide-muted hover:bg-ide-hover hover:text-ide-text",
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-ide-border px-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  activeTab === id ? "bg-ide-hover text-ide-text" : "text-ide-muted hover:bg-ide-hover/60 hover:text-ide-subtle",
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse right panel"
              title="Collapse right panel"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div key={activeTab} className="min-h-0 flex-1 overflow-y-auto p-3 animate-fade-in-up">
            {activeTab === "Build" ? <BuildTab onOpenCompile={() => setOpenCompile(true)} /> : <DeployExplorer />}
          </div>
        </>
      )}

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand right panel"
          title="Expand right panel"
          className="absolute bottom-2 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
        >
          <ChevronLeft size={15} />
        </button>
      )}

      {!collapsed && (
        <ResizeHandle
          axis="x"
          invert
          className="left-0"
          size={size}
          onResize={setSize}
          onResizeEnd={persist}
          onReset={reset}
          onDraggingChange={setDragging}
        />
      )}

      <CompilerOptionsModal isOpen={openCompile} onClose={() => setOpenCompile(false)} />
    </aside>
  );
}

export default RightPanel;
