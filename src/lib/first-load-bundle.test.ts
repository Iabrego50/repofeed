import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const CLIENT_ENTRY = resolve(ROOT, "src/main.tsx");
const PUBLIC_ENTRY = resolve(ROOT, "src/pages/landing/public-entry.tsx");

function walkStaticGraph(entry: string): string[] {
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
  }
  return [...files];
}

function enqueue(
  fromFile: string,
  specifier: string,
  source: string,
  index: number,
  queue: string[],
) {
  const statement = source.slice(
    Math.max(0, index - 80),
    index + specifier.length + 20,
  );
  if (/^(?:import|export)\s+type\s+/.test(statement.trimStart())) return;
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
  return ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].map(
    (suffix) => base + suffix,
  );
}

function rel(file: string): string {
  return file.slice(ROOT.length + 1);
}

describe("first-load JS graph stays off the heavy routes", () => {
  it("does not statically import the complete API, charts, or pptx from the shell", () => {
    const files = walkStaticGraph(CLIENT_ENTRY).map(rel);
    expect(files).toContain("src/main.tsx");
    expect(files).toContain("src/pages/landing/public-entry.tsx");
    expect(files).not.toContain("src/lib/api/complete.ts");
    expect(files).not.toContain("src/lib/api/feed-complete.ts");
    expect(files).not.toContain("src/lib/extract.ts");
    expect(files).not.toContain("src/components/ui/chart.tsx");
    expect(files).not.toContain(
      "src/pages/insights/deck/_components/slide-charts.tsx",
    );
    expect(files).not.toContain("src/pages/insights/deck/_lib/export-pptx.ts");
    expect(files).not.toContain("src/components/app-layout.tsx");
    expect(files).not.toContain("src/pages/landing/page.tsx");
  });

  it("resolves share tokens from public-entry without importing the complete client", () => {
    const source = readFileSync(PUBLIC_ENTRY, "utf8");
    expect(source).not.toMatch(/lib\/api\/complete/);
    expect(source).toMatch(/import\("@\/lib\/api\/share"\)/);
    const files = walkStaticGraph(PUBLIC_ENTRY).map(rel);
    expect(files).not.toContain("src/lib/api/complete.ts");
    expect(files).not.toContain("src/lib/api/share.ts");
  });

  it("does not force lazily used vendors into named chunks that index.html preloads", () => {
    const config = readFileSync(resolve(ROOT, "vite.config.ts"), "utf8");
    expect(config).not.toMatch(/node_modules\/recharts/);
    expect(config).not.toMatch(/node_modules\/pptxgenjs/);
    expect(config).not.toMatch(/node_modules\/jszip/);
    expect(config).not.toMatch(/node_modules\/motion/);
  });

  it("does not modulepreload charts or pptx from the built app shell", () => {
    const htmlPath = resolve(ROOT, "dist/index.html");
    if (!existsSync(htmlPath)) return;
    const html = readFileSync(htmlPath, "utf8");
    expect(html).not.toMatch(/assets\/charts-/);
    expect(html).not.toMatch(/assets\/pptx-/);
  });
});
