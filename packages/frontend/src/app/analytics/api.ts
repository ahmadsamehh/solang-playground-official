import axios from "axios";
import type { Granularity } from "@/lib/format";

/** Mirrors packages/analytics/src/libs/range.ts */
export const RANGE_KEYS = ["7d", "30d", "90d", "all"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const DEFAULT_RANGE: RangeKey = "30d";

export const isRangeKey = (value: unknown): value is RangeKey =>
  typeof value === "string" && (RANGE_KEYS as readonly string[]).includes(value);

interface Bucket {
  /** UTC bucket start, "YYYY-MM-DD". */
  bucket: string;
  /** "2026-11-23" (day), "2026-W48" (ISO week), "2026-11" (month). */
  label: string;
}

export interface ActiveUsersBucket extends Bucket {
  users: number;
}

export interface ActivityBucket extends Bucket {
  deployments: number;
  invocations: number;
  compiles: number;
}

const client = axios.create({ baseURL: "/api/analytics" });

export const analyticsKeys = {
  all: ["analytics"] as const,
  activeUsers: (range: RangeKey, granularity: Granularity) => ["analytics", "active-users", range, granularity] as const,
  activity: (range: RangeKey, granularity: Granularity) => ["analytics", "activity-timeseries", range, granularity] as const,
};

export async function fetchActiveUsers(range: RangeKey, granularity: Granularity) {
  const { data } = await client.get<ActiveUsersBucket[]>("/active-users", { params: { range, granularity } });
  return data;
}

export async function fetchActivity(range: RangeKey, granularity: Granularity) {
  const { data } = await client.get<ActivityBucket[]>("/activity-timeseries", { params: { range, granularity } });
  return data;
}

/** Granularities that give at least a few buckets for a range. */
export function allowedGranularities(range: RangeKey): Granularity[] {
  if (range === "7d") return ["day"];
  if (range === "30d") return ["day", "week"];
  return ["day", "week", "month"];
}

/** Daily points for short ranges, weekly once daily lines get too dense. */
export const timeseriesGranularity = (range: RangeKey): Granularity => (range === "all" ? "week" : "day");
