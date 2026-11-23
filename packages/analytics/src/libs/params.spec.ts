import { BadRequestException } from "@nestjs/common";
import {
  csvCell,
  parseActionType,
  parseIntParam,
  parseOrder,
  parseSort,
  parseText,
  parseTimeZone,
  toCsv,
} from "./params";

describe("query params", () => {
  it("parses bounded integers with a fallback", () => {
    const opts = { name: "page", fallback: 1, min: 1, max: 10 };
    expect(parseIntParam(undefined, opts)).toBe(1);
    expect(parseIntParam("3", opts)).toBe(3);
    expect(() => parseIntParam("0", opts)).toThrow(BadRequestException);
    expect(() => parseIntParam("2.5", opts)).toThrow(BadRequestException);
    expect(() => parseIntParam("11", opts)).toThrow(BadRequestException);
  });

  it("whitelists action type, sort and order", () => {
    expect(parseActionType("all")).toBeUndefined();
    expect(parseActionType("DEPLOY")).toBe("DEPLOY");
    expect(() => parseActionType("COMPILE")).toThrow(BadRequestException);
    expect(parseSort(undefined)).toBe("timestamp");
    expect(() => parseSort('createdAt"; --')).toThrow(BadRequestException);
    expect(parseOrder("asc")).toBe("asc");
    expect(() => parseOrder("up")).toThrow(BadRequestException);
  });

  it("trims text and rejects arrays", () => {
    expect(parseText("  GABC ", "q")).toBe("GABC");
    expect(parseText("   ", "q")).toBeUndefined();
    expect(() => parseText(["a", "b"], "q")).toThrow(BadRequestException);
  });

  it("only passes plausible IANA zone names through", () => {
    expect(parseTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
    expect(parseTimeZone("America/Argentina/Buenos_Aires")).toBe(
      "America/Argentina/Buenos_Aires",
    );
    expect(parseTimeZone("';DROP TABLE")).toBe("UTC");
    expect(parseTimeZone(undefined)).toBe("UTC");
  });
});

describe("CSV", () => {
  it("quotes separators and neutralises spreadsheet formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });

  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
