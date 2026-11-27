-- Story onboarding “Set up a demo” lead capture.
-- INSERT-only for anon + authenticated; no SELECT/UPDATE/DELETE for those roles
-- so clients must insert without .select() / RETURNING.

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'story',
  user_agent text,
  created_at timestamptz not null default now(),
  constraint demo_requests_email_check check (
    email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create index if not exists demo_requests_created_at_idx
  on public.demo_requests (created_at desc);

alter table public.demo_requests enable row level security;

drop policy if exists "demo_requests_insert_anon" on public.demo_requests;
create policy "demo_requests_insert_anon"
  on public.demo_requests
  for insert
  to anon
  with check (true);

drop policy if exists "demo_requests_insert_authenticated" on public.demo_requests;
create policy "demo_requests_insert_authenticated"
  on public.demo_requests
  for insert
  to authenticated
  with check (true);

-- Intentionally no SELECT / UPDATE / DELETE policies for anon or authenticated.
-- Service role bypasses RLS for admin reads.
