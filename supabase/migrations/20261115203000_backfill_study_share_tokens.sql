-- Move legacy studies.share_token / share_enabled into share_links (SSOT for /share/:token).
-- Idempotent: skips tokens already present (including the prod hot-patch row) and
-- skips studies that already have a live share_links row.

-- Revive a revoked row that still matches an enabled study token.
update public.share_links sl
set revoked = false
from public.studies s
where s.share_enabled is true
  and s.share_token is not null
  and length(trim(s.share_token)) > 0
  and sl.study_id = s.id
  and sl.token = s.share_token
  and sl.revoked is true;

insert into public.share_links (
  study_id,
  workspace_id,
  token,
  created_by,
  revoked,
  hide_team_comments
)
select
  s.id,
  s.workspace_id,
  s.share_token,
  s.created_by,
  false,
  true
from public.studies s
where s.share_enabled is true
  and s.share_token is not null
  and length(trim(s.share_token)) > 0
  and not exists (
    select 1
    from public.share_links sl
    where sl.token = s.share_token
  )
  and not exists (
    select 1
    from public.share_links sl
    where sl.study_id = s.id
      and sl.revoked is not true
  )
on conflict (token) do nothing;
