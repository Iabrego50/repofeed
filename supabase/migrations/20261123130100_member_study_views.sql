-- Per-user study "seen" tracking for New badges / unread counts on the feed.

create table if not exists public.member_study_views (
  user_id uuid not null references public.users (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, study_id)
);

create index if not exists member_study_views_study_id_idx
  on public.member_study_views (study_id);

alter table public.member_study_views enable row level security;

drop policy if exists "Users manage their own study views" on public.member_study_views;
create policy "Users manage their own study views"
  on public.member_study_views
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Mark a published study as seen for the signed-in member.
create or replace function public.mark_study_seen(p_study_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws_id uuid;
  study_status text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select s.workspace_id, s.status into ws_id, study_status
  from public.studies s
  where s.id = p_study_id;

  if ws_id is null then
    raise exception 'Study not found';
  end if;

  if not public.is_workspace_member(ws_id) then
    raise exception 'Not authorized';
  end if;

  if study_status is distinct from 'published' then
    return;
  end if;

  insert into public.member_study_views (user_id, study_id, seen_at)
  values (uid, p_study_id, now())
  on conflict (user_id, study_id) do update
    set seen_at = excluded.seen_at;
end;
$$;

revoke all on function public.mark_study_seen(uuid) from public;
grant execute on function public.mark_study_seen(uuid) to authenticated;

-- Unread = published studies in the workspace with no view row, or published after seen_at.
-- Only counts studies published after the member joined the workspace.
create or replace function public.unread_study_ids(p_workspace_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  joined_at timestamptz;
  ids uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.created_at into joined_at
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = uid;

  if joined_at is null then
    raise exception 'Not authorized';
  end if;

  select coalesce(array_agg(s.id order by s.published_at desc nulls last), '{}'::uuid[])
  into ids
  from public.studies s
  left join public.member_study_views v
    on v.study_id = s.id and v.user_id = uid
  where s.workspace_id = p_workspace_id
    and s.status = 'published'
    and s.published_at is not null
    and s.published_at >= joined_at
    and (v.seen_at is null or s.published_at > v.seen_at);

  return ids;
end;
$$;

revoke all on function public.unread_study_ids(uuid) from public;
grant execute on function public.unread_study_ids(uuid) to authenticated;

comment on table public.member_study_views is
  'Tracks when a workspace member last viewed a published study (clears New badges).';
comment on function public.mark_study_seen(uuid) is
  'Records that the signed-in member viewed a study.';
comment on function public.unread_study_ids(uuid) is
  'Published study ids in a workspace that are new for the signed-in member.';
