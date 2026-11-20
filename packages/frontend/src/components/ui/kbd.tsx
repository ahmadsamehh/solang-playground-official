import * as React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-[18px] select-none items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium leading-none text-current opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
