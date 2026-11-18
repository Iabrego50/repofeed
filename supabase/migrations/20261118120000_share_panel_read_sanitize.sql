-- Harden share_comments / share_evidence for the read-only share panel.
-- Return only fields the panel needs; never emails, user/guest/workspace ids,
-- or avatars. Author shown as display name, or 'Team member' when missing.
-- Scoped to the live share token's published study (via share_live_link).

-- ---------------------------------------------------------------------------
-- share_comments: discussion list for anonymous share viewers
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
      c.parent_id,
      c.kind,
      c.body,
      c.resolved,
      c.created_at,
      c.updated_at,
      jsonb_build_object(
        'name', coalesce(
          nullif(
            trim(
              case
                when c.guest_id is not null then g.name
                else u.name
              end
            ),
            ''
          ),
          'Team member'
        ),
        'email', null,
        'avatar', null
      ) as users
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
-- share_evidence: findings cited by a live shared scene (no study_id)
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
