"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "@/lib/format";

/** "3 days ago" with the full local timestamp on hover; renders in the viewer's time zone. */
export function RelativeTime({ value }: { value: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time dateTime={value} title={now === null ? undefined : formatDateTime(value)} className="cursor-default">
      {now === null ? " " : formatRelative(value, now)}
    </time>
  );
}
