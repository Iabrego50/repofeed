import { spawnSync } from "node:child_process";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const API_ENTRIES = [
  "api/generation/process.ts",
  "api/generation/start.ts",
  "api/generation/recover.ts",
  "api/stripe/webhook.ts",
  "api/stripe/checkout.ts",
  "api/stripe/portal.ts",
  "api/billing/plan.ts",
  "api/art/paint.ts",
  "api/videos/process.ts",
  "api/videos/backfill.ts",
  "api/decks/generate.ts",
  "api/admin/ai-models.ts",
];

function isForbiddenApiImport(specifier: string, statement: string) {
  const idx = Math.max(statement.lastIndexOf("import"), statement.lastIndexOf("export"));
  const typeOnly = idx >= 0 && /^(?:import|export)\s+type\s+/.test(statement.slice(idx));
  if (typeOnly) return null;
  if (specifier.startsWith("@/")) return `alias ${specifier}`;
  if (specifier.startsWith(".") && !extname(specifier)) return `extensionless ${specifier}`;
  return null;
}

describe("Vercel /api ESM load", () => {
  it("rejects the old @/ alias and extensionless relative imports", () => {
    expect(
      isForbiddenApiImport("@/lib/supabase", "import { supabase } from '@/lib/supabase'"),
    ).toMatch(/alias/);
    expect(
      isForbiddenApiImport("../../src/lib/ai/client", "import { callTool } from '../../src/lib/ai/client'"),
    ).toMatch(/extensionless/);
    expect(
      isForbiddenApiImport("../_lib/supabase.js", "import { supabase } from '../_lib/supabase.js'"),
    ).toBeNull();
    expect(
      isForbiddenApiImport(
        "@/schema/validators",
        "import type { Scene } from '@/schema/validators'",
      ),
    ).toBeNull();
  });

  it("imports each /api function under Node 22 ESM after TS transpile", () => {
    const result = spawnSync(process.execPath, [resolve("scripts/check-api-esm.mjs")], {
      encoding: "utf8",
      cwd: resolve("."),
    });
    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/ok: imported with env unset/);
    expect(result.stdout).toMatch(/Server not configured:.*missing/);
    for (const entry of API_ENTRIES) {
      expect(result.stdout).toContain(entry);
    }
  });
});
