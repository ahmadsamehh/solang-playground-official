"use client";

import { useId, useState } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { CheckCircle2, ChevronRight, ExternalLink, Loader2, Send, X, XCircle, Zap } from "lucide-react";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { FunctionSpec } from "@/types/idl";
import { logger } from "@/state/utils";
import { store } from "@/state";
import { scValToNative, xdr } from "@stellar/stellar-base";
import ContractService from "@/lib/services/server/contract";
import { Network_Url } from "@/constants";
import { safeStringify } from "@/utils";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import useWallet from "@/hooks/useWallet";
import { mapIfValid } from "@/utils";
import { nativeToScVal } from "@stellar/stellar-base";
import { cn } from "@/lib/utils";
import { explorerUrl, formatTime, shortId } from "@/lib/explorer";

function transformValue(type: string, value: any) {
  switch (type) {
    case "string":
      return `"${value}"`;
    case "bool":
      return value ? "true" : "false";
    case "vec":
      return typeof value === "string" ? value : safeStringify(value);
    default:
      return value;
  }
}

/** IDL type names are usually strings, but tolerate `{ type }` objects. */
function typeName(t: unknown): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && "type" in t) return String((t as { type: unknown }).type);
  return "";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "void";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return safeStringify(value, 2);
  return String(value);
}

function getValidationError(type: string, subType: string | undefined, value: string): string | null {
  const trimmed = value.trim();

  if (type === "option") {
    if (trimmed === "") return null;
    return subType ? getValidationError(subType, undefined, value) : null;
  }

  if (trimmed === "") return "Required";

  if (type === "vec" || type === "tuple") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return "Must be valid JSON";
    }
    if (type === "vec" && !Array.isArray(parsed)) return "Must be a JSON array";
    if (subType && Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i++) {
        const err = getValidationError(subType, undefined, String(parsed[i]));
        if (err) return `Element ${i}: ${err}`;
      }
    }
    return null;
  }

  if (type === "map") {
    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      return "Must be valid JSON";
    }
  }

  const [mapped, mappedType] = mapIfValid(value, type);
  if (mapped === null || mappedType === "") return `Invalid ${type}`;
  try {
    nativeToScVal(mapped, { type: mappedType });
    return null;
  } catch {
    return `Invalid ${type}`;
  }
}

function createLogSingnature(method: FunctionSpec, args: any, result: any) {
  const mappedArgs = method.inputs.map((arg) => {
    const value = args[arg.name]?.value;
    const val = transformValue(arg.value.type, value);
    return {
      name: arg.name,
      type: arg.value.type,
      value: val,
    };
  });
  const output = method.outputs.at(0);
  const val = transformValue(typeName(output?.type), result);
  return {
    name: method.name,
    args: mappedArgs,
    result: {
      type: typeName(output?.type),
      value: val,
    },
  };
}

interface InvokeResult {
  status: "success" | "failed";
  signature?: ReturnType<typeof createLogSingnature>;
  returnValue?: unknown;
  logs: string[];
  contractErrors: string[];
  hash?: string;
  error?: string;
  at: number;
}

interface InvokeFunctionProps {
  contractAddress: string;
  method: FunctionSpec;
  /** View/pure function: styled as a read call (UI hint only, the call path is the same). */
  readOnly?: boolean;
}

