import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";

interface PanelProps {
  title?: ReactNode;
  /** Right-aligned header content (toggles, counts, actions). */
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Card surface matching the Playground's side panels. */
export function Panel({ title, actions, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-ide-border bg-ide-panel", className)}>
      {(title || actions) && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-ide-border px-4 py-2">
          {title && <SectionLabel>{title}</SectionLabel>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
