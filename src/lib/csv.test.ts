import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv.ts";

describe("csvField", () => {
  it("leaves plain values alone", () => {
    expect(csvField("hello")).toBe("hello");
    expect(csvField(42)).toBe("42");
    expect(csvField(null)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("@cmd")).toBe("'@cmd");
  });

  it("quotes values with leading or trailing spaces", () => {
    expect(csvField(" padded ")).toBe('" padded "');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and ends with a newline", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
