import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({ fake: null as FakeSupabase | null }));

vi.mock("../supabase", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client };
});

function fake(): FakeSupabase {
  if (!bag.fake) throw new Error("fake supabase not initialized");
  return bag.fake;
}

import { api } from "./complete";

describe("paintStudy success counting", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "editor-1" });
  });

  it("counts only HTTP 2xx, not fulfilled 400s, and limits concurrency", async () => {
    fake().queue("reels", { data: [{ id: "r1" }, { id: "r2" }, { id: "r3" }] });
    let inflight = 0;
    let max = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      inflight += 1;
      max = Math.max(max, inflight);
      const reelId = JSON.parse(String(init?.body ?? "{}")).reelId;
      await Promise.resolve();
      inflight -= 1;
      if (reelId === "r1") return { ok: true, status: 200 };
      if (reelId === "r2") return { ok: false, status: 400 };
      return { ok: false, status: 403 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.art.paintStudy({ studyId: "study-1" });
    expect(result.queued).toBe(1);
    expect(max).toBeLessThanOrEqual(2);
    vi.unstubAllGlobals();
  });
});
