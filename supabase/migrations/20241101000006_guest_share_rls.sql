-- Guests identified by a share token in the JWT can read only that study's
-- published, enabled reels. The helper is security definer so the EXISTS
-- check is not itself blocked by studies/share_links RLS.
create or replace function public.reel_visible_via_share(reel_study uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.share_links sl
    join public.studies s on s.id = sl.study_id
    where sl.study_id = reel_study
      and sl.revoked = false
      and s.status = 'published'
      and sl.token = coalesce(auth.jwt() ->> 'share_token', '')
  );
$$;

revoke all on function public.reel_visible_via_share(uuid) from public;
grant execute on function public.reel_visible_via_share(uuid) to anon, authenticated;

create policy "Guests can view published reels for a live share token"
  on public.reels for select
  using (
    enabled = true
    and public.reel_visible_via_share(study_id)
  );
