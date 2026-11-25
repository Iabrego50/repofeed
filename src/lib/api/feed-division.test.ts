import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const from = vi.fn();
const eqCalls: Array<[string, unknown]> = [];

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => authGetUser(...args) },
    from: (...args: unknown[]) => from(...args),
  },
}));

vi.mock("./mappers", () => ({
  mapReel: (row: { id: string }) => ({ _id: row.id, id: row.id }),
}));

import { listReels } from "./feed-complete";

function memberQuery() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "member" }, error: null }),
        }),
      }),
    }),
  };
}

function reelsQuery(rows: unknown[]) {
  const query: Record<string, unknown> = {};
  const self = () => query;
  query.select = self;
  query.order = self;
  query.limit = self;
  query.eq = (col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return query;
  };
  query.then = (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return query;
}

describe("listReels division routing", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    authGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    from.mockReset();
  });

  it("filters by studies.division when a division slug is provided", async () => {
    from.mockImplementation((table: string) => {
      if (table === "workspace_members") return memberQuery();
      return reelsQuery([{ id: "r1" }]);
    });

    const result = await listReels({ workspaceId: "ws-1", division: "auto" });
    expect(result).toEqual([{ _id: "r1", id: "r1" }]);
    expect(eqCalls).toContainEqual(["studies.division", "auto"]);
    expect(eqCalls).toContainEqual(["studies.status", "published"]);
  });
});
