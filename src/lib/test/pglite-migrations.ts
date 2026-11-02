import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

export function migrationsDir() {
  return path.resolve(import.meta.dirname, "../../../supabase/migrations");
}

export function bootstrapSql() {
  return `
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create unique index if not exists auth_users_email_key on auth.users (email);
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

async function execSql(db: PGlite, sql: string, label: string) {
  try {
    await db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already exists") || message.includes("duplicate")) return;
    throw new Error(`${label}: ${message}`);
  }
}

export async function applyMigrations(
  db: PGlite,
  options: { forceRls?: boolean; grantTester?: boolean } = {},
) {
  const forceRls = options.forceRls ?? true;
  const grantTester = options.grantTester ?? true;
  await execSql(db, bootstrapSql(), "bootstrap");
  const dir = migrationsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  if (files.length < 7) {
    throw new Error(`expected at least 7 migrations, found ${files.length}`);
  }
  for (const file of files) {
    const raw = readFileSync(path.join(dir, file), "utf8");
    await execSql(db, adaptMigration(raw), file);
  }
  if (!forceRls && !grantTester) return;
  await db.exec(`
    do $$
    declare r record;
    begin
      for r in select tablename from pg_tables where schemaname = 'public'
      loop
        execute format('alter table public.%I enable row level security', r.tablename);
        ${forceRls ? "execute format('alter table public.%I force row level security', r.tablename);" : ""}
      end loop;
    end $$;
  `);
  if (!grantTester) return;
  await db.exec(`
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
