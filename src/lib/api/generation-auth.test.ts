import { describe, expect, it } from "vitest";
import {
  AuthError,
  GENERATION_INTERNAL_SECRET_HEADER,
  bearerToken,
  isInternalGenerationCall,
  secretsMatch,
} from "../../../api/_lib/auth";
import { generationJobInsert } from "../../../api/generation/start";

describe("generation API auth helpers", () => {
  it("reads a bearer token and rejects missing auth", () => {
    expect(bearerToken({ headers: { authorization: "Bearer abc.def" } })).toBe("abc.def");
    expect(bearerToken({ headers: {} })).toBeUndefined();
    expect(new AuthError(401, "Unauthorized").status).toBe(401);
    expect(new AuthError(403, "Forbidden").status).toBe(403);
    expect(new AuthError(404, "Not found").status).toBe(404);
  });

  it("accepts an internal generation secret with a timing-safe compare", () => {
    const env = { GENERATION_INTERNAL_SECRET: "super-secret" };
    expect(
      isInternalGenerationCall({ headers: { [GENERATION_INTERNAL_SECRET_HEADER]: "super-secret" } }, env),
    ).toBe(true);
    expect(
      isInternalGenerationCall({ headers: { generation_internal_secret: "super-secret" } }, env),
    ).toBe(true);
    expect(
      isInternalGenerationCall({ headers: { [GENERATION_INTERNAL_SECRET_HEADER]: "nope" } }, env),
    ).toBe(false);
    expect(isInternalGenerationCall({ headers: {} }, env)).toBe(false);
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abc", "ab")).toBe(false);
  });

  it("sets started_by on the generation job insert", () => {
    const payload = generationJobInsert({
      studyId: "study-1",
      workspaceId: "ws-1",
      startedBy: "user-42",
      chunks: [{ source_id: "src-1", name: "notes.md", start: 0, end: 12 }],
      sourceCount: 1,
    });
    expect(payload.started_by).toBe("user-42");
    expect(payload.study_id).toBe("study-1");
    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.status).toBe("queued");
  });
});
