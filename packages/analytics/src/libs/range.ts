import { BadRequestException } from "@nestjs/common";

/**
 * Date-range and time-bucket helpers for analytics queries.
 * All bucketing is done in UTC so it matches Postgres `date_trunc` on the
 * (UTC) timestamps Prisma stores.
 */

export const RANGE_KEYS = ["7d", "30d", "90d", "all"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export interface ResolvedRange {
  key: RangeKey;
  /** Inclusive start (UTC midnight). */
  from: Date;
  /** Exclusive end (now). */
  to: Date;
  /** Previous period of the same length; null for "all". */
  prevFrom: Date | null;
  prevTo: Date | null;
}

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function parseRangeKey(
  raw: unknown,
  fallback: RangeKey = "30d",
): RangeKey {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (
    typeof raw === "string" &&
    (RANGE_KEYS as readonly string[]).includes(raw)
  )
    return raw as RangeKey;
  throw new BadRequestException(
    `range must be one of ${RANGE_KEYS.join(", ")}`,
  );
}

export function parseGranularity(
  raw: unknown,
  fallback: Granularity = "day",
): Granularity {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (
    typeof raw === "string" &&
    (GRANULARITIES as readonly string[]).includes(raw)
  )
    return raw as Granularity;
  throw new BadRequestException(
    `granularity must be one of ${GRANULARITIES.join(", ")}`,
  );
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * "7d" means the last 7 calendar days including today (UTC). The previous
 * period is the 7 days immediately before that. "all" starts at the earliest
 * recorded activity and has no previous period.
 */
export function resolveRange(
  key: RangeKey,
  earliest: Date | null,
  now: Date = new Date(),
): ResolvedRange {
  if (key === "all") {
    return {
      key,
      from: startOfUtcDay(earliest ?? now),
      to: now,
      prevFrom: null,
      prevTo: null,
    };
  }
  const days = RANGE_DAYS[key];
  const from = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY_MS);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  return { key, from, to: now, prevFrom, prevTo: from };
}

/** Truncate to the start of the bucket (ISO weeks start on Monday), like Postgres date_trunc. */
export function truncateUtc(date: Date, granularity: Granularity): Date {
  const day = startOfUtcDay(date);
  if (granularity === "day") return day;
  if (granularity === "week") {
    const isoDay = (day.getUTCDay() + 6) % 7; // Monday = 0
    return new Date(day.getTime() - isoDay * DAY_MS);
  }
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

export function addBuckets(
  date: Date,
  granularity: Granularity,
  amount: number,
): Date {
  if (granularity === "day") return new Date(date.getTime() + amount * DAY_MS);
  if (granularity === "week")
    return new Date(date.getTime() + amount * 7 * DAY_MS);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
  );
}

/** ISO-8601 week-numbering year and week, e.g. 2026-01-01 → { year: 2026, week: 1 }. */
export function isoWeek(date: Date): { year: number; week: number } {
  const day = startOfUtcDay(date);
  const isoDay = (day.getUTCDay() + 6) % 7;
  // Thursday of this week decides the ISO year.
  const thursday = new Date(day.getTime() + (3 - isoDay) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekStart = truncateUtc(firstThursday, "week");
  const week =
    1 +
    Math.round(
      (truncateUtc(day, "week").getTime() - firstWeekStart.getTime()) /
        (7 * DAY_MS),
    );
  return { year, week };
}

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Stable bucket label: 2026-11-23 (day), 2026-W47 (ISO week), 2026-11 (month). */
export function bucketLabel(bucket: Date, granularity: Granularity): string {
  if (granularity === "day") return isoDate(bucket);
  if (granularity === "week") {
    const { year, week } = isoWeek(bucket);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  return isoDate(bucket).slice(0, 7);
}

export type Bucketed<K extends string> = {
  bucket: string;
  label: string;
} & Record<K, number>;

/**
 * Turn sparse query rows into a continuous series from `from` to `to`,
 * filling missing buckets with 0.
 */
export function fillBuckets<K extends string>(
  rows: ReadonlyArray<{ bucket: Date | string } & Partial<Record<K, unknown>>>,
  {
    from,
    to,
    granularity,
    keys,
  }: { from: Date; to: Date; granularity: Granularity; keys: readonly K[] },
): Bucketed<K>[] {
  const byBucket = new Map<string, Partial<Record<K, unknown>>>();
  for (const row of rows) {
    byBucket.set(isoDate(truncateUtc(new Date(row.bucket), granularity)), row);
  }

  const result: Bucketed<K>[] = [];
  const last = truncateUtc(to, granularity);
  for (
    let b = truncateUtc(from, granularity);
    b <= last;
    b = addBuckets(b, granularity, 1)
  ) {
    const key = isoDate(b);
    const row = byBucket.get(key);
    const entry = {
      bucket: key,
      label: bucketLabel(b, granularity),
    } as Bucketed<K>;
    for (const k of keys) {
      (entry as Record<string, unknown>)[k] = row ? Number(row[k] ?? 0) : 0;
    }
    result.push(entry);
  }
  return result;
}
