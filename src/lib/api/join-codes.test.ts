import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

vi.mock("./bearer", () => ({
  jsonAuthHeaders: async () => ({ Authorization: "Bearer t", "Content-Type": "application/json" }),
}));

import { getWorkspaceJoinCode, redeemJoinCode, regenerateWorkspaceJoinCode } from "./join-codes";

describe("join code API", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("redeems a code via the rate-limited RPC", async () => {
    rpc.mockResolvedValue({ data: "ws-1", error: null });
    await expect(redeemJoinCode({ code: " 7k3m9pq2 " })).resolves.toBe("ws-1");
    expect(rpc).toHaveBeenCalledWith("redeem_join_code", { p_code: "7k3m9pq2" });
  });

  it("maps invalid-code errors to a friendly message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "That join code is not valid" } });
    await expect(redeemJoinCode({ code: "BADCODE1" })).rejects.toThrow(/not valid/i);
  });

  it("loads and regenerates codes for editors", async () => {
    rpc.mockResolvedValueOnce({ data: "ABCD2345", error: null });
    await expect(getWorkspaceJoinCode({ workspaceId: "ws-1" })).resolves.toBe("ABCD2345");
    expect(rpc).toHaveBeenCalledWith("get_workspace_join_code", { p_workspace_id: "ws-1" });

    rpc.mockResolvedValueOnce({ data: "NEWER123", error: null });
    await expect(regenerateWorkspaceJoinCode({ workspaceId: "ws-1" })).resolves.toBe("NEWER123");
    expect(rpc).toHaveBeenCalledWith("regenerate_workspace_join_code", { p_workspace_id: "ws-1" });
  });
});
