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

  it("generation_jobs phase allows verify after compose", async () => {
    await asSuper();
    const inserted = await db.query<{ phase: string }>(
      `insert into public.generation_jobs (study_id, workspace_id, status, phase, locked_until, started_by)
       values ('${STUDY}', '${WS}', 'running', 'verify', now(), '${OWNER}')
       returning phase`,
    );
    expect(inserted.rows[0]?.phase).toBe("verify");

    await expect(
      db.query(
        `insert into public.generation_jobs (study_id, workspace_id, status, phase, locked_until, started_by)
         values ('${STUDY}', '${WS}', 'running', 'nope', now(), '${OWNER}')`,
      ),
    ).rejects.toThrow(/phase|check|violates/i);
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

  it("anon cannot execute membership SECURITY DEFINER helpers", async () => {
    await asSuper();
    await db.exec("set role anon");
    await expect(db.query(`select public.is_workspace_member('${WS}')`)).rejects.toThrow(
      /permission denied/i,
    );
    await expect(db.query(`select public.get_workspace_role('${WS}')`)).rejects.toThrow(
      /permission denied/i,
    );
    await expect(db.query(`select public.can_edit_workspace('${WS}')`)).rejects.toThrow(
      /permission denied/i,
    );
    await asSuper();
  });

  it("anon can still execute reel_visible_via_share for share links", async () => {
    await asSuper();
    await setAuth(null, { share_token: TOKEN });
    await db.exec("set role anon");
    const { rows } = await db.query<{ ok: boolean }>(
      `select public.reel_visible_via_share('${STUDY}') as ok`,
    );
    expect(rows[0]?.ok).toBe(true);
    await asSuper();
  });

  it("clients cannot read or write workspace_removals", async () => {
    await asSuper();
    await db.query(
      `insert into public.workspace_removals (workspace_id, user_id) values ('${WS}', '${MEMBER}')`,
    );
    await setAuth(OWNER);
    await asTester();
    const { rows } = await db.query("select id from public.workspace_removals");
    expect(rows).toHaveLength(0);
    await expect(
      db.query(
        `insert into public.workspace_removals (workspace_id, user_id) values ('${WS}', '${STRANGER}')`,
      ),
    ).rejects.toThrow(/row-level security|violates/i);
    await asSuper();
  });

  it("clients can insert analytics events but cannot read them", async () => {
    await asSuper();
    await setAuth(null);
    await asTester();
    // INSERT ... RETURNING needs a SELECT policy; this table is insert-only.
    await db.query(
      `insert into public.analytics_events (event, anonymous_id, session_id, path, properties)
       values ('heart', 'anon-1', 'sess-1', '/demo', '{"demo":true}'::jsonb)`,
    );
    const visible = await db.query("select event from public.analytics_events");
    expect(visible.rows).toHaveLength(0);

    await asSuper();
    const { rows } = await db.query<{ event: string; user_id: string | null }>(
      "select event, user_id from public.analytics_events where event = 'heart'",
    );
    expect(rows).toEqual([{ event: "heart", user_id: null }]);
  });

  it("authenticated analytics inserts stamp user_id from auth.uid()", async () => {
    await asSuper();
    await setAuth(OWNER);
    await asTester();
    await db.query(
      `insert into public.analytics_events (event, user_id)
       values ('signup', '${MEMBER}')`,
    );
    const leaked = await db.query("select event from public.analytics_events");
    expect(leaked.rows).toHaveLength(0);

    await asSuper();
    const { rows } = await db.query<{ user_id: string }>(
      "select user_id from public.analytics_events where event = 'signup'",
    );
    expect(rows[0]?.user_id).toBe(OWNER);
  });

  it("clients cannot grant themselves is_admin", async () => {
    await asSuper();
    await setAuth(OWNER);
    await asTester();
    await db.query(`update public.users set is_admin = true where id = '${OWNER}'`);
    await asSuper();
    const { rows } = await db.query<{ is_admin: boolean }>(
      `select is_admin from public.users where id = '${OWNER}'`,
    );
    expect(rows[0]?.is_admin).toBe(false);
  });

  it("record_reel_view counts a viewer once per UTC day and keeps counters in sync", async () => {
    await asSuper();
    await setAuth(OWNER);
    await asTester();
    const first = await db.query<{ counted: boolean }>(
      `select (public.record_reel_view('${REEL}', false, 'sess-1')->>'counted')::boolean as counted`,
    );
    expect(first.rows[0]?.counted).toBe(true);
    const second = await db.query<{ counted: boolean }>(
      `select (public.record_reel_view('${REEL}', true, 'sess-1')->>'counted')::boolean as counted`,
    );
    expect(second.rows[0]?.counted).toBe(false);

    await asSuper();
    const views = await db.query<{ view_count: number; completed: boolean }>(
      `select view_count, completed from public.reel_views where reel_id = '${REEL}' and user_id = '${OWNER}'`,
    );
    expect(views.rows[0]).toEqual({ view_count: 1, completed: true });
    const counters = await db.query<{ views: number; viewers: number; completions: number }>(
      `select views, viewers, completions from public.reel_counters where reel_id = '${REEL}'`,
    );
    expect(counters.rows[0]).toEqual({ views: 1, viewers: 1, completions: 1 });
  });

  it("the art bucket is public and anon cannot write to it", async () => {
    await asSuper();
    const { rows } = await db.query<{ id: string; public: boolean }>(
      'select id, "public" from storage.buckets where id = \'art\'',
    );
    expect(rows).toEqual([{ id: "art", public: true }]);

    await setAuth(null);
    await asTester();
    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('art', 'pwned.png')"),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("anon cannot read guests, studies, or comments directly", async () => {
    await asSuper();
    await db.query(
      `insert into public.guests (study_id, link_id, name, secret)
       select '${STUDY}', id, 'Leaked', 'supersecretguest000000000000001'
       from public.share_links where token = '${TOKEN}'`,
    );
    await setAuth(null);
    await asTester();
    expect((await db.query("select secret from public.guests")).rows).toHaveLength(0);
    expect((await db.query("select id from public.studies")).rows).toHaveLength(0);
    expect((await db.query("select id from public.comments")).rows).toHaveLength(0);
    await asSuper();
  });

  it("anon can load a live share feed through share_feed without a JWT share_token", async () => {
    await asSuper();
    await setAuth(null);
    await db.exec("set role anon");
    const { rows } = await db.query<{ feed: { studyTitle: string; reels: Array<{ id: string }> } }>(
      `select public.share_feed('${TOKEN}', null) as feed`,
    );
    expect(rows[0]?.feed.studyTitle).toBe("Published");
    expect(rows[0]?.feed.reels.map((r) => r.id)).toEqual([REEL]);
    await asSuper();
  });

  it("revoked, unpublished, and unknown tokens return unavailable through share_load", async () => {
    await asSuper();
    await setAuth(null);
    await db.exec("set role anon");
    const missing = await db.query<{ share: unknown }>(
      "select public.share_load('not-a-token') as share",
    );
    expect(missing.rows[0]?.share).toBeNull();
    await asSuper();

    await db.query(`update public.share_links set revoked = true where token = '${TOKEN}'`);
    await db.exec("set role anon");
    const revoked = await db.query<{ share: unknown }>(
      `select public.share_load('${TOKEN}') as share`,
    );
    expect(revoked.rows[0]?.share).toBeNull();
    await asSuper();
    await db.query(`update public.share_links set revoked = false where token = '${TOKEN}'`);

    await db.query(`update public.studies set status = 'draft' where id = '${STUDY}'`);
    await db.exec("set role anon");
    const unpublished = await db.query<{ share: unknown }>(
      `select public.share_load('${TOKEN}') as share`,
    );
    expect(unpublished.rows[0]?.share).toBeNull();
    await asSuper();
    await db.query(`update public.studies set status = 'published' where id = '${STUDY}'`);
  });

  it("anon can join, comment, and react on a live share via RPCs", async () => {
    await asSuper();
    await setAuth(null);
    await db.exec("set role anon");
    const joined = await db.query<{ join: { secret: string; guestId: string } }>(
      `select public.share_join('${TOKEN}', '  Priya   Patel ') as join`,
    );
    const secret = joined.rows[0]?.join.secret;
    const guestId = joined.rows[0]?.join.guestId;
    expect(secret?.length).toBeGreaterThanOrEqual(16);
    expect(guestId).toBeTruthy();

    const commented = await db.query<{ comment: { body: string; guest_id: string } }>(
      `select public.share_add_comment('${TOKEN}', '${secret}', '${REEL}', 'note', 'Looks right', null) as comment`,
    );
    expect(commented.rows[0]?.comment.body).toBe("Looks right");
    expect(commented.rows[0]?.comment.guest_id).toBe(guestId);

    const listed = await db.query<{ comments: Array<{ body: string }> }>(
      `select public.share_comments('${TOKEN}', '${REEL}') as comments`,
    );
    expect(listed.rows[0]?.comments.map((c) => c.body)).toEqual(["Looks right"]);

    const reacted = await db.query<{ kind: string }>(
      `select public.share_react('${TOKEN}', '${secret}', '${REEL}', 'true') as kind`,
    );
    expect(reacted.rows[0]?.kind).toBe("true");

    await expect(
      db.query(`select public.share_add_comment('${TOKEN}', '${secret}', '${OTHER_REEL}', 'note', 'nope', null)`),
    ).rejects.toThrow(/Scene not found/i);
    await asSuper();
  });

  it("anon cannot execute the internal share_live_link helper", async () => {
    await asSuper();
    await db.exec("set role anon");
    await expect(db.query(`select * from public.share_live_link('${TOKEN}')`)).rejects.toThrow(
      /permission denied/i,
    );
    await asSuper();
  });
});
