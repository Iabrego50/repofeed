-- Security + performance hardening. Does not drop tables or data.
--
-- Decisions:
-- 1. Revoke EXECUTE from anon on can_edit_workspace, get_workspace_role,
--    and is_workspace_member. Membership policies are now TO authenticated
--    so anon never invokes those helpers.
-- 2. Keep EXECUTE on reel_visible_via_share for anon AND authenticated.
--    Share pages evaluate that helper as the anon role via the guest reel
--    SELECT policy. Revoking it would break public share links.
-- 3. workspace_removals stays RLS-on. Add an explicit restrictive deny
--    for anon/authenticated. Service role still writes (RLS bypass).
-- 4. Rewrite remaining auth.uid() / auth.role() calls as
--    (select auth.uid()) / (select auth.role()).
-- 5. Split FOR ALL "manage" policies that duplicated SELECT with a
--    member-view policy. Merge the two workspace_members INSERT policies.
-- 6. Add covering indexes for unindexed foreign keys.

-- ---------------------------------------------------------------------------
-- Privileges on SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------
revoke execute on function public.can_edit_workspace(uuid) from anon;
revoke execute on function public.get_workspace_role(uuid) from anon;
revoke execute on function public.is_workspace_member(uuid) from anon;
grant execute on function public.can_edit_workspace(uuid) to authenticated, service_role;
grant execute on function public.get_workspace_role(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;

-- Share links still need this as anon.
revoke all on function public.reel_visible_via_share(uuid) from public;
grant execute on function public.reel_visible_via_share(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- workspace_removals: explicit deny (RLS already enabled, no permissive policy)
-- ---------------------------------------------------------------------------
drop policy if exists "Deny all client access to workspace_removals" on public.workspace_removals;
create policy "Deny all client access to workspace_removals"
  on public.workspace_removals
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- Indexes for unindexed foreign keys
-- ---------------------------------------------------------------------------
create index if not exists workspaces_created_by_idx on public.workspaces (created_by);
create index if not exists workspaces_checkout_by_idx on public.workspaces (checkout_by);
create index if not exists workspace_invites_created_by_idx on public.workspace_invites (created_by);
create index if not exists workspace_removals_user_id_idx on public.workspace_removals (user_id);
create index if not exists email_prefs_user_id_idx on public.email_prefs (user_id);
create index if not exists upload_claims_workspace_id_idx on public.upload_claims (workspace_id);
create index if not exists studies_created_by_idx on public.studies (created_by);
create index if not exists sources_workspace_id_idx on public.sources (workspace_id);
create index if not exists findings_source_id_idx on public.findings (source_id);
create index if not exists footage_clips_uploaded_by_idx on public.footage_clips (uploaded_by);
create index if not exists generation_jobs_workspace_id_idx on public.generation_jobs (workspace_id);
create index if not exists generation_jobs_started_by_idx on public.generation_jobs (started_by);
create index if not exists reactions_user_id_idx on public.reactions (user_id);
create index if not exists share_links_workspace_id_idx on public.share_links (workspace_id);
create index if not exists share_links_created_by_idx on public.share_links (created_by);
create index if not exists guests_link_id_idx on public.guests (link_id);
create index if not exists guest_reactions_guest_id_idx on public.guest_reactions (guest_id);
create index if not exists guest_views_guest_id_idx on public.guest_views (guest_id);
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists comments_guest_id_idx on public.comments (guest_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);
create index if not exists reel_views_user_id_idx on public.reel_views (user_id);
create index if not exists saved_reels_workspace_id_idx on public.saved_reels (workspace_id);
create index if not exists decks_created_by_idx on public.decks (created_by);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------
drop policy if exists "Workspace members can view their workspaces" on public.workspaces;
create policy "Workspace members can view their workspaces"
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id));

drop policy if exists "Workspace owners can update their workspaces" on public.workspaces;
create policy "Workspace owners can update their workspaces"
  on public.workspaces for update
  to authenticated
  using (public.get_workspace_role(id) = 'owner');

drop policy if exists "Users can create workspaces" on public.workspaces;
create policy "Users can create workspaces"
  on public.workspaces for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

drop policy if exists "Workspace owners can delete their workspaces" on public.workspaces;
create policy "Workspace owners can delete their workspaces"
  on public.workspaces for delete
  to authenticated
  using (public.get_workspace_role(id) = 'owner');

-- ---------------------------------------------------------------------------
-- Workspace members: one SELECT, one merged INSERT, owner UPDATE/DELETE
-- ---------------------------------------------------------------------------
drop policy if exists "Workspace members can view members" on public.workspace_members;
create policy "Workspace members can view members"
  on public.workspace_members for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace owners can manage members" on public.workspace_members;
drop policy if exists "Users can insert themselves as workspace members" on public.workspace_members;
create policy "Users or owners can insert workspace members"
  on public.workspace_members for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    or public.get_workspace_role(workspace_id) = 'owner'
  );

create policy "Workspace owners can update members"
  on public.workspace_members for update
  to authenticated
  using (public.get_workspace_role(workspace_id) = 'owner');

