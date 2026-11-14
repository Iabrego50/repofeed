-- Token-scoped share RPCs for signed-out visitors, plus tighten guests SELECT.
-- Do not open studies or comments to anon. Lookups take the share token
-- (and guest secret where needed) and return only the public share view.

-- ---------------------------------------------------------------------------
-- Guests: stop leaking every row (including secrets) to anon.
-- Workspace members still need SELECT for insights.
-- Inserts go through share_join (SECURITY DEFINER), not the Data API.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can view guests by secret" on public.guests;
drop policy if exists "Anyone can create guest records" on public.guests;

create policy "Workspace members can view study guests"
  on public.guests for select
  to authenticated
  using (
    exists (
      select 1
      from public.studies s
      where s.id = guests.study_id
        and public.is_workspace_member(s.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Internal helper: live (not revoked) link to a published study.
-- Not granted to clients.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.share_live_row as (
    link_id uuid,
    study_id uuid,
    workspace_id uuid,
    hide_team_comments boolean,
    study_title text
  );
exception when duplicate_object then null;
end $$;

create or replace function public.share_live_link(p_token text)
returns table (
  link_id uuid,
  study_id uuid,
  workspace_id uuid,
  hide_team_comments boolean,
  study_title text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sl.id,
    sl.study_id,
    sl.workspace_id,
    coalesce(sl.hide_team_comments, true),
    coalesce(nullif(s.title, ''), 'Untitled Study')
  from public.share_links sl
  join public.studies s on s.id = sl.study_id
  where sl.token = p_token
    and sl.revoked is not true
    and s.status = 'published'
  limit 1;
$$;

revoke all on function public.share_live_link(text) from public;
revoke all on function public.share_live_link(text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- share_load: link + study for a live token, or null.
-- ---------------------------------------------------------------------------
create or replace function public.share_load(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'id', v_link.link_id,
      'study_id', v_link.study_id,
      'workspace_id', v_link.workspace_id,
      'token', trim(p_token),
      'revoked', false,
      'hide_team_comments', v_link.hide_team_comments
    ),
    'study', jsonb_build_object(
      'id', v_link.study_id,
      'title', v_link.study_title,
      'status', 'published'
    )
  );
end;
$$;

revoke all on function public.share_load(text) from public;
grant execute on function public.share_load(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_feed: published scenes + optional named guest for this browser secret.
-- ---------------------------------------------------------------------------
create or replace function public.share_feed(p_token text, p_secret text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
  v_reels jsonb;
  v_guest jsonb;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(row_to_json(reel_row)::jsonb order by reel_row.position, reel_row.created_at),
    '[]'::jsonb
  )
  into v_reels
  from (
    select
      r.*,
      jsonb_build_object('title', v_link.study_title, 'status', 'published') as studies
    from public.reels r
    where r.study_id = v_link.study_id
      and r.enabled = true
  ) reel_row;

  v_guest := null;
  if p_secret is not null and length(trim(p_secret)) > 0 then
    select jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'study_id', g.study_id,
      'link_id', g.link_id
    )
    into v_guest
    from public.guests g
    where g.link_id = v_link.link_id
      and g.secret = trim(p_secret)
      and g.study_id = v_link.study_id
    limit 1;
  end if;

  return jsonb_build_object(
    'studyTitle', v_link.study_title,
    'hideTeamComments', v_link.hide_team_comments,
    'guest', v_guest,
    'reels', v_reels
  );
end;
$$;

revoke all on function public.share_feed(text, text) from public;
grant execute on function public.share_feed(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_join: create a named guest for a live link. Returns secret + id.
-- ---------------------------------------------------------------------------
create or replace function public.share_join(p_token text, p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
  v_name text;
  v_secret text;
  v_guest_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'This link is no longer available';
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    raise exception 'This link is no longer available';
  end if;

  v_name := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  if v_name is null or length(v_name) < 1 then
    raise exception 'Tell us your name to join in';
  end if;

  v_secret := replace(gen_random_uuid()::text, '-', '');

  insert into public.guests (study_id, link_id, name, secret)
  values (v_link.study_id, v_link.link_id, v_name, v_secret)
  returning id into v_guest_id;

  return jsonb_build_object(
    'secret', v_secret,
    'guestId', v_guest_id
  );
end;
$$;

revoke all on function public.share_join(text, text) from public;
grant execute on function public.share_join(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_comments: comments on one published scene, filtered for guests.
-- ---------------------------------------------------------------------------
create or replace function public.share_comments(p_token text, p_reel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
  v_reel_study uuid;
  v_enabled boolean;
  v_comments jsonb;
begin
  if p_token is null or p_reel_id is null then
    raise exception 'This link is no longer available';
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    raise exception 'This link is no longer available';
  end if;

  select r.study_id, r.enabled into v_reel_study, v_enabled
  from public.reels r
  where r.id = p_reel_id;

  if v_reel_study is null or v_reel_study is distinct from v_link.study_id or v_enabled is not true then
    raise exception 'Scene not found';
  end if;

  select coalesce(jsonb_agg(row_to_json(c_row)::jsonb order by c_row.created_at), '[]'::jsonb)
  into v_comments
  from (
    select
      c.id,
      c.reel_id,
      c.study_id,
      c.user_id,
      c.guest_id,
      c.parent_id,
      c.kind,
      c.body,
      c.resolved,
      c.created_at,
      c.updated_at,
      case
        when c.guest_id is not null then jsonb_build_object(
          'name', g.name,
          'email', null,
          'avatar', null
        )
        else jsonb_build_object(
          'name', u.name,
          'email', null,
          'avatar', u.avatar
        )
      end as users
    from public.comments c
    left join public.guests g on g.id = c.guest_id
    left join public.users u on u.id = c.user_id
    where c.reel_id = p_reel_id
      and (
        v_link.hide_team_comments is not true
        or c.guest_id is not null
      )
  ) c_row;

  return v_comments;
end;
$$;

revoke all on function public.share_comments(text, uuid) from public;
grant execute on function public.share_comments(text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_add_comment: named guest posts on a live shared scene.
-- ---------------------------------------------------------------------------
create or replace function public.share_add_comment(
  p_token text,
  p_secret text,
  p_reel_id uuid,
  p_kind text,
  p_body text,
  p_parent_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
  v_guest_id uuid;
  v_guest_name text;
  v_reel_study uuid;
  v_enabled boolean;
  v_body text;
  v_comment public.comments%rowtype;
begin
  if p_token is null or p_secret is null or p_reel_id is null then
    raise exception 'This link is no longer available';
  end if;

  if p_kind is null or p_kind not in ('note', 'question', 'action') then
    raise exception 'Invalid comment type';
  end if;

  v_body := trim(coalesce(p_body, ''));
  if length(v_body) < 1 then
    raise exception 'Write a comment first';
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    raise exception 'This link is no longer available';
  end if;

  select g.id, g.name into v_guest_id, v_guest_name
  from public.guests g
  where g.link_id = v_link.link_id
    and g.secret = trim(p_secret)
    and g.study_id = v_link.study_id
  limit 1;

  if v_guest_id is null then
    raise exception 'Tell us your name to join in';
  end if;

  select r.study_id, r.enabled into v_reel_study, v_enabled
  from public.reels r
  where r.id = p_reel_id;

  if v_reel_study is null or v_reel_study is distinct from v_link.study_id or v_enabled is not true then
    raise exception 'Scene not found';
  end if;

  if p_parent_id is not null then
    if not exists (
      select 1 from public.comments c
      where c.id = p_parent_id and c.reel_id = p_reel_id
    ) then
      raise exception 'Comment not found';
    end if;
  end if;

  insert into public.comments (
    reel_id, study_id, guest_id, kind, body, parent_id, resolved
  ) values (
    p_reel_id, v_link.study_id, v_guest_id, p_kind, v_body, p_parent_id, false
  ) returning * into v_comment;

  return jsonb_build_object(
    'id', v_comment.id,
    'reel_id', v_comment.reel_id,
    'study_id', v_comment.study_id,
    'user_id', v_comment.user_id,
    'guest_id', v_comment.guest_id,
    'parent_id', v_comment.parent_id,
    'kind', v_comment.kind,
    'body', v_comment.body,
    'resolved', v_comment.resolved,
    'created_at', v_comment.created_at,
    'updated_at', v_comment.updated_at,
    'users', jsonb_build_object('name', v_guest_name, 'email', null, 'avatar', null)
  );
end;
$$;

revoke all on function public.share_add_comment(text, text, uuid, text, text, uuid) from public;
grant execute on function public.share_add_comment(text, text, uuid, text, text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_react: named guest reaction on a live shared scene.
-- ---------------------------------------------------------------------------
create or replace function public.share_react(
  p_token text,
  p_secret text,
  p_reel_id uuid,
  p_kind text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
  v_guest_id uuid;
  v_reel_study uuid;
  v_enabled boolean;
begin
  if p_token is null or p_secret is null or p_reel_id is null then
    raise exception 'This link is no longer available';
  end if;

  if p_kind is null or p_kind not in ('true', 'surprised', 'pushback') then
    raise exception 'Invalid reaction';
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    raise exception 'This link is no longer available';
  end if;

  select g.id into v_guest_id
  from public.guests g
  where g.link_id = v_link.link_id
    and g.secret = trim(p_secret)
    and g.study_id = v_link.study_id
  limit 1;

  if v_guest_id is null then
    raise exception 'Tell us your name to join in';
  end if;

  select r.study_id, r.enabled into v_reel_study, v_enabled
  from public.reels r
  where r.id = p_reel_id;

  if v_reel_study is null or v_reel_study is distinct from v_link.study_id or v_enabled is not true then
    raise exception 'Scene not found';
  end if;

  insert into public.guest_reactions (reel_id, study_id, guest_id, kind)
  values (p_reel_id, v_link.study_id, v_guest_id, p_kind)
  on conflict (reel_id, guest_id, kind) do nothing;

  return to_jsonb(p_kind);
end;
$$;

revoke all on function public.share_react(text, text, uuid, text) from public;
grant execute on function public.share_react(text, text, uuid, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_evidence: findings cited by a live shared scene.
-- ---------------------------------------------------------------------------
create or replace function public.share_evidence(p_token text, p_reel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_live_row;
  v_reel_study uuid;
  v_enabled boolean;
  v_finding_ids jsonb;
  v_findings jsonb;
begin
  if p_token is null or p_reel_id is null then
    raise exception 'This link is no longer available';
  end if;

  select * into v_link from public.share_live_link(trim(p_token));
  if v_link.link_id is null then
    raise exception 'This link is no longer available';
  end if;

  select r.study_id, r.enabled, r.finding_ids
  into v_reel_study, v_enabled, v_finding_ids
  from public.reels r
  where r.id = p_reel_id;

  if v_reel_study is null or v_reel_study is distinct from v_link.study_id or v_enabled is not true then
    raise exception 'Scene not found';
  end if;

  if v_finding_ids is null or jsonb_typeof(v_finding_ids) <> 'array' or jsonb_array_length(v_finding_ids) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(f_row)::jsonb), '[]'::jsonb)
  into v_findings
  from (
    select
      f.id,
      f.study_id,
      f.type,
      f.text,
      f.speaker,
      f.number,
      f.label,
      f.created_at
    from public.findings f
    where f.study_id = v_link.study_id
      and f.id in (
        select jsonb_array_elements_text(v_finding_ids)::uuid
      )
  ) f_row;

  return v_findings;
end;
$$;

revoke all on function public.share_evidence(text, uuid) from public;
grant execute on function public.share_evidence(text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- share_public_token: live token for a published, enabled reel (landing ?reel=).
-- ---------------------------------------------------------------------------
create or replace function public.share_public_token(p_reel_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sl.token
  from public.reels r
  join public.studies s on s.id = r.study_id
  join public.share_links sl on sl.study_id = s.id
  where r.id = p_reel_id
    and r.enabled = true
    and s.status = 'published'
    and sl.revoked is not true
  limit 1;
$$;

revoke all on function public.share_public_token(uuid) from public;
grant execute on function public.share_public_token(uuid) to anon, authenticated, service_role;
