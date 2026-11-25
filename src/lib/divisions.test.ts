import { describe, expect, it } from "vitest";
import {
  DIVISION_LABELS,
  DIVISION_SLUGS,
  divisionFeedPath,
  isDivisionSlug,
  parseDivisionParam,
} from "./divisions";

describe("divisions", () => {
  it("exposes the five phone channels", () => {
    expect(DIVISION_SLUGS).toEqual(["auto", "gi", "wood", "marine", "website"]);
    expect(DIVISION_LABELS.gi).toBe("GI");
    expect(DIVISION_LABELS.auto).toBe("Auto");
  });

  it("validates and routes division slugs", () => {
    expect(isDivisionSlug("auto")).toBe(true);
    expect(isDivisionSlug("food")).toBe(false);
    expect(parseDivisionParam("marine")).toBe("marine");
    expect(parseDivisionParam("nope")).toBeUndefined();
    expect(divisionFeedPath("wood")).toBe("/d/wood");
  });
});
