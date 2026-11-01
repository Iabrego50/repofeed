-- Create storage buckets for file uploads
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('footage', 'footage', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('generated', 'generated', false)
on conflict (id) do nothing;

-- App code stores the Storage object path in storage_id (and
-- reels.footage.storageId) and passes that path to storage.remove().
-- Match storage.objects.name, not storage.objects.id (uuid).

-- Storage policies for uploads bucket
create policy "Authenticated users can upload files"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads'
    and auth.role() = 'authenticated'
  );

create policy "Users can view files in their workspaces"
  on storage.objects for select
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.upload_claims
      where upload_claims.storage_id::text = storage.objects.name
        and public.is_workspace_member(upload_claims.workspace_id)
    )
  );

create policy "Users can delete files in their workspaces"
  on storage.objects for delete
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.upload_claims
      where upload_claims.storage_id::text = storage.objects.name
        and public.can_edit_workspace(upload_claims.workspace_id)
    )
  );

-- Storage policies for footage bucket
create policy "Authenticated users can upload footage"
  on storage.objects for insert
  with check (
    bucket_id = 'footage'
    and auth.role() = 'authenticated'
  );

create policy "Users can view footage in their workspaces"
  on storage.objects for select
  using (
    bucket_id = 'footage'
    and exists (
      select 1 from public.footage_clips
      where footage_clips.storage_id::text = storage.objects.name
        and public.is_workspace_member(footage_clips.workspace_id)
    )
  );

create policy "Users can delete footage in their workspaces"
  on storage.objects for delete
  using (
    bucket_id = 'footage'
    and exists (
      select 1 from public.footage_clips
      where footage_clips.storage_id::text = storage.objects.name
        and public.can_edit_workspace(footage_clips.workspace_id)
    )
  );

-- Service role writes generated images (api/art/paint.ts currently
-- uploads via the backend client). Do not grant anon/authenticated
-- ALL access — the previous policy had no TO clause.
create policy "Service role can manage generated content"
  on storage.objects for all
  to service_role
  using (bucket_id = 'generated')
  with check (bucket_id = 'generated');

-- Workspace members can read generated objects referenced from their
-- reels (signed URL / client download). Share pages render footage.url
-- from the reel row, not storage.objects, so anon does not need SELECT.
create policy "Users can view generated content in their workspaces"
  on storage.objects for select
  using (
    bucket_id = 'generated'
    and exists (
      select 1 from public.reels
      where (reels.footage->>'storageId') = storage.objects.name
        and public.is_workspace_member(reels.workspace_id)
    )
  );
