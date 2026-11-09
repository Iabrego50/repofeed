-- Count a view at most once per viewer per reel per UTC day, keep
-- reel_counters in sync, and backfill onboarded_at for users who
-- already made it into a workspace.

alter table public.reel_views
  add column if not exists counted_on date,
  add column if not exists last_session_id text;

alter table public.guest_views
  add column if not exists counted_on date,
  add column if not exists last_session_id text;

create or replace function public.record_reel_view(
  p_reel_id uuid,
  p_completed boolean default false,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_study uuid;
  v_today date := (timezone('utc', now()))::date;
  v_existing public.reel_views%rowtype;
  v_counted boolean := false;
  v_new_viewer boolean := false;
  v_new_completion boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select study_id into v_study from public.reels where id = p_reel_id;
  if v_study is null then
    return jsonb_build_object('counted', false);
  end if;

  select * into v_existing
  from public.reel_views
  where reel_id = p_reel_id and user_id = v_user;

  if not found then
    insert into public.reel_views (
      reel_id, study_id, user_id, view_count, completed,
      last_viewed_at, counted_on, last_session_id
    ) values (
      p_reel_id, v_study, v_user, 1, coalesce(p_completed, false),
      now(), v_today, p_session_id
    );
    v_counted := true;
    v_new_viewer := true;
    v_new_completion := coalesce(p_completed, false);
  else
    v_new_completion := coalesce(p_completed, false) and not v_existing.completed;
    if v_existing.counted_on is distinct from v_today then
      v_counted := true;
    end if;
    update public.reel_views
    set
      view_count = view_count + case when v_counted then 1 else 0 end,
      completed = completed or coalesce(p_completed, false),
      last_viewed_at = now(),
      counted_on = case when v_counted then v_today else counted_on end,
      last_session_id = coalesce(p_session_id, last_session_id)
    where id = v_existing.id;
  end if;

  insert into public.reel_counters (
    reel_id, study_id, views, viewers, completions
  ) values (
    p_reel_id,
    v_study,
    case when v_counted then 1 else 0 end,
    case when v_new_viewer then 1 else 0 end,
    case when v_new_completion then 1 else 0 end
  )
  on conflict (reel_id) do update set
    views = public.reel_counters.views + case when v_counted then 1 else 0 end,
    viewers = public.reel_counters.viewers + case when v_new_viewer then 1 else 0 end,
    completions = public.reel_counters.completions + case when v_new_completion then 1 else 0 end,
    updated_at = now();

  return jsonb_build_object(
    'counted', v_counted,
    'new_viewer', v_new_viewer,
    'completed', coalesce(p_completed, false)
  );
end;
$$;

create or replace function public.record_guest_reel_view(
  p_reel_id uuid,
  p_completed boolean default false,
  p_token text default null,
  p_secret text default null,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_guest uuid;
  v_study uuid;
  v_reel_study uuid;
  v_today date := (timezone('utc', now()))::date;
  v_existing public.guest_views%rowtype;
  v_counted boolean := false;
  v_new_viewer boolean := false;
  v_new_completion boolean := false;
begin
  select g.id, sl.study_id
  into v_guest, v_study
  from public.share_links sl
  join public.guests g on g.link_id = sl.id
  where sl.token = p_token
    and sl.revoked is not true
    and g.secret = p_secret
  limit 1;

  if v_guest is null then
    return jsonb_build_object('counted', false);
  end if;

  select study_id into v_reel_study from public.reels where id = p_reel_id;
  if v_reel_study is null or v_reel_study is distinct from v_study then
    return jsonb_build_object('counted', false);
  end if;

  select * into v_existing
  from public.guest_views
  where reel_id = p_reel_id and guest_id = v_guest;

  if not found then
    insert into public.guest_views (
      reel_id, study_id, guest_id, view_count, completed,
      last_viewed_at, counted_on, last_session_id
    ) values (
      p_reel_id, v_study, v_guest, 1, coalesce(p_completed, false),
      now(), v_today, p_session_id
    );
    v_counted := true;
    v_new_viewer := true;
    v_new_completion := coalesce(p_completed, false);
  else
    v_new_completion := coalesce(p_completed, false) and not v_existing.completed;
    if v_existing.counted_on is distinct from v_today then
      v_counted := true;
    end if;
    update public.guest_views
    set
      view_count = view_count + case when v_counted then 1 else 0 end,
      completed = completed or coalesce(p_completed, false),
      last_viewed_at = now(),
      counted_on = case when v_counted then v_today else counted_on end,
      last_session_id = coalesce(p_session_id, last_session_id)
    where id = v_existing.id;
  end if;

  insert into public.reel_counters (
    reel_id, study_id, views, viewers, completions
  ) values (
    p_reel_id,
    v_study,
    case when v_counted then 1 else 0 end,
    case when v_new_viewer then 1 else 0 end,
    case when v_new_completion then 1 else 0 end
  )
  on conflict (reel_id) do update set
    views = public.reel_counters.views + case when v_counted then 1 else 0 end,
    viewers = public.reel_counters.viewers + case when v_new_viewer then 1 else 0 end,
    completions = public.reel_counters.completions + case when v_new_completion then 1 else 0 end,
    updated_at = now();

  return jsonb_build_object(
    'counted', v_counted,
    'new_viewer', v_new_viewer,
    'completed', coalesce(p_completed, false)
  );
end;
$$;

revoke all on function public.record_reel_view(uuid, boolean, text) from public;
grant execute on function public.record_reel_view(uuid, boolean, text) to authenticated, service_role;

revoke all on function public.record_guest_reel_view(uuid, boolean, text, text, text) from public;
grant execute on function public.record_guest_reel_view(uuid, boolean, text, text, text) to anon, authenticated, service_role;

-- Historical view_count values were inflated (progress ticks / imports).
-- Treat each existing viewer row as one unique view, then rebuild counters
-- from those rows so reel_counters.views matches reel_views + guest_views.
update public.reel_views
set
  view_count = 1,
  counted_on = coalesce(counted_on, (timezone('utc', last_viewed_at))::date)
where view_count is distinct from 1
   or counted_on is null;

update public.guest_views
set
  view_count = 1,
  counted_on = coalesce(counted_on, (timezone('utc', last_viewed_at))::date)
where view_count is distinct from 1
   or counted_on is null;

insert into public.reel_counters (
  reel_id, study_id, views, viewers, completions
)
select
  r.id,
  r.study_id,
  coalesce(v.views, 0) + coalesce(g.views, 0),
  coalesce(v.viewers, 0) + coalesce(g.viewers, 0),
  coalesce(v.completions, 0) + coalesce(g.completions, 0)
from public.reels r
left join lateral (
  select
    count(*)::int as viewers,
    coalesce(sum(view_count), 0)::int as views,
    count(*) filter (where completed)::int as completions
  from public.reel_views rv
  where rv.reel_id = r.id
) v on true
left join lateral (
  select
    count(*)::int as viewers,
    coalesce(sum(view_count), 0)::int as views,
    count(*) filter (where completed)::int as completions
  from public.guest_views gv
  where gv.reel_id = r.id
) g on true
on conflict (reel_id) do update set
  views = excluded.views,
  viewers = excluded.viewers,
  completions = excluded.completions,
  updated_at = now();

-- Feed tour completion is the product meaning of onboarded_at. Anyone who
-- already has a workspace has clearly gotten past first-run onboarding.
update public.users u
set onboarded_at = coalesce(
  u.onboarded_at,
  (
    select min(w.created_at)
    from public.workspaces w
    where w.created_by = u.id
  ),
  (
    select min(m.created_at)
    from public.workspace_members m
    where m.user_id = u.id
  ),
  (
    select min(s.published_at)
    from public.studies s
    where s.created_by = u.id
      and s.published_at is not null
  )
)
where u.onboarded_at is null
  and exists (
    select 1
    from public.workspace_members m
    where m.user_id = u.id
  );
