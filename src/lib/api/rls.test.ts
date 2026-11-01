import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

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

function migrationsDir() {
  return path.resolve(import.meta.dirname, "../../../supabase/migrations");
}

function bootstrapSql() {
  return `
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create table if not exists auth.session (
      uid uuid,
      jwt jsonb default '{}'::jsonb,
      role text default 'authenticated'
    );
    insert into auth.session (uid, jwt, role) values (null, '{}'::jsonb, 'anon');
    create or replace function auth.uid() returns uuid as $$
      select uid from auth.session limit 1
    $$ language sql stable;
    create or replace function auth.jwt() returns jsonb as $$
      select coalesce((select jwt from auth.session limit 1), '{}'::jsonb)
    $$ language sql stable;
    create or replace function auth.role() returns text as $$
      select coalesce((select role from auth.session limit 1), 'anon')
    $$ language sql stable;
    create or replace function uuid_generate_v4() returns uuid as $$
      select gen_random_uuid()
    $$ language sql;
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      owner uuid,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      owner_id text
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text,
      owner uuid,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      last_accessed_at timestamptz default now(),
      metadata jsonb,
      owner_id text
    );
    create unique index if not exists bucketid_objname on storage.objects (bucket_id, name);
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text)
    returns text[]
    language plpgsql
    as $$
    declare
      _parts text[];
    begin
      select string_to_array(name, '/') into _parts;
      return _parts[1:array_length(_parts, 1) - 1];
    end
    $$;
  `;
}

function adaptMigration(sql: string) {
  return sql
    .replace(/create extension if not exists "uuid-ossp";/gi, "select 1;")
    .replace(/execute function /gi, "execute procedure ");
}

async function execSql(sql: string, label: string) {
  try {
    await db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already exists") || message.includes("duplicate")) return;
    throw new Error(`${label}: ${message}`);
  }
}

async function setAuth(uid: string | null, jwt: Record<string, string> = {}) {
  await db.query("delete from auth.session");
  await db.query("insert into auth.session (uid, jwt, role) values ($1, $2::jsonb, $3)", [
    uid,
    JSON.stringify(jwt),
    uid ? "authenticated" : "anon",
  ]);
}

async function applyMigrations() {
  await execSql(bootstrapSql(), "bootstrap");
  const dir = migrationsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  expect(files.length).toBeGreaterThanOrEqual(7);
  for (const file of files) {
    const raw = readFileSync(path.join(dir, file), "utf8");
    await execSql(adaptMigration(raw), file);
  }
  await db.exec(`
    do $$
    declare r record;
    begin
      for r in select tablename from pg_tables where schemaname = 'public'
      loop
        execute format('alter table public.%I enable row level security', r.tablename);
        execute format('alter table public.%I force row level security', r.tablename);
      end loop;
    end $$;
    do $$ begin
      create role rls_tester nosuperuser nologin;
    exception when duplicate_object then null;
    end $$;
    grant usage on schema public, auth, storage to rls_tester, anon, authenticated, service_role;
    grant all on all tables in schema public to rls_tester;
    grant all on all sequences in schema public to rls_tester;
    grant select, insert, update, delete on auth.session to rls_tester;
    grant select, insert, update, delete on storage.objects to rls_tester, anon, authenticated, service_role;
    grant select, insert, update, delete on storage.buckets to rls_tester, anon, authenticated, service_role;
    grant execute on all functions in schema public to rls_tester;
    grant execute on all functions in schema auth to rls_tester;
    grant execute on all functions in schema storage to rls_tester, anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to rls_tester;
  `);
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
    await applyMigrations();
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
