import { BadRequestException } from "@nestjs/common";
import { TransactionType } from "@prisma/client";

/** Query-string parsing for analytics endpoints (no global ValidationPipe is installed). */

export function parseIntParam(
  raw: unknown,
  {
    name,
    fallback,
    min,
    max,
  }: { name: string; fallback: number; min: number; max: number },
): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(
      `${name} must be an integer between ${min} and ${max}`,
    );
  }
  return value;
}

export function parseActionType(raw: unknown): TransactionType | undefined {
  if (raw === undefined || raw === null || raw === "" || raw === "all")
    return undefined;
  if (raw === TransactionType.DEPLOY || raw === TransactionType.INVOKE)
    return raw;
  throw new BadRequestException("type must be DEPLOY, INVOKE or all");
}

export const ACTIVITY_SORTS = [
  "timestamp",
  "action",
  "wallet",
  "contract",
] as const;
export type ActivitySort = (typeof ACTIVITY_SORTS)[number];
export type SortOrder = "asc" | "desc";

export function parseSort(raw: unknown): ActivitySort {
  if (raw === undefined || raw === null || raw === "") return "timestamp";
  if (
    typeof raw === "string" &&
    (ACTIVITY_SORTS as readonly string[]).includes(raw)
  )
    return raw as ActivitySort;
  throw new BadRequestException(
    `sort must be one of ${ACTIVITY_SORTS.join(", ")}`,
  );
}

export function parseOrder(raw: unknown): SortOrder {
  if (raw === undefined || raw === null || raw === "") return "desc";
  if (raw === "asc" || raw === "desc") return raw;
  throw new BadRequestException("order must be asc or desc");
}

/** Free-text search / wallet filter: trimmed, bounded, undefined when empty. */
export function parseText(
  raw: unknown,
  name: string,
  maxLength = 128,
): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string")
    throw new BadRequestException(`${name} must be a string`);
  const value = raw.trim();
  if (value.length > maxLength)
    throw new BadRequestException(`${name} is too long`);
  return value || undefined;
}

/** IANA zone names only (letters, digits, "/", "_", "+", "-"); validated against Postgres later. */
export function parseTimeZone(raw: unknown): string {
  if (typeof raw !== "string" || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(raw))
    return "UTC";
  return raw;
}

export type CsvValue = string | number | boolean | Date | null | undefined;

/** RFC 4180 CSV cell, with formula-injection protection for spreadsheet apps. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  header: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<CsvValue>>,
): string {
  return (
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
