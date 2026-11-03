import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const CLIENT_ENTRY = resolve(ROOT, "src/main.tsx");

function walkClientGraph(entry: string): string[] {
  const files = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      enqueue(file, match[1], source, match.index ?? 0, queue);
    }
    for (const match of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      enqueue(file, match[1], source, match.index ?? 0, queue);
    }
  }
  return [...files];
}

function enqueue(fromFile: string, specifier: string, source: string, index: number, queue: string[]) {
  const statement = source.slice(Math.max(0, index - 80), index + specifier.length + 20);
  if (/^(?:import|export)\s+type\s+/.test(statement.trimStart()) || specifier === "stripe" || specifier.startsWith("stripe/")) {
    if (specifier === "stripe" || specifier.startsWith("stripe/")) {
      throw new Error(`${fromFile} imports Stripe SDK (${specifier})`);
    }
  }
  if (specifier === "stripe" || specifier.startsWith("stripe/")) {
    throw new Error(`${fromFile} imports Stripe SDK (${specifier})`);
  }
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return;
  const resolved = specifier.startsWith("@/")
    ? resolve(ROOT, "src", specifier.slice(2))
    : resolve(dirname(fromFile), specifier);
  for (const candidate of candidates(resolved)) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      queue.push(candidate);
      return;
    }
  }
}

function candidates(base: string): string[] {
  if (extname(base)) return [base];
  return ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].map((suffix) => base + suffix);
}

describe("client bundle keeps Stripe server-side", () => {
  it("does not import the Stripe SDK or stripe.ts from the browser entry", () => {
    const files = walkClientGraph(CLIENT_ENTRY);
    expect(files.some((file) => file.endsWith("src/main.tsx"))).toBe(true);
    expect(files.some((file) => /billing\/stripe\.ts$/.test(file))).toBe(false);
    for (const file of files) {
      if (!existsSync(file) || file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/api\.stripe\.com/);
      expect(source, file).not.toMatch(/from ['"]stripe['"]/);
    }
  });

  it("fails if a production client chunk contains Stripe SDK or api.stripe.com", () => {
    const assets = resolve(ROOT, "dist/assets");
    if (!existsSync(assets)) return;
    for (const name of readdirSync(assets)) {
      if (!name.endsWith(".js")) continue;
      const source = readFileSync(resolve(assets, name), "utf8");
      expect(source, name).not.toMatch(/api\.stripe\.com/);
      expect(source, name).not.toMatch(/STRIPE_SECRET_KEY/);
      expect(source, name).not.toMatch(/Checkout\.sessions\.create/);
    }
  });
});
