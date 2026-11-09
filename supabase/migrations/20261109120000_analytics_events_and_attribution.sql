-- Product analytics event log + first-touch signup attribution.
-- Clients may insert events; they cannot read or update them.

create table public.analytics_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  event text not null check (char_length(event) between 1 and 64),
  user_id uuid references public.users on delete set null,
  workspace_id uuid references public.workspaces on delete set null,
  anonymous_id text,
  session_id text,
  path text,
  properties jsonb not null default '{}'::jsonb
);

create index analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index analytics_events_event_created_at_idx on public.analytics_events (event, created_at desc);
create index analytics_events_user_id_idx on public.analytics_events (user_id);

comment on table public.analytics_events is
  'Append-only product event log. Clients insert only; reads are service-role.';

alter table public.analytics_events enable row level security;

create or replace function public.analytics_events_set_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' then
    -- Keep the caller-supplied user_id for server-side inserts.
    null;
  elsif auth.uid() is not null then
    new.user_id := auth.uid();
  else
    new.user_id := null;
  end if;
  if new.properties is null then
    new.properties := '{}'::jsonb;
  end if;
  return new;
end;
$$;

create trigger analytics_events_set_identity
  before insert on public.analytics_events
  for each row execute function public.analytics_events_set_identity();

revoke all on function public.analytics_events_set_identity() from public;
revoke all on function public.analytics_events_set_identity() from anon, authenticated;

create policy "Clients can insert analytics events"
  on public.analytics_events for insert
  to anon, authenticated
  with check (
    (auth.uid() is null and user_id is null)
    or (auth.uid() is not null and user_id = auth.uid())
  );

grant insert on public.analytics_events to anon, authenticated;
grant all on public.analytics_events to postgres, service_role;
revoke select, update, delete on public.analytics_events from anon, authenticated, public;

-- First-touch attribution stored on the user profile at signup.
alter table public.users
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists signup_referrer text,
  add column if not exists landing_path text;
