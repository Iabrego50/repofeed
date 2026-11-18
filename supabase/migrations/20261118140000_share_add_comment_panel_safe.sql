-- Harden share_add_comment return shape to match share_comments (panel-safe).
-- Omit study_id / user_id / guest_id from the network response; keep display name only.

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
    'parent_id', v_comment.parent_id,
    'kind', v_comment.kind,
    'body', v_comment.body,
    'resolved', v_comment.resolved,
    'created_at', v_comment.created_at,
    'updated_at', v_comment.updated_at,
    'users', jsonb_build_object(
      'name', coalesce(nullif(trim(v_guest_name), ''), 'Guest'),
      'email', null,
      'avatar', null
    )
  );
end;
$$;

revoke all on function public.share_add_comment(text, text, uuid, text, text, uuid) from public;
grant execute on function public.share_add_comment(text, text, uuid, text, text, uuid) to anon, authenticated, service_role;
