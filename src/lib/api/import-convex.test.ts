import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { crc32 } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import JSZip from "jszip";
import { applyMigrations } from "../test/pglite-migrations";
import {
  runImport,
  runLegacyImport,
  uuidFromConvexId,
  TABLE_MAP,
  UNIQUE_KEYS,
  dedupeUsersByEmail,
  isLaunchedAsMain,
  isLaunchedAsMainLegacy,
} from "../../../scripts/import-convex-data.mjs";

type JsonRow = Record<string, unknown>;

function jsonl(rows: JsonRow[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

const NOW = 1_700_000_000_000;

function fixtureRecords() {
  return {
    users: [
      {
        _id: "user_owner",
        _creationTime: NOW,
        name: "Ada",
        email: "ada@example.com",
        tokenIdentifier: "tok-ada",
        avatar: "https://img/ada.png",
      },
      {
        _id: "user_member",
        _creationTime: NOW + 1,
        name: "Ben",
        email: "ben@example.com",
        tokenIdentifier: "tok-ben",
      },
    ],
    workspaces: [
      {
        _id: "ws_1",
        _creationTime: NOW + 2,
        name: "Acme",
        createdBy: "user_owner",
      },
    ],
    workspaceMembers: [
      {
        _id: "wm_1",
        _creationTime: NOW + 3,
        workspaceId: "ws_1",
        userId: "user_owner",
        role: "owner",
      },
      {
        _id: "wm_2",
        _creationTime: NOW + 4,
        workspaceId: "ws_1",
        userId: "user_member",
        role: "member",
      },
    ],
    studies: [
      {
        _id: "st_1",
        _creationTime: NOW + 5,
        workspaceId: "ws_1",
        title: "Onboarding",
        audience: "PMs",
        status: "published",
        createdBy: "user_owner",
        tracks: [],
        publishedAt: NOW + 6,
      },
    ],
    footageClips: [
      {
        _id: "fc_1",
        _creationTime: NOW + 7,
        workspaceId: "ws_1",
        storageId: "stor_1",
        url: "stor_1",
        name: "clip.mp4",
        size: 1000,
        uploadedBy: "user_owner",
      },
    ],
    reels: [
      {
        _id: "reel_1",
        _creationTime: NOW + 8,
        studyId: "st_1",
        workspaceId: "ws_1",
        position: 0,
        track: "t",
        trackIndex: 0,
        title: "Insight",
        scenes: [],
        findingIds: [],
        sourceNames: [],
        enabled: true,
        footage: { storageId: "stor_1", clipId: "fc_1", caption: "Kitchen" },
      },
    ],
    shareLinks: [
      {
        _id: "sl_1",
        _creationTime: NOW + 9,
        studyId: "st_1",
        workspaceId: "ws_1",
        token: "sharetok1",
        createdBy: "user_owner",
        revoked: false,
      },
    ],
    comments: [
      {
        _id: "c_1",
        _creationTime: NOW + 10,
        reelId: "reel_1",
        studyId: "st_1",
        userId: "user_member",
        kind: "note",
        body: "Nice",
        resolved: false,
      },
    ],
    rateLimits: [
      {
        _id: "rl_1",
        _creationTime: NOW + 11,
        key: "x",
        windowStart: NOW,
        count: 1,
      },
    ],
  };
}

async function buildFixtureZip(extra?: Record<string, JsonRow[]>) {
  const zip = new JSZip();
  const records = { ...fixtureRecords(), ...extra };
  for (const [folder, rows] of Object.entries(records)) {
    zip.folder(folder)?.file("documents.jsonl", jsonl(rows));
  }
  return zip.generateAsync({ type: "uint8array" });
}

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function createPgliteSupabase(db: PGlite) {
  const columnCache = new Map<string, Map<string, string>>();

  async function columnTypes(table: string) {
    const cached = columnCache.get(table);
    if (cached) return cached;
    const { rows } = await db.query<{ column_name: string; udt_name: string }>(
      `select column_name, udt_name from information_schema.columns
       where table_schema = 'public' and table_name = $1`,
      [table],
    );
    const map = new Map(rows.map((row) => [row.column_name, row.udt_name]));
    columnCache.set(table, map);
    return map;
  }

  async function writeRows(table: string, rows: JsonRow[], mode: "insert" | "upsert") {
    if (rows.length === 0) return;
    const types = await columnTypes(table);
    const cols = Object.keys(rows[0]);
    const placeholders = rows.map((_row, rowIndex) => {
      const offset = rowIndex * cols.length;
      return `(${cols
        .map((col, index) => {
          const udt = types.get(col);
          const param = `$${offset + index + 1}`;
          if (udt === "jsonb" || udt === "json") return `${param}::jsonb`;
          if (udt === "uuid") return `${param}::uuid`;
          if (udt === "timestamptz") return `${param}::timestamptz`;
          return param;
        })
        .join(", ")})`;
    });
    const values = rows.flatMap((row) =>
      cols.map((col) => {
        const value = row[col];
        if (value !== null && typeof value === "object") return JSON.stringify(value);
        return value;
      }),
    );
    const conflict =
      mode === "upsert"
        ? ` on conflict (id) do update set ${cols
            .filter((col) => col !== "id")
            .map((col) => `${quoteIdent(col)} = excluded.${quoteIdent(col)}`)
            .join(", ")}`
        : "";
    await db.query(
      `insert into public.${quoteIdent(table)} (${cols.map(quoteIdent).join(", ")}) values ${placeholders.join(", ")}${conflict}`,
      values,
    );
  }

  return {
    auth: {
      admin: {
        async createUser(args: { email: string; user_metadata?: { name?: string | null; avatar_url?: string | null } }) {
          const found = await db.query<{ id: string; email: string }>(
            "select id, email from auth.users where lower(email) = lower($1)",
            [args.email],
          );
          if (found.rows[0]) {
            return {
              data: { user: found.rows[0] },
              error: { message: "User already registered" },
            };
          }
          const id = crypto.randomUUID();
          await db.query(
            "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)",
            [id, args.email, JSON.stringify(args.user_metadata ?? {})],
          );
          return { data: { user: { id, email: args.email, user_metadata: args.user_metadata } }, error: null };
        },
        async listUsers() {
          const { rows } = await db.query<{ id: string; email: string }>("select id, email from auth.users");
          return { data: { users: rows }, error: null };
        },
      },
    },
    from(table: string) {
      return {
        select(_columns?: string) {
          const lookup = (sql: string, value: unknown) => ({
            async maybeSingle() {
              try {
                const { rows } = await db.query(sql, [value]);
                return { data: rows[0] ?? null, error: null };
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { data: null, error: { message } };
              }
            },
          });
          return {
            eq(column: string, value: unknown) {
              return lookup(
                `select * from public.${quoteIdent(table)} where ${quoteIdent(column)} = $1 limit 1`,
                value,
              );
            },
            ilike(column: string, value: unknown) {
              return lookup(
                `select * from public.${quoteIdent(table)} where ${quoteIdent(column)} ilike $1 limit 1`,
                value,
              );
            },
          };
        },
        async insert(payload: JsonRow | JsonRow[]) {
          try {
            const rows = Array.isArray(payload) ? payload : [payload];
            await writeRows(table, rows, "insert");
            return { data: rows, error: null };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { data: null, error: { message } };
          }
        },
        async upsert(payload: JsonRow | JsonRow[]) {
          try {
            const rows = Array.isArray(payload) ? payload : [payload];
            await writeRows(table, rows, "upsert");
            return { data: rows, error: null };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { data: null, error: { message } };
          }
        },
      };
    },
  };
}

async function count(db: PGlite, table: string) {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${quoteIdent(table)}`);
  return rows[0].n;
}

describe("legacy Convex import script", () => {
  let db: PGlite;

  afterEach(async () => {
    await db?.close();
  });

  it("fails with users_id_fkey and misses camelCase workspaceMembers", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const zipBuffer = await buildFixtureZip();
    const supabase = await createPgliteSupabase(db);

    await expect(runLegacyImport({ zipBuffer, supabase })).rejects.toThrow(/users_id_fkey|foreign key|23503/i);

    const { rows: authRows } = await db.query<{ n: number }>("select count(*)::int as n from auth.users");
    expect(authRows[0].n).toBe(0);
    expect(await count(db, "users")).toBe(0);

    const { workspace_members } = await (async () => {
      const zip = await JSZip.loadAsync(zipBuffer);
      const file = Object.values(zip.files).find((entry) => /workspace_members\/documents\.jsonl$/.test(entry.name));
      return { workspace_members: file ? 1 : 0 };
    })();
    expect(workspace_members).toBe(0);
    expect(TABLE_MAP.workspaceMembers).toBe("workspace_members");
  });
});

describe("import-convex-data", () => {
  let db: PGlite;

  afterEach(async () => {
    await db?.close();
  });

  it("imports a camelCase snapshot into auth.users and mapped tables with intact FKs", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const zipBuffer = await buildFixtureZip();
    const supabase = await createPgliteSupabase(db);
    const logs: string[] = [];

    const first = await runImport({
      zipBuffer,
      supabase,
      log: (line: string) => logs.push(line),
    });

    expect(first.dryRun).toBe(false);
    expect(await count(db, "users")).toBe(2);
    expect(await count(db, "workspaces")).toBe(1);
    expect(await count(db, "workspace_members")).toBe(2);
    expect(await count(db, "studies")).toBe(1);
    expect(await count(db, "footage_clips")).toBe(1);
    expect(await count(db, "reels")).toBe(1);
    expect(await count(db, "share_links")).toBe(1);
    expect(await count(db, "comments")).toBe(1);
    expect(await count(db, "rate_limits")).toBe(0);
    expect(logs.some((line) => line.includes("rateLimits") && line.includes("skipped"))).toBe(true);

    const { rows: authUsers } = await db.query<{ id: string; email: string }>(
      "select id, email from auth.users order by email",
    );
    expect(authUsers.map((row) => row.email)).toEqual(["ada@example.com", "ben@example.com"]);

    const { rows: publicUsers } = await db.query<{ id: string; email: string }>(
      "select id, email from public.users order by email",
    );
    expect(publicUsers).toEqual(authUsers);

    const { rows: orphans } = await db.query(
      `select wm.id
       from public.workspace_members wm
       left join public.users u on u.id = wm.user_id
       left join public.workspaces w on w.id = wm.workspace_id
       where u.id is null or w.id is null`,
    );
    expect(orphans).toHaveLength(0);

    const { rows: reels } = await db.query<{ footage: { clipId: string; storageId: string } }>(
      "select footage from public.reels",
    );
    expect(reels[0].footage.clipId).toBe(uuidFromConvexId("fc_1"));
    expect(reels[0].footage.storageId).toBe(uuidFromConvexId("stor_1"));

    const { rows: clips } = await db.query<{ id: string }>("select id from public.footage_clips");
    expect(clips[0].id).toBe(uuidFromConvexId("fc_1"));

    const second = await runImport({ zipBuffer, supabase, log: () => undefined });
    expect(second.counts).toEqual(first.counts);
    expect(await count(db, "users")).toBe(2);
    expect(await count(db, "workspace_members")).toBe(2);
    expect(await count(db, "reels")).toBe(1);
    expect(await count(db, "comments")).toBe(1);
    const { rows: authAfter } = await db.query<{ n: number }>("select count(*)::int as n from auth.users");
    expect(authAfter[0].n).toBe(2);
  });

  it("dry-run reports mapping and writes nothing", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const zipBuffer = await buildFixtureZip();
    const logs: string[] = [];

    const result = await runImport({
      zipBuffer,
      dryRun: true,
      log: (line: string) => logs.push(line),
    });

    expect(result.dryRun).toBe(true);
    expect(result.counts.users).toBe(2);
    expect(result.counts.workspaceMembers).toBe(2);
    expect(result.counts.rateLimits).toBe(1);
    expect(logs.some((line) => line.includes("workspaceMembers → workspace_members"))).toBe(true);
    expect(await count(db, "users")).toBe(0);
    expect(await count(db, "workspaces")).toBe(0);
  });

  it("fails when a snapshot folder has records but no mapping", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const zipBuffer = await buildFixtureZip({
      mysteryThings: [{ _id: "x", _creationTime: NOW, name: "nope" }],
    });

    await expect(
      runImport({
        zipBuffer,
        dryRun: true,
        log: () => undefined,
      }),
    ).rejects.toThrow(/unmapped table[\s\S]*mysteryThings/i);
  });
});

const SHARED_EMAIL = "shared@example.com";

function duplicateEmailRecords() {
  const base = fixtureRecords();
  return {
    ...base,
    users: [
      {
        _id: "user_dup_a",
        _creationTime: NOW,
        name: "First Token",
        email: SHARED_EMAIL,
        tokenIdentifier: "https://hercules.app|tok-aaa",
        avatar: "https://img/old.png",
      },
      {
        _id: "user_dup_b",
        _creationTime: NOW + 50,
        name: "Middle Token",
        email: "Shared@Example.com",
        tokenIdentifier: "https://hercules.app|tok-bbb",
      },
      {
        _id: "user_dup_c",
        _creationTime: NOW + 200,
        updatedAt: NOW + 400,
        name: "Latest Profile",
        email: "SHARED@EXAMPLE.COM",
        tokenIdentifier: "https://hercules.app|tok-ccc",
        avatar: "https://img/latest.png",
        onboardedAt: NOW + 300,
      },
    ],
    workspaces: [
      {
        _id: "ws_1",
        _creationTime: NOW + 2,
        name: "Acme",
        createdBy: "user_dup_a",
      },
    ],
    footageClips: base.footageClips.map((clip) => ({ ...clip, uploadedBy: "user_dup_a" })),
    shareLinks: base.shareLinks.map((link) => ({ ...link, createdBy: "user_dup_a" })),
    workspaceMembers: [
      {
        _id: "wm_a",
        _creationTime: NOW + 3,
        workspaceId: "ws_1",
        userId: "user_dup_a",
        role: "owner",
      },
      {
        _id: "wm_b",
        _creationTime: NOW + 4,
        workspaceId: "ws_1",
        userId: "user_dup_b",
        role: "member",
      },
      {
        _id: "wm_c",
        _creationTime: NOW + 5,
        workspaceId: "ws_1",
        userId: "user_dup_c",
        role: "editor",
      },
    ],
    studies: [
      {
        _id: "st_1",
        _creationTime: NOW + 6,
        workspaceId: "ws_1",
        title: "Onboarding",
        audience: "PMs",
        status: "published",
        createdBy: "user_dup_a",
        tracks: [],
        publishedAt: NOW + 7,
      },
    ],
    comments: [
      {
        _id: "c_1",
        _creationTime: NOW + 10,
        reelId: "reel_1",
        studyId: "st_1",
        userId: "user_dup_b",
        kind: "note",
        body: "Nice",
        resolved: false,
      },
    ],
    savedReels: [
      {
        _id: "sr_a",
        _creationTime: NOW + 11,
        userId: "user_dup_a",
        workspaceId: "ws_1",
        reelId: "reel_1",
        studyId: "st_1",
      },
      {
        _id: "sr_b",
        _creationTime: NOW + 12,
        userId: "user_dup_b",
        workspaceId: "ws_1",
        reelId: "reel_1",
        studyId: "st_1",
      },
    ],
    reactions: [
      {
        _id: "rx_a",
        _creationTime: NOW + 13,
        reelId: "reel_1",
        studyId: "st_1",
        userId: "user_dup_a",
        kind: "true",
      },
      {
        _id: "rx_c",
        _creationTime: NOW + 14,
        reelId: "reel_1",
        studyId: "st_1",
        userId: "user_dup_c",
        kind: "true",
      },
    ],
  };
}

function zipLocalEntry(name: string, content: Buffer) {
  const nameBuf = Buffer.from(name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc32(content) >>> 0, 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuf, content]);
}

function zipEocd(totalEntries: number, cdOffset: number, cdSize = 0) {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(totalEntries, 8);
  eocd.writeUInt16LE(totalEntries, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

/** Convex-shaped zip: valid local headers, empty central dir, EOCD claims 51 records. */
function buildQuirkyZip(files: Record<string, string>) {
  const parts = Object.entries(files).map(([name, text]) => zipLocalEntry(name, Buffer.from(text)));
  const body = Buffer.concat(parts);
  return Buffer.concat([body, zipEocd(51, body.length, 0)]);
}

async function writeExtractedSnapshot(root: string, records: Record<string, JsonRow[]>) {
  for (const [folder, rows] of Object.entries(records)) {
    const dir = join(root, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "documents.jsonl"), jsonl(rows));
  }
}

describe("duplicate Convex emails", () => {
  let db: PGlite;

  afterEach(async () => {
    await db?.close();
  });

  it("old path upserts one public.users row per Convex user and dies on ON CONFLICT", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const zipBuffer = await buildFixtureZip(duplicateEmailRecords());
    const supabase = await createPgliteSupabase(db);

    await expect(
      runImport({
        zipBuffer,
        supabase,
        dedupeUsers: false,
        dedupeUniqueKeys: false,
        log: () => undefined,
      }),
    ).rejects.toThrow(/cannot affect row a second time|ON CONFLICT/i);
  });

  it("dedupes by email, keeps the latest profile, maps every Convex id, and drops unique collisions", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const zipBuffer = await buildFixtureZip(duplicateEmailRecords());
    const supabase = await createPgliteSupabase(db);
    const logs: string[] = [];

    const grouped = dedupeUsersByEmail(duplicateEmailRecords().users);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].convexIds).toEqual(["user_dup_a", "user_dup_b", "user_dup_c"]);
    expect((grouped[0].winner as { name: string }).name).toBe("Latest Profile");
    expect(UNIQUE_KEYS.workspace_members).toEqual(["workspace_id", "user_id"]);

    const result = await runImport({
      zipBuffer,
      supabase,
      log: (line: string) => logs.push(line),
    });

    expect(await count(db, "users")).toBe(1);
    const { rows: authUsers } = await db.query<{ n: number }>("select count(*)::int as n from auth.users");
    expect(authUsers[0].n).toBe(1);

    const { rows: [profile] } = await db.query<{
      id: string;
      name: string;
      email: string;
      avatar: string;
      token_identifier: string;
      onboarded_at: string | null;
    }>("select id, name, email, avatar, token_identifier, onboarded_at from public.users");
    expect(profile.name).toBe("Latest Profile");
    expect(profile.avatar).toBe("https://img/latest.png");
    expect(profile.token_identifier).toBe("https://hercules.app|tok-ccc");
    expect(profile.onboarded_at).not.toBeNull();

    expect(result.idMap.get("user_dup_a")).toBe(profile.id);
    expect(result.idMap.get("user_dup_b")).toBe(profile.id);
    expect(result.idMap.get("user_dup_c")).toBe(profile.id);

    expect(await count(db, "workspace_members")).toBe(1);
    const { rows: [member] } = await db.query<{ user_id: string; role: string }>(
      "select user_id, role from public.workspace_members",
    );
    expect(member.user_id).toBe(profile.id);
    expect(member.role).toBe("owner");

    expect(await count(db, "saved_reels")).toBe(1);
    expect(await count(db, "reactions")).toBe(1);

    const { rows: [study] } = await db.query<{ created_by: string }>("select created_by from public.studies");
    expect(study.created_by).toBe(profile.id);
    const { rows: [comment] } = await db.query<{ user_id: string }>("select user_id from public.comments");
    expect(comment.user_id).toBe(profile.id);

    expect(logs.some((line) => /workspace_members: dropped .* duplicate/.test(line))).toBe(true);
    expect(logs.some((line) => /saved_reels: dropped .* duplicate/.test(line))).toBe(true);
    expect(logs.some((line) => /reactions: dropped .* duplicate/.test(line))).toBe(true);
  });
});

describe("tolerant zip and directory input", () => {
  let db: PGlite;
  const temps: string[] = [];

  afterEach(async () => {
    await db?.close();
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("JSZip rejects a Convex export whose central directory is empty", async () => {
    const records = fixtureRecords();
    const files: Record<string, string> = {};
    for (const [folder, rows] of Object.entries(records)) {
      files[`${folder}/documents.jsonl`] = jsonl(rows);
    }
    const quirky = buildQuirkyZip(files);
    await expect(JSZip.loadAsync(quirky)).rejects.toThrow(/central dir|corrupted zip/i);
    await expect(
      runImport({
        zipBuffer: quirky,
        zipEngine: "jszip",
        dryRun: true,
        log: () => undefined,
      }),
    ).rejects.toThrow(/central dir|corrupted zip/i);
  });

  it("reads the same quirky zip via the tolerant loader and an extracted directory", async () => {
    db = new PGlite();
    await applyMigrations(db, { forceRls: false, grantTester: false });
    const records = fixtureRecords();
    const files: Record<string, string> = {};
    for (const [folder, rows] of Object.entries(records)) {
      files[`${folder}/documents.jsonl`] = jsonl(rows);
    }
    const quirky = buildQuirkyZip(files);

    const fromZip = await runImport({
      zipBuffer: quirky,
      supabase: await createPgliteSupabase(db),
      log: () => undefined,
    });
    expect(fromZip.counts.users).toBe(2);
    expect(fromZip.counts.workspaceMembers).toBe(2);
    expect(await count(db, "users")).toBe(2);
    expect(await count(db, "workspace_members")).toBe(2);

    const extracted = await mkdtemp(join(tmpdir(), "convex-extracted-"));
    temps.push(extracted);
    await writeExtractedSnapshot(extracted, records);
    const dry = await runImport({
      zipPath: extracted,
      dryRun: true,
      log: () => undefined,
    });
    expect(dry.counts.users).toBe(2);
    expect(dry.counts.workspaceMembers).toBe(2);
    expect(dry.counts.rateLimits).toBe(1);
  });
});

describe("Convex system folders", () => {
  it("old planner treats _tables with records as unmapped", async () => {
    const zipBuffer = await buildFixtureZip({
      _tables: [{ _id: "meta", name: "users" }],
      _storage: [],
    });

    await expect(
      runImport({
        zipBuffer,
        dryRun: true,
        ignoreUnderscoreFolders: false,
        log: () => undefined,
      }),
    ).rejects.toThrow(/unmapped table[\s\S]*_tables/i);
  });

  it("skips _tables and other _ folders with a log line", async () => {
    const zipBuffer = await buildFixtureZip({
      _tables: [{ _id: "meta", name: "users" }],
      _storage: [],
    });
    const logs: string[] = [];

    const result = await runImport({
      zipBuffer,
      dryRun: true,
      log: (line: string) => logs.push(line),
    });

    expect(result.counts._tables).toBe(1);
    expect(logs.some((line) => line.includes("_tables") && /system folder skipped/.test(line))).toBe(true);
    expect(logs.some((line) => line.includes("_storage") && /system folder skipped/.test(line))).toBe(true);
    expect(logs.some((line) => /unmapped/.test(line) && /_tables/.test(line))).toBe(false);
  });
});

describe("main-module check", () => {
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("legacy endsWith check misses renamed files; pathToFileURL comparison does not", () => {
    const renamed = resolve("/tmp/import-convex-copy.mjs");
    expect(isLaunchedAsMainLegacy(renamed)).toBe(false);
    expect(isLaunchedAsMain(pathToFileURL(renamed).href, renamed)).toBe(true);

    const real = resolve("scripts/import-convex-data.mjs");
    expect(isLaunchedAsMainLegacy(real)).toBe(true);
    expect(isLaunchedAsMain(pathToFileURL(real).href, real)).toBe(true);
    expect(isLaunchedAsMain(import.meta.url, process.argv[1])).toBe(false);
  });

  it("a renamed copy of the script prints usage instead of exiting silently", async () => {
    const dir = await mkdtemp(join(resolve("."), ".tmp-convex-cli-"));
    temps.push(dir);
    const copy = join(dir, "import-snapshot.mjs");
    const source = resolve("scripts/import-convex-data.mjs");
    await copyFile(source, copy);

    const result = spawnSync(process.execPath, [copy], {
      encoding: "utf8",
      cwd: resolve("."),
    });

    expect(isLaunchedAsMainLegacy(copy)).toBe(false);
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toMatch(/Usage:/);
  });
});
