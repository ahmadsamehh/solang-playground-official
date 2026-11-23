import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  /** Series colour for the icon tile (from chart-theme SERIES). */
  color: string;
  /** Translucent version of the colour for the icon background. */
  tint: string;
  /** Extra content below the value (delta, sparkline). */
  children?: ReactNode;
  className?: string;
}

const numberFormat = new Intl.NumberFormat("en-US");

export function StatCard({ title, value, icon, color, tint, children, className }: StatCardProps) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-ide-border bg-ide-panel p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>{title}</SectionLabel>
          <div className="mt-2 flex h-8 items-center text-2xl font-semibold tabular-nums tracking-tight text-ide-text">
            {typeof value === "number" ? numberFormat.format(value) : value}
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: tint, color }}>
          {icon}
        </div>
      </div>
      {children}
    </section>
  );
}