create policy "Workspace owners can delete members"
  on public.workspace_members for delete
  to authenticated
  using (public.get_workspace_role(workspace_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can view valid invites by token" on public.workspace_invites;
create policy "Anyone can view valid invites by token"
  on public.workspace_invites for select
  to anon, authenticated
  using (not revoked and expires_at > now());

drop policy if exists "Workspace owners can manage invites" on public.workspace_invites;
create policy "Workspace owners can insert invites"
  on public.workspace_invites for insert
  to authenticated
  with check (public.get_workspace_role(workspace_id) = 'owner');

create policy "Workspace owners can update invites"
  on public.workspace_invites for update
  to authenticated
  using (public.get_workspace_role(workspace_id) = 'owner');

create policy "Workspace owners can delete invites"
  on public.workspace_invites for delete
  to authenticated
  using (public.get_workspace_role(workspace_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Email prefs / rate limits / upload claims
-- ---------------------------------------------------------------------------
drop policy if exists "Users can manage their own email prefs" on public.email_prefs;
create policy "Users can manage their own email prefs"
  on public.email_prefs for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Service role can manage rate limits" on public.rate_limits;
create policy "Service role can manage rate limits"
  on public.rate_limits for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Workspace members can view upload claims" on public.upload_claims;
create policy "Workspace members can view upload claims"
  on public.upload_claims for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can create upload claims" on public.upload_claims;
create policy "Workspace editors can create upload claims"
  on public.upload_claims for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id));

-- ---------------------------------------------------------------------------
-- Studies / sources / findings
-- ---------------------------------------------------------------------------
drop policy if exists "Workspace members can view studies" on public.studies;
create policy "Workspace members can view studies"
  on public.studies for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can create studies" on public.studies;
create policy "Workspace editors can create studies"
  on public.studies for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id) and (select auth.uid()) = created_by);

drop policy if exists "Workspace editors can update studies" on public.studies;
create policy "Workspace editors can update studies"
  on public.studies for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace editors can delete studies" on public.studies;
create policy "Workspace editors can delete studies"
  on public.studies for delete
  to authenticated
  using (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can view sources" on public.sources;
create policy "Workspace members can view sources"
  on public.sources for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can manage sources" on public.sources;
create policy "Workspace editors can insert sources"
  on public.sources for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update sources"
  on public.sources for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete sources"
  on public.sources for delete
  to authenticated
  using (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can view findings" on public.findings;
create policy "Workspace members can view findings"
  on public.findings for select
  to authenticated
  using (exists (
    select 1 from public.studies
    where studies.id = findings.study_id
      and public.is_workspace_member(studies.workspace_id)
  ));

drop policy if exists "Workspace editors can manage findings" on public.findings;
create policy "Workspace editors can insert findings"
  on public.findings for insert
  to authenticated
  with check (exists (
    select 1 from public.studies
    where studies.id = findings.study_id
      and public.can_edit_workspace(studies.workspace_id)
  ));

create policy "Workspace editors can update findings"
  on public.findings for update
  to authenticated
  using (exists (
    select 1 from public.studies
    where studies.id = findings.study_id
      and public.can_edit_workspace(studies.workspace_id)
  ));

create policy "Workspace editors can delete findings"
  on public.findings for delete
  to authenticated
  using (exists (
    select 1 from public.studies
    where studies.id = findings.study_id
      and public.can_edit_workspace(studies.workspace_id)
  ));

-- ---------------------------------------------------------------------------
-- Reels / footage / jobs
-- ---------------------------------------------------------------------------
drop policy if exists "Workspace members can view reels" on public.reels;
create policy "Workspace members can view reels"
  on public.reels for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can manage reels" on public.reels;
create policy "Workspace editors can insert reels"
  on public.reels for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update reels"
  on public.reels for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete reels"
  on public.reels for delete
  to authenticated
  using (public.can_edit_workspace(workspace_id));

drop policy if exists "Guests can view published reels for a live share token" on public.reels;
create policy "Guests can view published reels for a live share token"
  on public.reels for select
  to anon, authenticated
  using (
    enabled = true
    and public.reel_visible_via_share(study_id)
  );

drop policy if exists "Workspace members can view footage" on public.footage_clips;
create policy "Workspace members can view footage"
  on public.footage_clips for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can manage footage" on public.footage_clips;
create policy "Workspace editors can insert footage"
  on public.footage_clips for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update footage"
  on public.footage_clips for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete footage"
  on public.footage_clips for delete
  to authenticated
  using (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can view jobs" on public.generation_jobs;
create policy "Workspace members can view jobs"
  on public.generation_jobs for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can create jobs" on public.generation_jobs;
create policy "Workspace editors can create jobs"
  on public.generation_jobs for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id) and (select auth.uid()) = started_by);

drop policy if exists "Workspace editors can update jobs" on public.generation_jobs;
create policy "Workspace editors can update jobs"
  on public.generation_jobs for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

-- ---------------------------------------------------------------------------
-- Reactions / comments / views / saved
-- ---------------------------------------------------------------------------
drop policy if exists "Workspace members can view reactions" on public.reactions;
drop policy if exists "Workspace members can manage their own reactions" on public.reactions;
create policy "Workspace members can view reactions"
  on public.reactions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.studies
      where studies.id = reactions.study_id
        and public.is_workspace_member(studies.workspace_id)
    )
  );

