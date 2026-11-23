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

export interface NewVsReturningBucket extends Bucket {
  newUsers: number;
  returningUsers: number;
}

export interface Kpi {
  value: number;
  previous: number | null;
  changePct: number | null;
  sparkline: number[];
}

export interface Overview {
  range: {
    key: RangeKey;
    from: string;
    to: string;
    prevFrom: string | null;
    prevTo: string | null;
    sparklineGranularity: Granularity;
  };
  lastUpdated: string;
  kpis: Record<"deploys" | "invokes" | "uniqueUsers" | "uniqueContracts" | "avgInvocationsPerContract", Kpi>;
}

export interface TopContract {
  address: string;
  name: string | null;
  invocations: number;
  uniqueCallers: number;
  lastActivity: string;
}

export interface TopWallet {
  wallet: string;
  deploys: number;
  invokes: number;
  compiles: number;
  total: number;
  lastActivity: string;
}

export interface Heatmap {
  /** Zone actually used (falls back to UTC when the requested one is unknown). */
  timezone: string;
  /** dow: ISO day of week, 1 = Monday. */
  cells: { dow: number; hour: number; count: number }[];
}

export type ActionType = "DEPLOY" | "INVOKE";
export type ActivitySort = "timestamp" | "action" | "wallet" | "contract";
export type SortOrder = "asc" | "desc";

export interface ActivityFilters {
  type: ActionType | "all";
  wallet: string | null;
  q: string;
  sort: ActivitySort;
  order: SortOrder;
}

export interface ActivityRow {
  id: string;
  action: ActionType;
  wallet: string | null;
  contract: string | null;
  contractName: string | null;
  method: string | null;
  hash: string | null;
  timestamp: string;
}

export interface ActivityPage {
  rows: ActivityRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const ACTIVITY_PAGE_SIZE = 25;

const client = axios.create({ baseURL: "/api/analytics" });

export const analyticsKeys = {
  all: ["analytics"] as const,
  overview: (range: RangeKey) => ["analytics", "overview", range] as const,
  activeUsers: (range: RangeKey, granularity: Granularity) => ["analytics", "active-users", range, granularity] as const,
  activity: (range: RangeKey, granularity: Granularity) => ["analytics", "activity-timeseries", range, granularity] as const,
  newVsReturning: (range: RangeKey, granularity: Granularity) =>
    ["analytics", "new-vs-returning", range, granularity] as const,
  topContracts: (range: RangeKey) => ["analytics", "top-contracts", range] as const,
  topWallets: (range: RangeKey) => ["analytics", "top-wallets", range] as const,
  heatmap: (range: RangeKey, tz: string) => ["analytics", "heatmap", range, tz] as const,
  activityPage: (range: RangeKey, filters: ActivityFilters, page: number) =>
    ["analytics", "activity", range, filters, page] as const,
};

export async function fetchOverview(range: RangeKey) {
  const { data } = await client.get<Overview>("/overview", { params: { range } });
  return data;
}

export async function fetchNewVsReturning(range: RangeKey, granularity: Granularity) {
  const { data } = await client.get<NewVsReturningBucket[]>("/new-vs-returning", { params: { range, granularity } });
  return data;
}

export async function fetchTopContracts(range: RangeKey, limit = 8) {
  const { data } = await client.get<TopContract[]>("/top-contracts", { params: { range, limit } });
  return data;
}

export async function fetchTopWallets(range: RangeKey, limit = 8) {
  const { data } = await client.get<TopWallet[]>("/top-wallets", { params: { range, limit } });
  return data;
}

export async function fetchHeatmap(range: RangeKey, tz: string) {
  const { data } = await client.get<Heatmap>("/heatmap", { params: { range, tz } });
  return data;
}

function activityParams(range: RangeKey, filters: ActivityFilters) {
  const params = new URLSearchParams({ range, sort: filters.sort, order: filters.order });
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.wallet) params.set("wallet", filters.wallet);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return params;
}

export async function fetchActivityPage(range: RangeKey, filters: ActivityFilters, page: number) {
  const params = activityParams(range, filters);
  params.set("page", String(page));
  params.set("pageSize", String(ACTIVITY_PAGE_SIZE));
  const { data } = await client.get<ActivityPage>("/activity", { params });
  return data;
}

/** Download URL for the CSV export of the current filters (served through the same rewrite). */
export const activityExportUrl = (range: RangeKey, filters: ActivityFilters) =>
  `/api/analytics/activity/export?${activityParams(range, filters).toString()}`;

/** Contract names are stored as Playground file paths, e.g. explorer.items.src.items['main.sol']. */
export function contractLabel(name: string | null): string | null {
  if (!name) return null;
  return name.match(/\['([^']+)'\]$/)?.[1] ?? name;
}

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
