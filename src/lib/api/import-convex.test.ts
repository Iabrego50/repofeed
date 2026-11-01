import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import JSZip from "jszip";
import { applyMigrations } from "../test/pglite-migrations";
import {
  runImport,
  runLegacyImport,
  uuidFromConvexId,
  TABLE_MAP,
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
    const types = await columnTypes(table);
    for (const row of rows) {
      const cols = Object.keys(row);
      const placeholders = cols.map((col, index) => {
        const udt = types.get(col);
        if (udt === "jsonb" || udt === "json") return `$${index + 1}::jsonb`;
        if (udt === "uuid") return `$${index + 1}::uuid`;
        if (udt === "timestamptz") return `$${index + 1}::timestamptz`;
        return `$${index + 1}`;
      });
      const values = cols.map((col) => {
        const value = row[col];
        if (value !== null && typeof value === "object") return JSON.stringify(value);
        return value;
      });
      const conflict =
        mode === "upsert"
          ? ` on conflict (id) do update set ${cols
              .filter((col) => col !== "id")
              .map((col) => `${quoteIdent(col)} = excluded.${quoteIdent(col)}`)
              .join(", ")}`
          : "";
      await db.query(
        `insert into public.${quoteIdent(table)} (${cols.map(quoteIdent).join(", ")}) values (${placeholders.join(", ")})${conflict}`,
        values,
      );
    }
  }

  return {
    auth: {
      admin: {
        async createUser(args: { email: string; user_metadata?: { name?: string | null; avatar_url?: string | null } }) {
          const found = await db.query<{ id: string; email: string }>(
            "select id, email from auth.users where email = $1",
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
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  try {
                    const { rows } = await db.query(
                      `select * from public.${quoteIdent(table)} where ${quoteIdent(column)} = $1 limit 1`,
                      [value],
                    );
                    return { data: rows[0] ?? null, error: null };
                  } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { data: null, error: { message } };
                  }
                },
              };
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
