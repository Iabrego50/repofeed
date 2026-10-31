-- Create storage buckets for file uploads
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false);

insert into storage.buckets (id, name, public)
values ('footage', 'footage', false);

insert into storage.buckets (id, name, public)
values ('generated', 'generated', false);

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
      where upload_claims.storage_id::text = storage.objects.id
        and public.is_workspace_member(upload_claims.workspace_id)
    )
  );

create policy "Users can delete files in their workspaces"
  on storage.objects for delete
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.upload_claims
      where upload_claims.storage_id::text = storage.objects.id
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
      where footage_clips.storage_id::text = storage.objects.id
        and public.is_workspace_member(footage_clips.workspace_id)
    )
  );

create policy "Users can delete footage in their workspaces"
  on storage.objects for delete
  using (
    bucket_id = 'footage'
    and exists (
      select 1 from public.footage_clips
      where footage_clips.storage_id::text = storage.objects.id
        and public.can_edit_workspace(footage_clips.workspace_id)
    )
  );

-- Storage policies for generated bucket (AI-generated images)
create policy "Service role can manage generated content"
  on storage.objects for all
  using (bucket_id = 'generated');

create policy "Users can view generated content in their workspaces"
  on storage.objects for select
  using (
    bucket_id = 'generated'
    and exists (
      select 1 from public.reels
      where (reels.footage->>'storageId')::text = storage.objects.id
        and public.is_workspace_member(reels.workspace_id)
    )
  );
