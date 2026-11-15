-- Share-link management is editor/owner only (matches canCreateShareLink / API).
-- Members previously could insert/update/delete share_links via RLS despite API checks.

drop policy if exists "Workspace members can insert share links" on public.share_links;
drop policy if exists "Workspace members can update share links" on public.share_links;
drop policy if exists "Workspace members can delete share links" on public.share_links;
drop policy if exists "Workspace members can manage share links" on public.share_links;

create policy "Workspace editors can insert share links"
  on public.share_links for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update share links"
  on public.share_links for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete share links"
  on public.share_links for delete
  to authenticated
  using (public.can_edit_workspace(workspace_id));
