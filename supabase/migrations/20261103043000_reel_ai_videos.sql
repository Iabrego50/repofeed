-- Public bucket for AI-generated reel background videos. Share pages and the
-- workspace feed load footage.url as <video src> without a storage JWT, so
-- these cannot live in the private `uploads` / `footage` / `generated` buckets.
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do update set public = excluded.public;

-- Video writes use the service-role client. Public only means object GET via
-- /object/public/. Do not grant anon/authenticated INSERT/UPDATE/DELETE.
drop policy if exists "Service role can manage videos" on storage.objects;
create policy "Service role can manage videos"
  on storage.objects for all
  to service_role
  using (bucket_id = 'videos')
  with check (bucket_id = 'videos');

alter table public.reels add column if not exists video jsonb;

create index if not exists reels_video_status_idx on public.reels ((video->>'status'));
