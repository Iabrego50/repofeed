#!/usr/bin/env node
/**
 * Transpile /api TypeScript the way Vercel does (strip types, keep import
 * specifiers) and import each function under plain Node 22 ESM.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "node_modules", ".tmp", "api-esm");

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
  "api/admin/analytics.ts",
];

export function isTypeOnlyImport(statement) {
  const idx = Math.max(statement.lastIndexOf("import"), statement.lastIndexOf("export"));
  if (idx < 0) return false;
  return /^(?:import|export)\s+type\s+/.test(statement.slice(idx));
}

export function isForbiddenApiImport(specifier, statement) {
  if (isTypeOnlyImport(statement)) return null;
  if (specifier.startsWith("@/")) return `alias ${specifier}`;
  if (specifier.startsWith(".") && !extname(specifier)) return `extensionless ${specifier}`;
  return null;
}

export function scanImports(source) {
  const found = [];
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const statement = source.slice(Math.max(0, match.index - 120), match.index + match[0].length);
    found.push({ specifier: match[1], statement });
  }
  for (const match of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push({ specifier: match[1], statement: match[0] });
  }
  return found;
}

async function listApiFiles(dir = join(ROOT, "api")) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listApiFiles(full)));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  if (base.endsWith(".js")) return base.slice(0, -3) + ".ts";
  return base.endsWith(".ts") ? base : `${base}.ts`;
}

async function collectGraph(entries) {
  const files = new Set();
  const queue = entries.map((rel) => resolve(ROOT, rel));
  while (queue.length) {
    const file = queue.pop();
    if (files.has(file)) continue;
    files.add(file);
    const source = await readFile(file, "utf8");
    for (const { specifier, statement } of scanImports(source)) {
      if (isTypeOnlyImport(statement)) continue;
      const next = resolveLocal(file, specifier);
      if (next) queue.push(next);
    }
  }
  return [...files];
}

async function transpileGraph(files) {
  await rm(OUT, { recursive: true, force: true });
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.None,
      },
      fileName: file,
      reportDiagnostics: false,
    });
    const rel = relative(ROOT, file).replace(/\.ts$/, ".js");
    const dest = join(OUT, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, result.outputText);
  }
}

const SECRET_ENV = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PORTAL_CONFIGURATION",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
];

function unsetRuntimeEnv() {
  for (const key of SECRET_ENV) delete process.env[key];
}

function mockResponse() {
  const out = { statusCode: 0, body: null };
  const res = {
    status(code) {
      out.statusCode = code;
      return res;
    },
    json(body) {
      out.body = body;
      return res;
    },
    send(body) {
      out.body = typeof body === "string" ? JSON.parse(body) : body;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return { res, out };
}

async function importEntries(entries) {
  unsetRuntimeEnv();
  const loaded = [];
  const probed = [];
  for (const rel of entries) {
    const compiled = join(OUT, rel.replace(/\.ts$/, ".js"));
    const mod = await import(pathToFileURL(compiled).href);
    if (typeof mod.default !== "function") {
      throw new Error(`${rel} did not export a default function after transpile`);
    }
    const { res, out } = mockResponse();
    await mod.default({ method: "POST", body: { jobId: "x", studyId: "x" }, headers: {} }, res);
    if (out.statusCode !== 503) {
      throw new Error(`${rel} expected 503 with env unset, got ${out.statusCode} ${JSON.stringify(out.body)}`);
    }
    if (!String(out.body?.error ?? "").startsWith("Server not configured:") || !String(out.body?.error ?? "").endsWith(" missing")) {
      throw new Error(`${rel} expected config 503 JSON, got ${JSON.stringify(out.body)}`);
    }
    loaded.push(rel);
    probed.push(`${rel} → ${out.body.error}`);
  }
  return { loaded, probed };
}

export async function checkApiEsm() {
  const apiFiles = await listApiFiles();
  const violations = [];
  for (const file of apiFiles) {
    const source = await readFile(file, "utf8");
    for (const { specifier, statement } of scanImports(source)) {
      const reason = isForbiddenApiImport(specifier, statement);
      if (reason) violations.push(`${relative(ROOT, file)}: ${reason}`);
    }
  }
  if (violations.length) {
    throw new Error(`Forbidden /api imports:\n${violations.join("\n")}`);
  }

  const files = await collectGraph(API_ENTRIES);
  await transpileGraph(files);
  const { loaded, probed } = await importEntries(API_ENTRIES);
  return { files: files.length, loaded, probed };
}

const launched = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launched) {
  checkApiEsm()
    .then((result) => {
      console.log(
        `ok: imported with env unset ${result.loaded.join(", ")} (${result.files} transpiled modules)`,
      );
      for (const line of result.probed) console.log(`  503 ${line}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
