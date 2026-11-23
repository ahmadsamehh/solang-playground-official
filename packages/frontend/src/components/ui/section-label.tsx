import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionLabelProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Optional content on the right, e.g. a count. */
  aside?: React.ReactNode;
}

/** Small uppercase section heading used across IDE panels ("COMPILER", "ARTIFACTS"). */
function SectionLabel({ aside, className, children, ...props }: SectionLabelProps) {
  return (
    <h3
      className={cn(
        "flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-ide-muted",
        className,
      )}
      {...props}
    >
      {children}
      {aside !== undefined && aside !== null && aside !== false && (
        <span className="font-normal normal-case tracking-normal">{aside}</span>
      )}
    </h3>
  );
}

export { SectionLabel };
