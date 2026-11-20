"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { FaCog,FaHammer } from "react-icons/fa";
import useCompile from "@/hooks/useCompile";
import { useSelector } from "@xstate/store/react";
import { store } from "@/state";
import { get } from "lodash";
import { FileType } from "@/types/explorer";
import ErrorModal from "./ErrorModal";
import useWallet from "@/hooks/useWallet";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

interface CompilerOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CompilerInfo {
    compiler_name: string;
    compiler_version: string;
    image: string;
    image_digest: string;
    target: string;
    output: string;
}

const fallbackCompilerInfo: CompilerInfo = {
    compiler_name: "Solang",
    compiler_version: "Unavailable",
    image: "Unavailable",
    image_digest: "Unavailable",
    target: "Soroban (Stellar Smart Contracts)",
    output: "WASM bytecode + ABI JSON",
};

function shortenDigest(digest: string): string {
    if (!digest || digest === "Unavailable" || digest.length <= 28) {
        return digest;
    }

    return `${digest.slice(0, 20)}...${digest.slice(-10)}`;
}

function CompilerOptionsModal({ isOpen, onClose }: CompilerOptionsModalProps) {
    const [quickFlags, setQuickFlags] = useState({
        optimize: false,
        emitIr: false,
        release: false,
        noStrengthReduce: false,
        noDeadStorage: false,
    });
    const [customFlags, setCustomFlags] = useState("");
    const [isCompiling, setIsCompiling] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [compilerInfo, setCompilerInfo] = useState<CompilerInfo | null>(null);
    const [isCompilerInfoLoading, setIsCompilerInfoLoading] = useState(false);
    const [compilerInfoError, setCompilerInfoError] = useState<string | null>(null);
    const { publicKey } = useWallet();
    const recordCompile = useMutation({
      mutationFn: async (wallet: any) =>
        axios.post("/api/analytics/compile", {
          wallet,
        }),
    });

    const { compileFile } = useCompile();
    const selected = useSelector(store, (state) => state.context.currentFile);
    const obj = useSelector(store, (state) => get(state.context, selected || '')) as FileType;

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let mounted = true;

        const loadCompilerInfo = async () => {
            setIsCompilerInfoLoading(true);
            setCompilerInfoError(null);

            try {
                const response = await fetch("/compiler-info", {
                    method: "GET",
                    credentials: "same-origin",
                });

                if (!response.ok) {
                    throw new Error(`failed to fetch compiler info (${response.status})`);
                }

                const data = (await response.json()) as Partial<CompilerInfo>;
                if (!mounted) {
                    return;
                }

                setCompilerInfo({
                    compiler_name: data.compiler_name || fallbackCompilerInfo.compiler_name,
                    compiler_version: data.compiler_version || fallbackCompilerInfo.compiler_version,
                    image: data.image || fallbackCompilerInfo.image,
                    image_digest: data.image_digest || fallbackCompilerInfo.image_digest,
                    target: data.target || fallbackCompilerInfo.target,
                    output: data.output || fallbackCompilerInfo.output,
                });
            } catch (err) {
                console.error("Unable to load compiler info", err);
                if (!mounted) {
                    return;
                }
                setCompilerInfoError("Could not load live compiler metadata.");
                setCompilerInfo(null);
            } finally {
                if (mounted) {
                    setIsCompilerInfoLoading(false);
                }
            }
        };

        loadCompilerInfo();

        return () => {
            mounted = false;
        };
    }, [isOpen]);

    const activeCompilerInfo = compilerInfo || fallbackCompilerInfo;

    const buildCompilerFlags = (): string[] => {
        const quickFlagList = [
            ...(quickFlags.optimize ? ["-O", "default"] : []),
            ...(quickFlags.emitIr ? ["--emit", "llvm-ir"] : []),
            ...(quickFlags.release ? ["--release"] : []),
            ...(quickFlags.noStrengthReduce ? ["--no-strength-reduce"] : []),
            ...(quickFlags.noDeadStorage ? ["--no-dead-storage"] : []),
        ];

        const customFlagList = customFlags
            .split(/\s+/)
            .map((flag) => flag.trim())
            .filter(Boolean);

        return [...quickFlagList, ...customFlagList];
    };

    const handleCompile = async () => {
        setIsCompiling(true);
        try {
            const result = await compileFile(undefined, {
                compilerFlags: buildCompilerFlags(),
            });
            console.log('[-] compilation result', result);

            // Check if compilation failed
            if (result.err) {
                setErrorMessage(result.err);
                setShowErrorModal(true);
                return;
            }

            // Only add to compiled list if compilation was successful
            if (selected && selected !== 'home' && result.data) {
                store.send({ type: "addCompiled", path: selected, name: obj.name });
            }

            // Close modal on successful compilation, even if no deployable WASM artifact was produced.
            onClose();
            if (publicKey) {
                recordCompile.mutate(publicKey);
            }
        } catch (error) {
            console.error('Compilation failed:', error);
            const errMsg = error instanceof Error ? error.message : 'Unknown compilation error';
            setErrorMessage(errMsg);
            setShowErrorModal(true);
        } finally {
            setIsCompiling(false);
        }
    };

    const handleQuickFlagChange = (flag: keyof typeof quickFlags) => {
        setQuickFlags(prev => ({
            ...prev,
            [flag]: !prev[flag]
        }));
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-[640px] bg-ide-panel border border-ide-border text-white rounded-xl shadow-xl px-5 py-4">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
                            <FaCog className="text-brand-soft" />
                            Compiler Options
                        </DialogTitle>
                        {/* Intentionally minimal — removed extra descriptive text */}
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Quick Flags */}
                        <div className="space-y-2.5">
                            <h3 className="text-ide-subtle font-medium text-sm">Quick Flags</h3>

                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => handleQuickFlagChange('optimize')}
                                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${quickFlags.optimize
                                        ? 'bg-brand border-brand text-white'
                                        : 'bg-ide-elevated border-ide-border text-ide-subtle hover:bg-ide-hover'
                                        }`}
                                >
                                    -O default
                                </button>

                                <button
                                    onClick={() => handleQuickFlagChange('emitIr')}
                                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${quickFlags.emitIr
                                        ? 'bg-brand border-brand text-white'
                                        : 'bg-ide-elevated border-ide-border text-ide-subtle hover:bg-ide-hover'
                                        }`}
                                >
                                    --emit llvm-ir
                                </button>

                                <button
                                    onClick={() => handleQuickFlagChange('release')}
                                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${quickFlags.release
                                        ? 'bg-brand border-brand text-white'
                                        : 'bg-ide-elevated border-ide-border text-ide-subtle hover:bg-ide-hover'
                                        }`}
                                >
                                    --release
                                </button>

                                <button
                                    onClick={() => handleQuickFlagChange('noStrengthReduce')}
                                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${quickFlags.noStrengthReduce
                                        ? 'bg-brand border-brand text-white'
                                        : 'bg-ide-elevated border-ide-border text-ide-subtle hover:bg-ide-hover'
                                        }`}
                                >
                                    --no-strength-reduce
                                </button>

                                <button
                                    onClick={() => handleQuickFlagChange('noDeadStorage')}
                                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${quickFlags.noDeadStorage
                                        ? 'bg-brand border-brand text-white'
                                        : 'bg-ide-elevated border-ide-border text-ide-subtle hover:bg-ide-hover'
                                        }`}
                                >
                                    --no-dead-storage
                                </button>
                            </div>
                        </div>

                        {/* Custom Flags */}
                        <div className="space-y-2">
                            <Label htmlFor="customFlags" className="text-ide-subtle font-medium text-sm">
                                Custom Flags
                            </Label>
                            <textarea
                                id="customFlags"
                                value={customFlags}
                                onChange={(e) => setCustomFlags(e.target.value)}
                                placeholder="Add custom compiler flags here..."
                                className="w-full h-20 bg-ide-elevated border border-ide-border text-white placeholder-ide-muted focus:border-brand rounded-xl px-3 py-2 text-sm resize-none"
                            />
                            {/* Removed example helper to reduce height */}
                        </div>

                        {/* Compiler Info */}
                        <div className="bg-gradient-to-br from-ide-elevated via-ide-panel to-ide-panel p-4 rounded-2xl border border-ide-border-strong shadow-[0_10px_28px_rgba(10,11,28,0.34)]">
                            <h4 className="text-ide-text font-semibold mb-3 text-sm tracking-wide">
                                Compiler Information
                            </h4>

                            {isCompilerInfoLoading ? (
                                <div className="space-y-2">
                                    <div className="h-4 w-40 rounded bg-ide-hover animate-pulse" />
                                    <div className="h-4 w-56 rounded bg-ide-hover animate-pulse" />
                                    <div className="h-4 w-64 rounded bg-ide-hover animate-pulse" />
                                </div>
                            ) : (
                                <div className="grid gap-2.5 sm:grid-cols-2">
                                    <div className="sm:col-span-2 rounded-xl border border-ide-border-strong bg-ide-bg/70 px-3 py-2.5">
                                        <p className="text-[11px] uppercase tracking-wide text-ide-muted">{activeCompilerInfo.compiler_name} Version</p>
                                        <p className="text-[#ffffff] text-base font-semibold">{activeCompilerInfo.compiler_version}</p>
                                    </div>

                                    <div className="rounded-xl border border-ide-border bg-ide-bg/60 px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-ide-muted">Image Digest</p>
                                        <code
                                            title={activeCompilerInfo.image_digest}
                                            className="block text-ide-text text-xs font-mono mt-1 break-all"
                                        >
                                            {shortenDigest(activeCompilerInfo.image_digest)}
                                        </code>
                                    </div>

                                    <div className="rounded-xl border border-ide-border bg-ide-bg/60 px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-ide-muted">Target</p>
                                        <p className="text-ide-text text-xs mt-1">{activeCompilerInfo.target}</p>
                                    </div>

                                    <div className="sm:col-span-2 rounded-xl border border-ide-border bg-ide-bg/60 px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-ide-muted">Container Image</p>
                                        <code
                                            title={activeCompilerInfo.image}
                                            className="block text-ide-subtle text-xs font-mono mt-1 break-all"
                                        >
                                            {activeCompilerInfo.image}
                                        </code>
                                    </div>

                                    <div className="sm:col-span-2 rounded-xl border border-ide-border bg-ide-bg/60 px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-ide-muted">Output</p>
                                        <p className="text-ide-text text-xs mt-1">{activeCompilerInfo.output}</p>
                                    </div>
                                </div>
                            )}

                            {compilerInfoError && (
                                <p className="text-[#fca5a5] text-xs mt-2">{compilerInfoError}</p>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-ide-border">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="border-ide-border text-ide-subtle hover:bg-ide-elevated"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCompile}
                            disabled={isCompiling}
                            className="bg-brand-hover hover:bg-brand-hover text-white rounded-xl px-4"
                        >
                            {isCompiling ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Compiling...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <FaHammer size={14} />
                                    Compile
                                </div>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Error Modal */}
            <ErrorModal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                title="Compilation Error"
                message={errorMessage}
            />
        </>
    );
}

export default CompilerOptionsModal;
