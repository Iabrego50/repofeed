import { describe, expect, it } from "vitest";
import {
  normalizeText,
  buildSourceIndex,
  verifyQuote,
  verifyNumber,
  verifyScenes,
  WARNINGS,
} from "./verify";

const sampleText = `It stopped feeling like help and started feeling like homework.
If they'd just let me pause for a month I would have stayed.
46% of users (n=1,140) reported this issue.
The 30-minute meals take me 50 minutes. Every single time.
Median wait was 6.5 minutes across sites.
7 of 10 people mentioned calendar stress, and 17 min average planning time.`;

const source = buildSourceIndex(sampleText);

describe("normalizeText", () => {
  it("lowercases, unifies curly quotes and dashes, and collapses whitespace", () => {
    const input = "  It's  \u201CGREAT\u201D \u2014 really\n\tok ";
    expect(normalizeText(input)).toBe("it's great - really ok");
  });

  it("keeps % . ' - and strips other punctuation", () => {
    expect(normalizeText("46%, (n=1,140)! 6.5 min; don't-stop")).toBe(
      "46% n 1 140 6.5 min don't-stop"
    );
  });
});

describe("verifyQuote", () => {
  it("passes a verbatim quote", () => {
    expect(
      verifyQuote(
        "It stopped feeling like help and started feeling like homework.",
        source
      )
    ).toBe("ok");
  });

  it("passes with curly apostrophes and different casing", () => {
    expect(
      verifyQuote(
        "if they'd just let me pause for a month I would have stayed",
        source
      )
    ).toBe("ok");
  });

  it("flags a quote with one changed word as close", () => {
    expect(
      verifyQuote(
        "It stopped feeling like help and started feeling like work.",
        source
      )
    ).toBe("close");
  });

  it("flags a quote with an added word", () => {
    expect(
      verifyQuote(
        "It quickly stopped feeling like help and started feeling like homework.",
        source
      )
    ).not.toBe("ok");
  });

  it("marks an invented quote missing", () => {
    expect(
      verifyQuote(
        "The delivery driver was always rude to my neighbours.",
        source
      )
    ).toBe("missing");
  });
});

describe("verifyNumber", () => {
  it("accepts numbers that appear in the source", () => {
    expect(verifyNumber("46%", source)).toBeNull();
    expect(verifyNumber("7 of 10", source)).toBeNull();
    expect(verifyNumber("17 min", source)).toBeNull();
  });

  it("matches a decimal like 6.5 min", () => {
    const idx = buildSourceIndex("Median wait was 6.5 minutes across sites.");
    expect(verifyNumber("6.5 min", idx)).toBeNull();
    expect(verifyNumber("6 min", idx)).toBe("6");
  });

  it("rejects numbers that only appear inside a larger number", () => {
    expect(verifyNumber("114", source)).toBe("114");
  });

  it("returns the missing digit group", () => {
    expect(verifyNumber("73%", source)).toBe("73");
  });
});

describe("verifyScenes", () => {
  it("returns null for valid scenes", () => {
    const scenes = [
      {
        type: "quote" as const,
        text: "It stopped feeling like help and started feeling like homework.",
        by: "P01",
      },
      {
        type: "stat" as const,
        num: "46%",
        label: "reported issue",
      },
    ];
    expect(verifyScenes(scenes, source)).toBeNull();
  });

  it("returns the number warning text", () => {
    const scenes = [{ type: "stat" as const, num: "88%", label: "x" }];
    expect(verifyScenes(scenes, source)).toBe(WARNINGS.number("88%"));
  });

  it("names the quote that didn't match", () => {
    const scenes = [
      {
        type: "quote" as const,
        text: "We never ordered pizza on a Tuesday night ever again",
        by: "x",
      },
    ];
    const warning = verifyScenes(scenes, source);
    expect(warning).toBe(
      WARNINGS.quoteMissing(
        "We never ordered pizza on a Tuesday night ever again"
      )
    );
    expect(warning).toContain("We never ordered pizza on a Tuesday night…");
  });

  it("flags an edited quote", () => {
    const scenes = [
      {
        type: "quote" as const,
        text: "The 30-minute meals take me 50. Every single time, honestly.",
        by: "x",
      },
    ];
    const warning = verifyScenes(scenes, source);
    expect(warning).not.toBeNull();
  });
});
