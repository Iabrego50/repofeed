import { describe, expect, it } from "vitest";
import { NATIVE_URL_SCHEME, pathFromAppUrl } from "./native";

describe("pathFromAppUrl", () => {
  it("maps custom-scheme auth callbacks to SPA paths", () => {
    expect(pathFromAppUrl(`${NATIVE_URL_SCHEME}://auth/callback?code=abc`)).toBe(
      "/auth/callback?code=abc",
    );
    expect(pathFromAppUrl(`${NATIVE_URL_SCHEME}://auth/confirm?token_hash=x&type=magiclink`)).toBe(
      "/auth/confirm?token_hash=x&type=magiclink",
    );
  });

  it("keeps https universal-link paths", () => {
    expect(pathFromAppUrl("https://repofeed.ai/auth/callback?code=1")).toBe(
      "/auth/callback?code=1",
    );
  });

  it("returns null for unparseable urls", () => {
    expect(pathFromAppUrl("not a url")).toBeNull();
  });
});
