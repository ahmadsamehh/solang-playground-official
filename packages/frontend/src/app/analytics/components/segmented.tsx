"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** Compact segmented control in the Playground tab style. */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex items-center gap-0.5 rounded-md bg-ide-bg p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-6 rounded px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            value === option.value ? "bg-ide-hover text-ide-text" : "text-ide-muted hover:text-ide-subtle",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
