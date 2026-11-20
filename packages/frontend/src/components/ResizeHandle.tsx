"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "solang:panel:";

/**
 * Panel size (px) with min/max clamping, remembered per viewer in localStorage.
 * Storage is best-effort: the layout works the same when it is unavailable.
 */
export function usePanelSize(key: string, initial: number, min: number, max: number) {
  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);
  const [size, setSize] = useState(initial);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_PREFIX + key));
      if (Number.isFinite(stored) && stored > 0) setSize(clamp(stored));
    } catch {
      // storage unavailable: keep the default size
    }
  }, [key, clamp]);

  const update = useCallback((value: number) => setSize(clamp(value)), [clamp]);

  const persist = useCallback(
    (value: number) => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, String(clamp(value)));
      } catch {
        // ignore
      }
    },
    [key, clamp],
  );

  const reset = useCallback(() => {
    setSize(initial);
    persist(initial);
  }, [initial, persist]);

  return { size, setSize: update, persist, reset };
}

interface ResizeHandleProps {
  /** "x" resizes a width (vertical bar), "y" resizes a height (horizontal bar). */
  axis: "x" | "y";
  size: number;
  onResize: (size: number) => void;
  onResizeEnd?: (size: number) => void;
  onReset?: () => void;
  /** Set when dragging toward the origin should grow the panel (right panel, bottom panel). */
  invert?: boolean;
  onDraggingChange?: (dragging: boolean) => void;
  className?: string;
}

function ResizeHandle({ axis, size, onResize, onResizeEnd, onReset, invert, onDraggingChange, className }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ pos: 0, size: 0 });
  const latest = useRef(size);
  latest.current = size;

  const setDrag = (value: boolean) => {
    setDragging(value);
    onDraggingChange?.(value);
    document.body.style.cursor = value ? (axis === "x" ? "col-resize" : "row-resize") : "";
    document.body.style.userSelect = value ? "none" : "";
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { pos: axis === "x" ? e.clientX : e.clientY, size };
    setDrag(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const pos = axis === "x" ? e.clientX : e.clientY;
    const delta = (pos - start.current.pos) * (invert ? -1 : 1);
    onResize(start.current.size + delta);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(false);
    onResizeEnd?.(latest.current);
  };

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      className={cn(
        "group absolute z-30 touch-none",
        axis === "x" ? "top-0 h-full w-2 -translate-x-1/2 cursor-col-resize" : "left-0 w-full h-2 -translate-y-1/2 cursor-row-resize",
        className,
      )}
    >
      <div
        className={cn(
          "absolute bg-brand opacity-0 transition-opacity duration-150 group-hover:opacity-60",
          dragging && "opacity-100 group-hover:opacity-100",
          axis === "x" ? "left-1/2 top-0 h-full w-px -translate-x-1/2" : "top-1/2 left-0 w-full h-px -translate-y-1/2",
        )}
      />
    </div>
  );
}

export default ResizeHandle;