function InvokeFunction({ contractAddress, method, readOnly = false }: InvokeFunctionProps) {
  const [args, setArgs] = useState<Record<string, { type: string; value: string; subType: string }>>({});
  const toastId = useId();
  const [open, setOpen] = useState("");
  const [invoking, setInvoking] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedInvoke, setAttemptedInvoke] = useState(false);
  const errors: Record<string, string | null> = {};
  for (const input of method.inputs ?? []) {
    errors[input.name] = getValidationError(
      input.value.type,
      (input as any).value?.element?.type,
      args[input.name]?.value ?? "",
    );
  }
  const isFormValid = Object.values(errors).every((e) => e === null);
  const recordInvoke = useMutation({
    mutationFn: async (data: any) => {
      return await axios.post("/api/analytics/invoke", data);
    },
  });
  const { keypair } = useWallet();

  const outputType = typeName(method.outputs?.at(0)?.type);
  const inputTypes = (method.inputs ?? []).map((i) => i.value.type).join(", ");

  const handleInputChange = (name: string, value: string, type: string, subType: string) => {
    setArgs((prev) => ({
      ...prev,
      [name]: {
        type,
        value,
        subType,
      },
    }));
  };

  const handleInvoke = async () => {
    setAttemptedInvoke(true);
    if (!isFormValid) {
      toast.error("Please fix the invalid arguments", { id: toastId });
      return;
    }

    try {
      if (!contractAddress) {
        toast.error("No contract address provided", { id: toastId });
        logger.error("No contract address provided.");
        return;
      }

      const argsArray = Object.values(args);
      const requestData = {
        contractId: contractAddress,
        method: method.name,
        args: argsArray,
      };

      logger.info("Invoking Contract function...");
      setInvoking(true);
      logger.info(safeStringify(requestData, 2));
      toast.loading(`Invoking ${method.name}…`, { id: toastId });
      console.log("Invoke Data", requestData);

      const contractService = new ContractService(Network_Url.TEST_NET_FALLBACKS, keypair);
      const response = await contractService.invokeContract(requestData);
      const { resultXdr, diagnosticEventsXdr, status } = response;
      const txHash: string | undefined = response.txHash ?? response.hash;

      if (status === "SUCCESS") {
        recordInvoke.mutate({
          wallet: contractService.pubKey(),
          address: contractAddress,
          method: method.name,
          txHash: response.txHash,
        });
      }

      console.log("Invoke Result", resultXdr);

      let retVal: any = null;
      let logs: string[] = [];

      // Track error events to write to terminal
      let errorMessages: string[] = [];

      for (const eventXdr of Array.from(diagnosticEventsXdr || [])) {
        try {
          const diagnosticEvent = xdr.DiagnosticEvent.fromXDR(eventXdr as any, "base64");
          const eventBody = diagnosticEvent.event().body().v0();

          const topics = eventBody.topics().map(scValToNative);
          const eventData = scValToNative(eventBody.data());

          if (topics.length && topics[0] === "fn_return") {
            retVal = eventData;
            console.log("Fn Return Val", retVal);
          }

          if (topics.includes("log")) {
            try {
              logs.push(safeStringify(eventData));
            } catch {
              logs.push(String(eventData));
            }
          }

          // Check for error events
          if (topics.includes("error")) {
            const errorMsg = typeof eventData === "string" ? eventData : safeStringify(eventData);
            errorMessages.push(errorMsg);
            logger.error(`Contract Error: ${errorMsg}`);
            console.log("Error Event", topics, eventData);
          }
        } catch (e) {
          logger.error(`Error parsing diagnostic event: ${String(e)}`);
        }
      }

      // Write errors to terminal if any
      if (errorMessages.length > 0) {
        const errorDetails = `${errorMessages.join("\n")}\nDiagnostic Events:\n${safeStringify(diagnosticEventsXdr, 2)}`;
        logger.error(errorDetails);
      }

      logs = logs.filter(Boolean);
      console.log("Invoke Logs", logs);

      if (retVal !== null) {
        logger.info(`TX Result: ${retVal}`);
      }

      if (status === "SUCCESS") {
        toast.success(`${method.name} invoked successfully`, { id: toastId });
        logger.info("Transaction successful.");
        logger.info(`TxId: ${txHash}`);
        logger.info(`Contract Logs:\n${logs.join("\n")}`);
        setResult({
          status: "success",
          signature: createLogSingnature(method, args, retVal),
          returnValue: retVal,
          logs,
          contractErrors: errorMessages,
          hash: txHash,
          at: Date.now(),
        });
        store.send({
          type: "addTransaction",
          kind: "invoke",
          status: "success",
          hash: txHash,
          contractId: contractAddress,
          label: method.name,
          returnValue: retVal === null ? undefined : formatValue(retVal),
          logs,
        });
        return response;
      } else {
        console.log("Invoke Failure", response);
        logger.error("Transaction failed.");
        logger.info(`TxId: ${resultXdr.hash}`);
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.log("Invoke Error", error);
      const message = error?.message ?? String(error);
      toast.error(`Error: ${message}`, { id: toastId });
      setResult({ status: "failed", logs: [], contractErrors: [], error: message, at: Date.now() });
      store.send({
        type: "addTransaction",
        kind: "invoke",
        status: "failed",
        contractId: contractAddress,
        label: method.name,
        error: message,
      });
    } finally {
      setInvoking(false);
    }
  };

  const ActionIcon = readOnly ? Zap : Send;

  return (
    <AccordionPrimitive.Root type="single" collapsible value={open} onValueChange={setOpen}>
      <AccordionPrimitive.Item
        value={method.name}
        className={cn(
          "overflow-hidden rounded-md border bg-ide-elevated transition-colors",
          open ? "border-ide-border-strong" : "border-ide-border hover:border-ide-border-strong",
        )}
      >
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="group flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left outline-none focus-visible:bg-ide-hover">
            <ChevronRight
              size={13}
              className="shrink-0 text-ide-muted transition-transform duration-200 group-data-[state=open]:rotate-90"
            />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              <span className={readOnly ? "text-read-soft" : "text-ide-text"}>{method.name}</span>
              <span className="text-ide-faint">({inputTypes})</span>
              {outputType && <span className="text-ide-muted"> → {outputType}</span>}
            </span>
            {result?.status === "success" && result.returnValue !== null && result.returnValue !== undefined && !open && (
              <span className="max-w-[35%] truncate rounded bg-ide-bg px-1.5 py-px font-mono text-[10px] text-emerald-400">
                {formatValue(result.returnValue)}
              </span>
            )}
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                readOnly ? "bg-read-muted text-read-soft" : "bg-brand-muted text-brand-soft",
              )}
            >
              {readOnly ? "read" : "write"}
            </span>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="space-y-2.5 border-t border-ide-border px-2.5 pb-2.5 pt-2">
            {method.doc && <p className="text-[11px] leading-relaxed text-ide-muted">{method.doc}</p>}

            {method.inputs?.length ? (
              <div className="space-y-2">
                {method.inputs.map((arg, index) => {
                  const showError = (touched[arg.name] || attemptedInvoke) && errors[arg.name];
                  const inputId = `${toastId}-${arg.name}`;
                  return (
                    <div key={index} className="space-y-1">
                      <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs">
                        <span className="font-mono text-ide-text">{arg.name}</span>
                        <span className="rounded bg-ide-hover px-1 py-px font-mono text-[10px] text-ide-muted">
                          {arg.value.type}
                        </span>
                      </label>
                      <Input
                        id={inputId}
                        value={args[arg.name]?.value || ""}
                        onChange={(e) =>
                          handleInputChange(arg.name, e.target.value, arg.value.type, (arg as any).value?.element?.type)
                        }
                        onBlur={() => setTouched((prev) => ({ ...prev, [arg.name]: true }))}
                        onKeyDown={(e) => e.key === "Enter" && !invoking && handleInvoke()}
                        placeholder={arg.value.type === "vec" ? "JSON array, e.g. [1, 2]" : `Enter ${arg.value.type}`}
                        aria-invalid={Boolean(showError)}
                        className={cn(
                          "h-8 border-ide-border bg-ide-bg font-mono text-xs md:text-xs focus-visible:ring-1 focus-visible:ring-offset-0",
                          readOnly ? "focus-visible:ring-read" : "focus-visible:ring-brand",
                          showError && "border-red-500/60 focus-visible:ring-red-500",
                        )}
                      />
                      {showError && <p className="text-[11px] text-red-400">{errors[arg.name]}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-ide-muted">No arguments</p>
            )}

            <button
              type="button"
              onClick={handleInvoke}
              disabled={invoking}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-white transition-colors disabled:cursor-wait disabled:opacity-70",
                readOnly ? "bg-read hover:bg-read-hover" : "bg-brand hover:bg-brand-hover",
              )}
            >
              {invoking ? <Loader2 size={13} className="animate-spin" /> : <ActionIcon size={13} />}
              {invoking ? (readOnly ? "Calling…" : "Sending…") : readOnly ? "Call" : "Transact"}
            </button>

            {result && <InvokeResultView result={result} onDismiss={() => setResult(null)} />}
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}

function InvokeResultView({ result, onDismiss }: { result: InvokeResult; onDismiss: () => void }) {
  const ok = result.status === "success";
  const sg = result.signature;

  return (
    <div
      className={cn(
        "animate-fade-in-up overflow-hidden rounded-md border bg-ide-bg text-xs",
        ok ? "border-emerald-500/20" : "border-red-500/25",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-ide-border px-2.5 py-1.5">
        {ok ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
        <span className={cn("font-medium", ok ? "text-emerald-400" : "text-red-400")}>{ok ? "Success" : "Failed"}</span>
        <span className="text-ide-faint">{formatTime(result.at)}</span>
        {result.hash && (
          <a
            href={explorerUrl.tx(result.hash)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${result.hash} · view on Stellar Expert`}
            className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-ide-muted hover:text-brand-soft"
          >
            {shortId(result.hash, 6, 4)}
            <ExternalLink size={11} />
          </a>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss result"
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-ide-faint hover:bg-ide-hover hover:text-ide-text",
            !result.hash && "ml-auto",
          )}
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-2.5 p-2.5">
        {ok && sg && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ide-faint">Return value</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-ide-panel px-2 py-1.5 font-mono text-[12px] leading-5">
              <span className="text-[#dcdcaa]">{sg.name}</span>
              <span className="text-ide-muted">(</span>
              {sg.args.map((arg, i) => (
                <span key={arg.name}>
                  {i > 0 && <span className="text-ide-muted">, </span>}
                  <span className="text-[#9cdcfe]">{arg.name}</span>
                  <span className="text-ide-muted">=</span>
                  <span className="text-[#ce9178]">{String(arg.value ?? "")}</span>
                </span>
              ))}
              <span className="text-ide-muted">)</span>
              <span className="text-ide-faint"> → </span>
              <span className="text-emerald-300">{formatValue(result.returnValue)}</span>
              {sg.result.type && <span className="text-[#4ec9b0]"> : {sg.result.type}</span>}
            </pre>
          </div>
        )}

        {ok && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ide-faint">
              Logs {result.logs.length > 0 && `(${result.logs.length})`}
            </div>
            {result.logs.length === 0 ? (
              <p className="text-[11px] text-ide-faint">No logs emitted</p>
            ) : (
              <div className="max-h-40 space-y-0.5 overflow-auto rounded bg-ide-panel px-2 py-1.5 font-mono text-[12px] leading-5">
                {result.logs.map((log, index) => (
                  <p key={index} className="flex min-w-0 gap-1.5">
                    <span className="select-none text-ide-faint">›</span>
                    <span className="min-w-0 break-all text-ide-subtle">{log}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {result.contractErrors.length > 0 && (
          <div className="space-y-0.5 font-mono text-[12px] text-red-300">
            {result.contractErrors.map((e, i) => (
              <p key={i} className="break-all">
                {e}
              </p>
            ))}
          </div>
        )}

        {!ok && result.error && <p className="break-words font-mono text-[12px] text-red-300">{result.error}</p>}
      </div>
    </div>
  );
}

export default InvokeFunction;
