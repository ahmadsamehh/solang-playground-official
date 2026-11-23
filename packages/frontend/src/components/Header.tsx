"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bug, ChevronDown, FileCode2, Hammer, Home, Loader2, Play, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { get } from "lodash";
import { useSelector } from "@xstate/store/react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import { store } from "@/state";
import { useExplorerItem } from "@/state/hooks";
import Hide from "./Hide";
import useCompile from "@/hooks/useCompile";
import useWallet from "@/hooks/useWallet";
import CompilerOptionsModal from "./CompilerOptionsModal";
import DeployContractModal from "./DeployContractModal";
import InvokeFunctionModal from "./InvokeFunctionModal";
import ErrorModal from "./ErrorModal";
import WalletPill from "./WalletPill";
import NetworkPill from "./NetworkPill";
import BrandMark from "./BrandMark";
import { Kbd } from "./ui/kbd";
import { FileType } from "@/types/explorer";

function TabShell({
  path,
  label,
  icon,
}: {
  path: string;
  label: string;
  icon: React.ReactNode;
}) {
  const active = useSelector(store, (state) => state.context.currentFile === path);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [active]);

  return (
    <div
      ref={itemRef}
      onClick={() => store.send({ type: "setCurrentPath", path })}
      className={cn(
        "group relative flex h-full w-max cursor-pointer select-none items-center gap-2 border-r border-ide-border pl-3 pr-1.5 text-[13px] transition-colors duration-150",
        active ? "bg-ide-bg text-ide-text" : "text-ide-muted hover:bg-ide-hover/60 hover:text-ide-subtle",
      )}
    >
      {active && <span className="absolute inset-x-0 top-0 h-[2px] bg-brand" />}
      <span className={cn("shrink-0", active ? "text-brand-soft" : "text-ide-faint")}>{icon}</span>
      <span className="min-w-max">{label}</span>
      <button
        type="button"
        aria-label={`Close ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          store.send({ type: "removeTab", path });
        }}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded text-ide-muted transition-opacity hover:bg-ide-hover hover:text-ide-text",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function TabItem({ path }: { path: string }) {
  const file = useExplorerItem(path);
  return <TabShell path={path} label={file?.name ?? ""} icon={<FileCode2 size={13} />} />;
}

function TabHome({ path }: { path: string }) {
  return <TabShell path={path} label="Home" icon={<Home size={13} />} />;
}

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return isMac;
}

function Header() {
  const { compileFile } = useCompile();
  const { publicKey } = useWallet();
  const isMac = useIsMac();
  const busy = useSelector(store, (state) => state.context.showSpinnerDialog);
  const selected = useSelector(store, (state) => state.context.currentFile);

  const [openCompile, setOpenCompile] = useState(false);
  const [openDeploy, setOpenDeploy] = useState(false);
  const [openInvoke, setOpenInvoke] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [showCompileErrorModal, setShowCompileErrorModal] = useState(false);
  const [compileErrorMessage, setCompileErrorMessage] = useState<string>("");

  const recordCompile = useMutation({
    mutationFn: async (wallet: string) => axios.post("/api/analytics/compile", { wallet }),
  });

  const canCompile = Boolean(selected && selected !== "home");

  // Quick compile with default flags; use the options menu for custom flags.
  const handleCompile = useCallback(async () => {
    const path = store.getSnapshot().context.currentFile;
    if (!path || path === "home") {
      toast.info("Open a contract file to compile it");
      return;
    }
    if (store.getSnapshot().context.showSpinnerDialog) return;

    setCompiling(true);
    try {
      const result = await compileFile();
      if (result.err) {
        setCompileErrorMessage(result.err);
        setShowCompileErrorModal(true);
        return;
      }
      const file = get(store.getSnapshot().context, path) as FileType | undefined;
      if (result.data) {
        store.send({ type: "addCompiled", path, name: file?.name ?? path });
      }
      toast.success(`Compiled ${file?.name ?? "contract"}`);
      if (publicKey) recordCompile.mutate(publicKey);
    } finally {
      setCompiling(false);
    }
  }, [compileFile, publicKey, recordCompile]);

  const compileRef = useRef(handleCompile);
  compileRef.current = handleCompile;

  // Global shortcuts: ⌘/Ctrl+S compiles, ⌘/Ctrl+Shift+D opens deploy.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        compileRef.current();
      } else if (key === "d" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setOpenDeploy(true);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  const mod = isMac ? "⌘" : "Ctrl";

  return (
    <header className="flex h-12 w-full min-w-0 shrink-0 select-none items-center justify-between gap-3 border-b border-ide-border bg-ide-panel px-3">
      {/* Left: brand + primary actions */}
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark product="Playground" className="pr-1" />

        <span className="hidden h-5 w-px bg-ide-border sm:block" />

        <div className="flex items-center gap-1.5">
          {/* Compile (split button: quick compile + options) */}
          <div className="flex items-center rounded-md bg-brand shadow-sm shadow-brand/20 transition-colors">
            <button
              type="button"
              onClick={handleCompile}
              disabled={!canCompile || busy}
              title={canCompile ? `Compile current file (${mod}+S)` : "Open a contract file to compile"}
              className="flex h-8 items-center gap-2 rounded-l-md pl-3 pr-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {compiling ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
              <span>{compiling ? "Compiling…" : "Compile"}</span>
              <Kbd className="hidden border-white/20 bg-white/10 md:inline-flex">{mod} S</Kbd>
            </button>
            <button
              type="button"
              onClick={() => setOpenCompile(true)}
              disabled={busy}
              title="Compiler options"
              aria-label="Compiler options"
              className="flex h-8 items-center rounded-r-md border-l border-white/15 px-1.5 text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Deploy */}
          <button
            type="button"
            onClick={() => setOpenDeploy(true)}
            disabled={busy}
            title={`Deploy a compiled contract (${mod}+Shift+D)`}
            className="flex h-8 items-center gap-2 rounded-md border border-ide-border bg-ide-elevated px-3 text-[13px] font-medium text-ide-text transition-colors hover:border-ide-border-strong hover:bg-ide-hover disabled:opacity-60"
          >
            <Rocket size={14} className="text-brand-soft" />
            <span>Deploy</span>
            <Kbd className="hidden md:inline-flex">{mod} ⇧ D</Kbd>
          </button>

          {/* Invoke */}
          <button
            type="button"
            onClick={() => setOpenInvoke(true)}
            title="Invoke a deployed contract function"
            className="hidden h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text sm:flex"
          >
            <Play size={13} />
            <span>Invoke</span>
          </button>
        </div>
      </div>

      {/* Right: environment */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden rounded-full border border-ide-border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ide-muted xl:inline">
          Soroban
        </span>
        <div className="hidden md:block">
          <NetworkPill />
        </div>
        <WalletPill className="hidden lg:flex" />
        <a
          href="https://github.com/hyperledger-solang/solang-playground/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          title="Report an issue"
          aria-label="Report an issue"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
        >
          <Bug size={15} />
        </a>
      </div>

      <CompilerOptionsModal isOpen={openCompile} onClose={() => setOpenCompile(false)} />
      <DeployContractModal isOpen={openDeploy} onClose={() => setOpenDeploy(false)} />
      <InvokeFunctionModal isOpen={openInvoke} onClose={() => setOpenInvoke(false)} />
      <ErrorModal
        isOpen={showCompileErrorModal}
        onClose={() => setShowCompileErrorModal(false)}
        title="Compilation Error"
        message={compileErrorMessage}
      />
    </header>
  );
}

// File tabs (rendered above the editor)
export function FileTabs() {
  const tabs = useSelector(store, (state) => state.context.tabs);

  return (
    <div className="flex h-9 shrink-0 select-none border-b border-ide-border bg-ide-panel text-sm">
      <div className="flex w-0 flex-1">
        <div className="flex overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[...tabs].map((tab) => (
            <Hide key={tab} open={tab !== "home"} fallback={<TabHome path={tab} />}>
              <TabItem key={tab} path={tab} />
            </Hide>
          ))}
        </div>
      </div>
    </div>
  );
}

export { Header };
export default Header;
