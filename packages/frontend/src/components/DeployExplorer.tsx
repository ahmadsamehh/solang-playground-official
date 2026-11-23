"use client";

import { store } from "@/state";
import { useSelector } from "@xstate/store/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { toast } from "sonner";
import { ChevronRight, ExternalLink, FileCode2, Layers, Loader2, Rocket, Trash2 } from "lucide-react";
import InvokeFunction from "./InvokeFunction";
import useDeploy from "@/hooks/useDeploy";
import useNow from "@/hooks/useNow";
import { Input } from "./ui/input";
import { SectionLabel } from "./ui/section-label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { IParam } from "@/lib/services/types/common";
import { mapIfValid } from "@/utils";
import { getLatestCompiled, getLatestDeployedAddress } from "@/state/utils";
import { explorerUrl, shortId, timeAgo } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { ContractsDeployed } from "@/types/idl";
import CopyButton from "./CopyButton";

export function extractConstructorParamTypes(contractCode: string): string[] {
  const match = contractCode.match(/constructor\s*\(([\s\S]*?)\)/);

  if (!match || !match[1].trim()) {
    return [];
  }

  return match[1]
    .split(",")
    .map(param => {
      const cleaned = param.trim();
      const typeMatch = cleaned.match(/^([^\s]+)/);
      return typeMatch ? typeMatch[1] : "";
    })
    .filter((t): t is string => Boolean(t));
}

function extractConstructorParamNames(contractCode: string): string[] {
  const match = contractCode.match(/constructor\s*\(([\s\S]*?)\)/);
  if (!match || !match[1].trim()) return [];
  return match[1].split(",").map((param) => param.trim().split(/\s+/).pop() ?? "");
}

function validateParam(value: string, type: string): string | null {
  if (!value.trim()) return "Required";
  const [mapped, mappedType] = mapIfValid(value, type);
  return mapped === null || mappedType === "" ? `Invalid ${type}` : null;
}

const NO_DEPLOYMENTS: ContractsDeployed = {};

