import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../test/pglite-migrations";

const OWNER = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const STRANGER = "33333333-3333-3333-3333-333333333333";
const WS = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STUDY = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER_STUDY = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const REEL = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const OTHER_REEL = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const TOKEN = "sharetoken0000000000000000000001";
const FOOTAGE_OBJECT = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const FOOTAGE_PATH = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const GENERATED_OBJECT = "99999999-9999-9999-9999-999999999999";
const GENERATED_PATH = "art/generated-secret.png";

let db: PGlite;

async function setAuth(uid: string | null, jwt: Record<string, string> = {}) {
  await db.query("delete from auth.session");
  await db.query("insert into auth.session (uid, jwt, role) values ($1, $2::jsonb, $3)", [
    uid,
    JSON.stringify(jwt),
    uid ? "authenticated" : "anon",
  ]);
}

async function asTester() {
  await db.exec("set role rls_tester");
}

async function asSuper() {
  await db.exec("reset role");
}

async function seed() {
  await db.exec(`
    insert into auth.users (id) values ('${OWNER}'), ('${MEMBER}'), ('${STRANGER}');
    insert into public.users (id, token_identifier, name, email)
    values
      ('${OWNER}', 'tok-owner', 'Owner', 'owner@example.com'),
      ('${MEMBER}', 'tok-member', 'Member', 'member@example.com'),
      ('${STRANGER}', 'tok-stranger', 'Stranger', 'stranger@example.com');
    insert into public.workspaces (id, name, created_by)
    values ('${WS}', 'Acme', '${OWNER}');
    insert into public.workspace_members (workspace_id, user_id, role)
    values
      ('${WS}', '${OWNER}', 'owner'),
      ('${WS}', '${MEMBER}', 'member');
    insert into public.studies (id, workspace_id, title, audience, status, created_by, published_at)
    values
      ('${STUDY}', '${WS}', 'Published', 'PMs', 'published', '${OWNER}', now()),
      ('${OTHER_STUDY}', '${WS}', 'Draft', 'PMs', 'draft', '${OWNER}', null);
    insert into public.reels (id, study_id, workspace_id, position, track, track_index, title, scenes, enabled)
    values
      ('${REEL}', '${STUDY}', '${WS}', 0, 't', 0, 'Published reel', '[]'::jsonb, true),
      ('${OTHER_REEL}', '${OTHER_STUDY}', '${WS}', 0, 't', 0, 'Draft reel', '[]'::jsonb, true);
    insert into public.share_links (study_id, workspace_id, token, created_by, revoked)
    values ('${STUDY}', '${WS}', '${TOKEN}', '${OWNER}', false);
    insert into storage.objects (id, bucket_id, name, owner)
    values
      ('${FOOTAGE_OBJECT}', 'footage', '${FOOTAGE_PATH}', '${OWNER}'),
      ('${GENERATED_OBJECT}', 'generated', '${GENERATED_PATH}', '${OWNER}');
    insert into public.footage_clips (workspace_id, storage_id, url, name, size, uploaded_by)
    values ('${WS}', '${FOOTAGE_PATH}', '${FOOTAGE_PATH}', 'interview.mp4', 1024, '${OWNER}');
  `);
}

describe("RLS policies from supabase/migrations", () => {
  beforeAll(async () => {
    db = new PGlite();
    await applyMigrations(db);
    await seed();
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it("a member can read their workspace's studies", async () => {
    await asSuper();
    await setAuth(MEMBER);
    await asTester();
    const { rows } = await db.query<{ id: string }>("select id from public.studies order by title");
    expect(rows.map((r) => r.id).sort()).toEqual([OTHER_STUDY, STUDY].sort());
  });

  it("a non-member cannot read workspace studies", async () => {
    await asSuper();
    await setAuth(STRANGER);
    await asTester();
    const { rows } = await db.query("select id from public.studies");
    expect(rows).toHaveLength(0);
  });

  it("a guest with a valid share token can read only that study's published reels", async () => {
    await asSuper();
    await setAuth(null, { share_token: TOKEN });
    await asTester();
    const { rows } = await db.query<{ id: string; title: string }>("select id, title from public.reels");
    expect(rows).toEqual([{ id: REEL, title: "Published reel" }]);
  });

  it("a guest token does not reveal another study's reels", async () => {
    await asSuper();
    await setAuth(null, { share_token: "not-the-token" });
    await asTester();
    const { rows } = await db.query("select id from public.reels");
    expect(rows).toHaveLength(0);
  });

  it("a viewer cannot edit studies", async () => {
    await asSuper();
    await setAuth(MEMBER);
    await asTester();
    const updated = await db.query(
      "update public.studies set title = 'Hacked' where id = $1 returning id",
      [STUDY],
    );
    expect(updated.rows).toHaveLength(0);
    await asSuper();
    await setAuth(OWNER);
    await asTester();
    const { rows } = await db.query<{ title: string }>("select title from public.studies where id = $1", [STUDY]);
    expect(rows[0].title).toBe("Published");
  });

  it("a member can read their workspace footage object", async () => {
    await asSuper();
    await setAuth(MEMBER);
    await asTester();
    const { rows } = await db.query<{ name: string }>(
      "select name from storage.objects where bucket_id = 'footage'",
    );
    expect(rows.map((r) => r.name)).toEqual([FOOTAGE_PATH]);
  });

  it("a non-member cannot read workspace footage objects", async () => {
    await asSuper();
    await setAuth(STRANGER);
    await asTester();
    const { rows } = await db.query("select name from storage.objects where bucket_id = 'footage'");
    expect(rows).toHaveLength(0);
  });

  it("generation_jobs.started_by is required", async () => {
    await asSuper();
    await expect(
      db.query(
        `insert into public.generation_jobs (study_id, workspace_id, status, phase, locked_until)
         values ('${STUDY}', '${WS}', 'queued', 'extract', now())`,
      ),
    ).rejects.toThrow(/started_by|not-null|null value/i);
  });

  it("generation_jobs insert stores started_by for a workspace editor", async () => {
    await asSuper();
    await setAuth(OWNER);
    await asTester();
    const { rows } = await db.query<{ started_by: string }>(
      `insert into public.generation_jobs (study_id, workspace_id, status, phase, locked_until, started_by)
       values ('${STUDY}', '${WS}', 'queued', 'extract', now(), '${OWNER}')
       returning started_by`,
    );
    expect(rows[0]?.started_by).toBe(OWNER);
  });

  it("a viewer cannot start a generation job", async () => {
    await asSuper();
    await setAuth(MEMBER);
    await asTester();
    await expect(
      db.query(
        `insert into public.generation_jobs (study_id, workspace_id, status, phase, locked_until, started_by)
         values ('${STUDY}', '${WS}', 'queued', 'extract', now(), '${MEMBER}')`,
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("anon cannot write or delete objects in the generated bucket", async () => {
    await asSuper();
    await setAuth(null);
    await asTester();

    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('generated', 'pwned.png')"),
    ).rejects.toThrow(/row-level security|violates/i);

    const deleted = await db.query(
      "delete from storage.objects where bucket_id = 'generated' returning id",
    );
    expect(deleted.rows).toHaveLength(0);

    await asSuper();
    const { rows } = await db.query<{ name: string }>(
      "select name from storage.objects where bucket_id = 'generated'",
    );
    expect(rows.map((r) => r.name)).toEqual([GENERATED_PATH]);
  });
});
