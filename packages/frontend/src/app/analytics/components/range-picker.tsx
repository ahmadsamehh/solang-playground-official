"use client";

import { Segmented } from "./segmented";
import type { RangeKey } from "../api";

const OPTIONS: { value: RangeKey; label: string; title: string }[] = [
  { value: "7d", label: "7d", title: "Last 7 days" },
  { value: "30d", label: "30d", title: "Last 30 days" },
  { value: "90d", label: "90d", title: "Last 90 days" },
  { value: "all", label: "All", title: "All time" },
];

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return <Segmented ariaLabel="Date range" value={value} onChange={onChange} options={OPTIONS} />;
}
