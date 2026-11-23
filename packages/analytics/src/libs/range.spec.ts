import { BadRequestException } from "@nestjs/common";
import {
  bucketLabel,
  fillBuckets,
  isoWeek,
  parseGranularity,
  parseRangeKey,
  resolveRange,
  truncateUtc,
} from "./range";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("parseRangeKey / parseGranularity", () => {
  it("accepts known values and falls back when missing", () => {
    expect(parseRangeKey("7d")).toBe("7d");
    expect(parseRangeKey(undefined)).toBe("30d");
    expect(parseGranularity("month")).toBe("month");
    expect(parseGranularity("")).toBe("day");
  });

  it("rejects unknown values with 400", () => {
    expect(() => parseRangeKey("1y")).toThrow(BadRequestException);
    expect(() => parseGranularity("hour")).toThrow(BadRequestException);
  });
});

describe("resolveRange", () => {
  const now = new Date("2026-11-23T15:30:00.000Z");

  it("covers N calendar days including today, with an equal previous period", () => {
    const r = resolveRange("7d", null, now);
    expect(r.from).toEqual(utc("2026-11-17"));
    expect(r.to).toEqual(now);
    expect(r.prevFrom).toEqual(utc("2026-11-10"));
    expect(r.prevTo).toEqual(utc("2026-11-17"));
  });

  it("starts 'all' at the earliest record and has no previous period", () => {
    const r = resolveRange("all", new Date("2025-06-02T12:51:01Z"), now);
    expect(r.from).toEqual(utc("2025-06-02"));
    expect(r.prevFrom).toBeNull();
    expect(r.prevTo).toBeNull();
  });
});

describe("ISO weeks", () => {
  it("truncates to Monday", () => {
    expect(truncateUtc(utc("2026-11-22"), "week")).toEqual(utc("2026-11-16")); // Sunday
    expect(truncateUtc(utc("2026-11-23"), "week")).toEqual(utc("2026-11-23")); // Monday
  });

  it("numbers weeks across year boundaries", () => {
    expect(isoWeek(utc("2026-01-01"))).toEqual({ year: 2026, week: 1 }); // Thursday
    expect(isoWeek(utc("2027-01-01"))).toEqual({ year: 2026, week: 53 }); // Friday
    expect(isoWeek(utc("2024-12-30"))).toEqual({ year: 2025, week: 1 }); // Monday
    expect(bucketLabel(utc("2026-11-16"), "week")).toBe("2026-W47");
  });

  it("labels months and days", () => {
    expect(bucketLabel(utc("2026-11-01"), "month")).toBe("2026-11");
    expect(bucketLabel(utc("2026-11-05"), "day")).toBe("2026-11-05");
  });
});

describe("fillBuckets", () => {
  it("fills missing days with zero and keeps existing values", () => {
    const rows = [
      { bucket: new Date("2026-11-20T00:00:00Z"), users: 4 },
      { bucket: new Date("2026-11-22T00:00:00Z"), users: 1 },
    ];
    const filled = fillBuckets(rows, {
      from: utc("2026-11-20"),
      to: new Date("2026-11-22T10:00:00Z"),
      granularity: "day",
      keys: ["users"] as const,
    });
    expect(filled).toEqual([
      { bucket: "2026-11-20", label: "2026-11-20", users: 4 },
      { bucket: "2026-11-21", label: "2026-11-21", users: 0 },
      { bucket: "2026-11-22", label: "2026-11-22", users: 1 },
    ]);
  });

  it("produces continuous months across a year boundary", () => {
    const filled = fillBuckets([], {
      from: utc("2025-11-15"),
      to: utc("2026-02-03"),
      granularity: "month",
      keys: ["users"] as const,
    });
    expect(filled.map((b) => b.label)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