create policy "Users can insert their own reactions"
  on public.reactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own reactions"
  on public.reactions for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own reactions"
  on public.reactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can view valid share links by token" on public.share_links;
create policy "Anyone can view valid share links by token"
  on public.share_links for select
  to anon, authenticated
  using (not revoked);

drop policy if exists "Workspace members can manage share links" on public.share_links;
create policy "Workspace members can insert share links"
  on public.share_links for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "Workspace members can update share links"
  on public.share_links for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can delete share links"
  on public.share_links for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Anyone can view guests by secret" on public.guests;
create policy "Anyone can view guests by secret"
  on public.guests for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can create guest records" on public.guests;
create policy "Anyone can create guest records"
  on public.guests for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can view guest reactions" on public.guest_reactions;
drop policy if exists "Anyone can manage guest reactions" on public.guest_reactions;
create policy "Anyone can manage guest reactions"
  on public.guest_reactions for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Anyone can view guest views" on public.guest_views;
drop policy if exists "Anyone can manage guest views" on public.guest_views;
create policy "Anyone can manage guest views"
  on public.guest_views for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Workspace members and guests can view comments" on public.comments;
drop policy if exists "Users can manage their own comments" on public.comments;
create policy "Users can view own or workspace comments"
  on public.comments for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.studies
      where studies.id = comments.study_id
        and public.is_workspace_member(studies.workspace_id)
    )
  );

create policy "Users can insert their own comments"
  on public.comments for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own comments"
  on public.comments for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Workspace members can view reel views" on public.reel_views;
drop policy if exists "Users can manage their own reel views" on public.reel_views;
create policy "Workspace members can view reel views"
  on public.reel_views for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.studies
      where studies.id = reel_views.study_id
        and public.is_workspace_member(studies.workspace_id)
    )
  );

create policy "Users can insert their own reel views"
  on public.reel_views for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own reel views"
  on public.reel_views for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own reel views"
  on public.reel_views for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own saved reels" on public.saved_reels;
create policy "Users can manage their own saved reels"
  on public.saved_reels for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Workspace members can view reel counters" on public.reel_counters;
create policy "Workspace members can view reel counters"
  on public.reel_counters for select
  to authenticated
  using (exists (
    select 1 from public.studies
    where studies.id = reel_counters.study_id
      and public.is_workspace_member(studies.workspace_id)
  ));

drop policy if exists "Service role can manage reel counters" on public.reel_counters;
create policy "Service role can manage reel counters"
  on public.reel_counters for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Workspace members can view decks" on public.decks;
create policy "Workspace members can view decks"
  on public.decks for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can manage decks" on public.decks;
create policy "Workspace editors can insert decks"
  on public.decks for insert
  to authenticated
  with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update decks"
  on public.decks for update
  to authenticated
  using (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete decks"
  on public.decks for delete
  to authenticated
  using (public.can_edit_workspace(workspace_id));

-- ---------------------------------------------------------------------------
-- Storage: initplan + authenticated-only membership checks
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can upload files" on storage.objects;
create policy "Authenticated users can upload files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'uploads'
    and (select auth.role()) = 'authenticated'
  );

drop policy if exists "Users can view files in their workspaces" on storage.objects;
create policy "Users can view files in their workspaces"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.upload_claims
      where upload_claims.storage_id::text = storage.objects.name
        and public.is_workspace_member(upload_claims.workspace_id)
    )
  );

drop policy if exists "Users can delete files in their workspaces" on storage.objects;
create policy "Users can delete files in their workspaces"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.upload_claims
      where upload_claims.storage_id::text = storage.objects.name
        and public.can_edit_workspace(upload_claims.workspace_id)
    )
  );

drop policy if exists "Authenticated users can upload footage" on storage.objects;
create policy "Authenticated users can upload footage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'footage'
    and (select auth.role()) = 'authenticated'
  );

drop policy if exists "Users can view footage in their workspaces" on storage.objects;
create policy "Users can view footage in their workspaces"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'footage'
    and exists (
      select 1 from public.footage_clips
      where footage_clips.storage_id::text = storage.objects.name
        and public.is_workspace_member(footage_clips.workspace_id)
    )
  );

drop policy if exists "Users can delete footage in their workspaces" on storage.objects;
create policy "Users can delete footage in their workspaces"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'footage'
    and exists (
      select 1 from public.footage_clips
      where footage_clips.storage_id::text = storage.objects.name
        and public.can_edit_workspace(footage_clips.workspace_id)
    )
  );

drop policy if exists "Users can view generated content in their workspaces" on storage.objects;
create policy "Users can view generated content in their workspaces"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated'
    and exists (
      select 1 from public.reels
      where (reels.footage->>'storageId') = storage.objects.name
        and public.is_workspace_member(reels.workspace_id)
    )
  );