function DeployExplorer() {
  const now = useNow();
  const { deployWasm } = useDeploy();
  const compiled = useSelector(store, (state) => state.context.compiled);
  const deployed = useSelector(store, (state) => state.context.contract?.deployed) ?? NO_DEPLOYMENTS;
  const files = useSelector(store, (state) => state.context.files);
  const busy = useSelector(store, (state) => state.context.showSpinnerDialog);
  const latestCompiled = getLatestCompiled(compiled);
  const [selected, setSelected] = useState<string>(latestCompiled?.path ?? "");
  const [paramValues, setParamValues] = useState<string[]>([]);
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // Get the content of the selected file (not the current tab)
  const selectedFileContent = selected ? files[selected] || "" : "";
  const paramTypesList = useMemo(() => extractConstructorParamTypes(selectedFileContent), [selectedFileContent]);
  const paramNames = useMemo(() => extractConstructorParamNames(selectedFileContent), [selectedFileContent]);
  const paramErrors = paramTypesList.map((t, i) => validateParam(paramValues[i] ?? "", t));
  const selectedCompiled = compiled.find((c) => c.path === selected);

  useEffect(() => {
    setSelected(latestCompiled?.path ?? "");
  }, [latestCompiled?.path, latestCompiled?.compiledAt]);

  useEffect(() => {
    setParamValues([]);
    setTouched({});
    setAttempted(false);
  }, [selected]);

  const deployCountByName = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const info of Object.values(deployed)) {
      counts[info.fileName] = (counts[info.fileName] ?? 0) + 1;
    }
    return counts;
  }, [deployed]);

  // Deployed instances, newest first; the newest one starts expanded.
  const entries = useMemo(
    () => Object.entries(deployed).sort((a, b) => b[1].deployedAt - a[1].deployedAt),
    [deployed],
  );
  const latestDeployed = getLatestDeployedAddress(deployed);
  const [openContracts, setOpenContracts] = useState<string[]>(latestDeployed ? [latestDeployed] : []);
  const previousLatest = useRef(latestDeployed);

  useEffect(() => {
    if (latestDeployed && latestDeployed !== previousLatest.current) {
      setOpenContracts((prev) => (prev.includes(latestDeployed) ? prev : [latestDeployed, ...prev]));
    }
    previousLatest.current = latestDeployed;
  }, [latestDeployed]);

  const handleDeploy = async () => {
    setAttempted(true);
    if (!selected) return;
    if (paramErrors.some(Boolean)) {
      toast.error("Error: fill all constructor parameters!");
      return;
    }

    const paramList: IParam[] = paramTypesList.map((type, seq) => ({ seq, type, value: paramValues[seq] }));
    setDeploying(true);
    try {
      // Pass the selected file path directly to deployWasm
      await deployWasm(null, paramList, selected);
      toast.success(`Deployed ${selectedCompiled?.name ?? "contract"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Deployment failed: ${message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handleRemoveDeployed = (addr: string) => {
    store.send({ type: "deleteDeployed", addr });
  };

  return (
    <div className="space-y-5 text-ide-subtle">
      {/* Contract picker */}
      <section>
        <SectionLabel className="mb-2">Contract</SectionLabel>
        {compiled.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ide-border px-4 py-5 text-center">
            <FileCode2 size={18} className="mx-auto mb-2 text-ide-faint" />
            <p className="text-xs text-ide-muted">No compiled contracts</p>
            <p className="mt-1 text-[11px] text-ide-faint">Compile a .sol file to deploy it</p>
          </div>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-auto min-h-10 border-ide-border bg-ide-elevated px-3 py-2 text-left hover:border-ide-border-strong focus:ring-1 focus:ring-brand focus:ring-offset-0">
              <SelectValue placeholder="Select a contract…">
                {selectedCompiled && (
                  <span className="flex min-w-0 items-center gap-2">
                    <FileCode2 size={14} className="shrink-0 text-brand-soft" />
                    <span className="truncate text-[13px] font-medium text-ide-text">{selectedCompiled.name}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      Compiled
                    </span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-ide-border bg-ide-panel">
              {[...compiled]
                .sort((a, b) => b.compiledAt - a.compiledAt)
                .map((c) => {
                  const count = deployCountByName[c.name] ?? 0;
                  return (
                    <SelectItem key={c.path} value={c.path} className="py-2 focus:bg-ide-hover">
                      <span className="flex flex-col">
                        <span className="text-[13px] text-ide-text">{c.name}</span>
                        <span className="text-[11px] text-ide-muted">
                          Compiled {timeAgo(c.compiledAt, now)}
                          {count > 0 && ` · ${count} deployed`}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        )}
      </section>

      {/* Constructor */}
      {paramTypesList.length > 0 && (
        <section>
          <SectionLabel className="mb-2">Constructor</SectionLabel>
          <div className="space-y-2.5">
            {paramTypesList.map((t, i) => {
              const showError = (touched[i] || attempted) && paramErrors[i];
              return (
                <label key={`${t}__${i}`} className="block space-y-1">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono text-ide-text">{paramNames[i] || `arg${i}`}</span>
                    <span className="rounded bg-ide-hover px-1 py-px font-mono text-[10px] text-ide-muted">{t}</span>
                  </span>
                  <Input
                    value={paramValues[i] ?? ""}
                    placeholder={`Enter ${t}`}
                    aria-invalid={Boolean(showError)}
                    onChange={(e) =>
                      setParamValues((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    onBlur={() => setTouched((prev) => ({ ...prev, [i]: true }))}
                    onKeyDown={(e) => e.key === "Enter" && handleDeploy()}
                    className={cn(
                      "h-8 border-ide-border bg-ide-bg font-mono text-xs md:text-xs focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-0",
                      showError && "border-red-500/60 focus-visible:ring-red-500",
                    )}
                  />
                  {showError && <span className="block text-[11px] text-red-400">{paramErrors[i]}</span>}
                </label>
              );
            })}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={handleDeploy}
        disabled={compiled.length === 0 || !selected || deploying || busy}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand text-[13px] font-medium text-white shadow-sm shadow-brand/20 transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
        {deploying ? "Deploying…" : "Deploy"}
      </button>

      {/* Deployed instances */}
      {entries.length > 0 && (
        <section>
          <SectionLabel className="mb-2" aside={entries.length}>Deployed contracts</SectionLabel>
          <AccordionPrimitive.Root type="multiple" value={openContracts} onValueChange={setOpenContracts} className="space-y-2">
            {entries.map(([k, info]) => (
              <AccordionPrimitive.Item
                key={k}
                value={k}
                className="overflow-hidden rounded-lg border border-ide-border bg-ide-elevated transition-colors data-[state=open]:border-ide-border-strong"
              >
                <AccordionPrimitive.Header className="flex items-center pr-1.5">
                  <AccordionPrimitive.Trigger className="group flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left outline-none focus-visible:bg-ide-hover">
                    <ChevronRight
                      size={14}
                      className="shrink-0 text-ide-muted transition-transform duration-200 group-data-[state=open]:rotate-90"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-ide-text">{info.fileName}</span>
                        {k === latestDeployed && (
                          <span className="shrink-0 rounded-full bg-brand-muted px-1.5 py-px text-[10px] font-medium text-brand-soft">
                            Latest
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-ide-muted">
                        <span className="font-mono" title={k}>
                          {shortId(k, 5, 5)}
                        </span>
                        <span>·</span>
                        <span>{timeAgo(info.deployedAt, now)}</span>
                      </span>
                    </span>
                  </AccordionPrimitive.Trigger>
                  <CopyButton value={k} title="Copy contract address" />
                  <a
                    href={explorerUrl.contract(k)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on Stellar Expert"
                    aria-label="View on Stellar Expert"
                    className="flex h-6 w-6 items-center justify-center rounded text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveDeployed(k)}
                    title="Remove from list"
                    aria-label="Remove from list"
                    className="flex h-6 w-6 items-center justify-center rounded text-ide-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="space-y-1.5 border-t border-ide-border bg-ide-panel/60 p-2">
                    {info.methods && info.methods.length > 0 ? (
                      info.methods.map((item, i) => (
                        <InvokeFunction
                          key={`${item.name}__${i}__${item.type}`}
                          contractAddress={k}
                          method={item}
                          readOnly={info.readOnlyMethods?.includes(item.name)}
                        />
                      ))
                    ) : (
                      <p className="flex items-center justify-center gap-1.5 py-3 text-xs text-ide-muted">
                        <Layers size={13} /> No callable functions
                      </p>
                    )}
                  </div>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        </section>
      )}
    </div>
  );
}

export default DeployExplorer;
