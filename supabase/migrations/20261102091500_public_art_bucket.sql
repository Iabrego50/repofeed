-- Public bucket for AI reel backdrops. Share pages and the workspace feed
-- load footage.url as <img src> without a storage JWT, so art cannot live in
-- the private `uploads` / `footage` / `generated` buckets.
insert into storage.buckets (id, name, public)
values ('art', 'art', true)
on conflict (id) do update set public = excluded.public;

-- Paint writes with the service-role client. Do not grant anon/authenticated
-- INSERT/UPDATE/DELETE — public only means object GET via /object/public/.
create policy "Service role can manage art"
  on storage.objects for all
  to service_role
  using (bucket_id = 'art')
  with check (bucket_id = 'art');
