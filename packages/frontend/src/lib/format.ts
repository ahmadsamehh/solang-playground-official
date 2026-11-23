/**
 * Date and number formatting for analytics. Buckets come from the API as UTC
 * dates ("2026-11-16"), so bucket formatting is pinned to UTC to avoid
 * off-by-one days in timezones west of Greenwich.
 */

export type Granularity = "day" | "week" | "month";

const numberFormat = new Intl.NumberFormat("en-US");
export const formatNumber = (value: number) => numberFormat.format(value);

/** "2026-11-16" → Date at UTC midnight. */
export const bucketToDate = (bucket: string) => new Date(`${bucket}T00:00:00.000Z`);
export const bucketToTs = (bucket: string) => bucketToDate(bucket).getTime();

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options });
const dayShort = fmt({ month: "short", day: "numeric" });
const dayShortYear = fmt({ month: "short", day: "numeric", year: "numeric" });
const dayFull = fmt({ weekday: "short", month: "short", day: "numeric", year: "numeric" });
const monthShort = fmt({ month: "short" });
const monthShortYear = fmt({ month: "short", year: "numeric" });
const monthFull = fmt({ month: "long", year: "numeric" });

/** True when the buckets cover more than one calendar year, so ticks must show the year. */
export function spansYears(buckets: ReadonlyArray<string | number>): boolean {
  if (buckets.length === 0) return false;
  const year = (b: string | number) => (typeof b === "number" ? new Date(b) : bucketToDate(b)).getUTCFullYear();
  return year(buckets[0]) !== year(buckets[buckets.length - 1]);
}

/** Compact axis tick for a bucket. */
export function formatBucketTick(bucket: string | number, granularity: Granularity, withYear: boolean): string {
  const date = typeof bucket === "number" ? new Date(bucket) : bucketToDate(bucket);
  if (granularity === "month") return (withYear ? monthShortYear : monthShort).format(date);
  return (withYear ? dayShortYear : dayShort).format(date);
}

/** Full, unambiguous bucket description for tooltips. `label` is the API label (e.g. "2026-W47"). */
export function formatBucketFull(bucket: string | number, granularity: Granularity, label?: string): string {
  const date = typeof bucket === "number" ? new Date(bucket) : bucketToDate(bucket);
  if (granularity === "day") return dayFull.format(date);
  if (granularity === "month") return monthFull.format(date);
  const end = new Date(date.getTime() + 6 * 86_400_000);
  const match = label?.match(/^(\d{4})-W(\d{2})$/);
  const week = match ? `Week ${Number(match[2])}, ${match[1]}` : "Week of";
  return `${week} (${dayShort.format(date)} – ${dayShortYear.format(end)})`;
}

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "3 days ago", "yesterday", "just now". */
export function formatRelative(date: Date | string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

/** Full local timestamp with zone, for hover titles. */
export const formatDateTime = (date: Date | string) => dateTime.format(new Date(date));

/** Pick at most `max` evenly spaced items (always including the first and last). */
export function evenlySpaced<T>(items: ReadonlyArray<T>, max: number): T[] {
  if (items.length <= max) return [...items];
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]);
}
