import { afterEach, describe, expect, it } from "vitest";
import {
  addLocalComment,
  buildDemoReels,
  HINT_STORAGE_KEY,
  initialInteractionState,
  isTypingTarget,
  persistHintsDismissed,
  readHintsDismissed,
  toggleHeart,
  toggleSave,
  VISITOR_NAME,
} from "./demo-interactions.ts";

const reels = buildDemoReels();

describe("demo interaction state", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("seeds hearts and mixed Note/Question/Action comments per scene", () => {
    const state = initialInteractionState(reels);
    expect(reels).toHaveLength(10);
    for (const reel of reels) {
      const scene = state[reel.id];
      expect(scene.hearted).toBe(false);
      expect(scene.saved).toBe(false);
      expect(scene.hearts).toBeGreaterThan(0);
      const kinds = new Set(scene.comments.map((c) => c.kind));
      expect(kinds.has("note")).toBe(true);
      expect(kinds.has("question")).toBe(true);
      expect(kinds.has("action")).toBe(true);
      expect(reel.findings.length).toBeGreaterThan(0);
      expect(reel.sources.length).toBeGreaterThan(0);
    }
  });

  it("toggles hearting and keeps the count in sync", () => {
    const id = reels[0].id;
    const start = initialInteractionState(reels);
    const hearts = start[id].hearts;
    const liked = toggleHeart(start, id);
    expect(liked[id].hearted).toBe(true);
    expect(liked[id].hearts).toBe(hearts + 1);
    const unlike = toggleHeart(liked, id);
    expect(unlike[id].hearted).toBe(false);
    expect(unlike[id].hearts).toBe(hearts);
  });

  it("toggles saving without touching other scenes", () => {
    const a = reels[0].id;
    const b = reels[1].id;
    const start = initialInteractionState(reels);
    const saved = toggleSave(start, a);
    expect(saved[a].saved).toBe(true);
    expect(saved[b].saved).toBe(false);
    expect(toggleSave(saved, a)[a].saved).toBe(false);
  });

  it("adds a local visitor comment and reply without dropping seeds", () => {
    const id = reels[0].id;
    const start = initialInteractionState(reels);
    const seeded = start[id].comments.length;
    const withNote = addLocalComment(
      start,
      id,
      { kind: "question", body: "  Can we ship pause first?  " },
      1_700_000_000_000,
    );
    expect(withNote[id].comments).toHaveLength(seeded + 1);
    const posted = withNote[id].comments.find(
      (c) => c.author?.name === VISITOR_NAME,
    );
    expect(posted?.body).toBe("Can we ship pause first?");
    expect(posted?.kind).toBe("question");
    const parentId = start[id].comments[0]._id;
    const withReply = addLocalComment(
      withNote,
      id,
      { kind: "note", body: "Yes — I'll take it.", parentId },
      1_700_000_000_001,
    );
    expect(
      withReply[id].comments.find((c) => c.body === "Yes — I'll take it.")
        ?.parentId,
    ).toBe(parentId);
  });

  it("ignores empty comments and unknown reel ids", () => {
    const start = initialInteractionState(reels);
    expect(
      addLocalComment(start, reels[0].id, { kind: "note", body: "   " }),
    ).toBe(start);
    expect(toggleHeart(start, "missing")).toBe(start);
    expect(toggleSave(start, "missing")).toBe(start);
  });

  it("treats inputs and textareas as typing targets", () => {
    const textarea = document.createElement("textarea");
    const input = document.createElement("input");
    const div = document.createElement("div");
    const editable = document.createElement("div");
    document.body.append(textarea, input, div, editable);
    editable.setAttribute("contenteditable", "true");
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("remembers dismissed coach marks in localStorage", () => {
    expect(readHintsDismissed()).toBe(false);
    persistHintsDismissed();
    expect(localStorage.getItem(HINT_STORAGE_KEY)).toBe("1");
    expect(readHintsDismissed()).toBe(true);
  });
});
