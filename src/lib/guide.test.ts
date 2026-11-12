import { describe, expect, it } from "vitest";
import { EMPTY_GUIDE, LESSONS, finishLesson, lessonToOffer, nextLessonAfter, resolveRoute } from "./guide";

describe("guided tour schedule", () => {
  it("offers the first lesson on the first visit", () => {
    expect(lessonToOffer({ ...EMPTY_GUIDE, visits: 1 })?.id).toBe("basics");
  });

  it("holds the second lesson back until the second visit", () => {
    const afterFirst = finishLesson({ ...EMPTY_GUIDE, visits: 1 }, "basics");
    expect(lessonToOffer(afterFirst)).toBeNull();
    expect(lessonToOffer({ ...afterFirst, visits: 2 })?.id).toBe("share");
  });

  it("offers the lesson someone skipped past when they come back later", () => {
    expect(lessonToOffer({ visits: 5, done: [], off: false })?.id).toBe("basics");
  });

  it("goes quiet once every lesson is done or the guide is turned off", () => {
    expect(lessonToOffer({ visits: 9, done: LESSONS.map((l) => l.id), off: false })).toBeNull();
    expect(lessonToOffer({ visits: 1, done: [], off: true })).toBeNull();
  });

  it("names the lesson that comes next", () => {
    expect(nextLessonAfter("basics")?.id).toBe("share");
    expect(nextLessonAfter("measure")).toBeNull();
  });

  it("opens the share stop on a published study when there is one", () => {
    const stop = LESSONS[1].stops[0];
    expect(resolveRoute(stop, "abc")).toBe("/studies/abc?step=review");
    expect(resolveRoute(stop, null)).toBe("/studies");
  });

  it("gives every stop a unique id", () => {
    const ids = LESSONS.flatMap((l) => l.stops.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
