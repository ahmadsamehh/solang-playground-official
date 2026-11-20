"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  /** Show a "Copied" text label next to the check icon. */
  showLabel?: boolean;
  title?: string;
}

function CopyButton({ value, className, showLabel = true, title = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : title}
      aria-label={copied ? "Copied" : title}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] transition-colors",
        copied ? "text-emerald-400" : "text-ide-muted hover:bg-ide-hover hover:text-ide-text",
        className,
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied && showLabel && <span className="animate-fade-in-up">Copied ✓</span>}
    </button>
  );
}

export default CopyButton;
