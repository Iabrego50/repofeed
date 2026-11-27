import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEMO_EMAIL_ERROR,
  isValidDemoEmail,
  submitDemoRequest,
} from "./demo-request.ts";

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase.ts", () => ({
  getBrowserSupabase: () => ({ from }),
}));

describe("demo-request", () => {
  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
    insert.mockResolvedValue({ error: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
  });

  it("validates email like the artboard", () => {
    expect(isValidDemoEmail("you@company.com")).toBe(true);
    expect(isValidDemoEmail("bad")).toBe(false);
    expect(isValidDemoEmail("a@b.c")).toBe(true);
    expect(isValidDemoEmail(" spaced@x.com ")).toBe(true);
  });

  it("inserts without select/returning", async () => {
    await submitDemoRequest("You@Company.com");
    expect(from).toHaveBeenCalledWith("demo_requests");
    expect(insert).toHaveBeenCalledWith({
      email: "you@company.com",
      source: "story",
      user_agent: expect.any(String),
    });
    // insert payload must not request returning rows
    expect(insert.mock.calls[0].length).toBe(1);
  });

  it("rejects invalid email before insert", async () => {
    await expect(submitDemoRequest("nope")).rejects.toThrow(DEMO_EMAIL_ERROR);
    expect(insert).not.toHaveBeenCalled();
  });
});
