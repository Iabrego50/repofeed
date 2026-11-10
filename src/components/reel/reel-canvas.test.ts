import { describe, expect, it } from "vitest";
import { shouldAttachReelFootage } from "./footage-preload";

describe("shouldAttachReelFootage", () => {
  it("skips the network until a clip with preload=none actually plays", () => {
    expect(shouldAttachReelFootage(false, "none")).toBe(false);
    expect(shouldAttachReelFootage(true, "none")).toBe(true);
  });

  it("still fetches a metadata frame for neighbouring feed scenes", () => {
    expect(shouldAttachReelFootage(false)).toBe(true);
    expect(shouldAttachReelFootage(false, "metadata")).toBe(true);
    expect(shouldAttachReelFootage(true, "auto")).toBe(true);
  });
});
