-- Match production: share_links SELECT is editor/owner only.
-- Public/guest share access goes through SECURITY DEFINER RPCs (share_load, etc.),
-- not direct table SELECT. Anon must not read share_links by token.

drop policy if exists "Anyone can view valid share links by token" on public.share_links;
drop policy if exists "Workspace editors can view share links" on public.share_links;
create policy "Workspace editors can view share links"
  on public.share_links for select
  to authenticated
  using (public.can_edit_workspace(workspace_id));
revoke select on public.share_links from anon;
