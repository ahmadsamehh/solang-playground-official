import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import NetworkPill from "@/components/NetworkPill";

/** Top bar matching the Playground header: brand, network status, way back. */
export function AnalyticsTopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 w-full shrink-0 items-center justify-between gap-3 border-b border-ide-border bg-ide-panel px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark product="Analytics" />
        <span className="hidden h-5 w-px bg-ide-border md:block" />
        <Link
          href="/"
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Back to Playground</span>
          <span className="sm:hidden">Playground</span>
        </Link>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {children}
        <NetworkPill />
      </div>
    </header>
  );
}
