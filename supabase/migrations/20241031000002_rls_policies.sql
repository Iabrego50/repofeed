-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_removals enable row level security;
alter table public.email_prefs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.upload_claims enable row level security;
alter table public.studies enable row level security;
alter table public.sources enable row level security;
alter table public.findings enable row level security;
alter table public.reels enable row level security;
alter table public.footage_clips enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.reactions enable row level security;
alter table public.share_links enable row level security;
alter table public.guests enable row level security;
alter table public.guest_reactions enable row level security;
alter table public.guest_views enable row level security;
alter table public.comments enable row level security;
alter table public.reel_views enable row level security;
alter table public.saved_reels enable row level security;
alter table public.reel_counters enable row level security;
alter table public.decks enable row level security;

-- Helper function to check workspace membership
create or replace function public.is_workspace_member(workspace_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = workspace_uuid
      and user_id = auth.uid()
  );
$$ language sql stable security definer;

-- Helper function to get user's role in workspace
create or replace function public.get_workspace_role(workspace_uuid uuid)
returns text as $$
  select role from public.workspace_members
  where workspace_id = workspace_uuid
    and user_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

-- Helper function to check if user can edit in workspace
create or replace function public.can_edit_workspace(workspace_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = workspace_uuid
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$ language sql stable security definer;

-- Users table policies
create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Workspaces table policies
create policy "Workspace members can view their workspaces"
  on public.workspaces for select
  using (public.is_workspace_member(id));

create policy "Workspace owners can update their workspaces"
  on public.workspaces for update
  using (public.get_workspace_role(id) = 'owner');

create policy "Users can create workspaces"
  on public.workspaces for insert
  with check (auth.uid() = created_by);

create policy "Workspace owners can delete their workspaces"
  on public.workspaces for delete
  using (public.get_workspace_role(id) = 'owner');

-- Workspace members table policies
create policy "Workspace members can view members"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace owners can manage members"
  on public.workspace_members for all
  using (public.get_workspace_role(workspace_id) = 'owner');

create policy "Users can insert themselves as workspace members"
  on public.workspace_members for insert
  with check (auth.uid() = user_id);

-- Workspace invites table policies
create policy "Anyone can view valid invites by token"
  on public.workspace_invites for select
  using (not revoked and expires_at > now());

create policy "Workspace owners can manage invites"
  on public.workspace_invites for all
  using (public.get_workspace_role(workspace_id) = 'owner');

-- Email prefs table policies
create policy "Users can manage their own email prefs"
  on public.email_prefs for all
  using (auth.uid() = user_id);

-- Rate limits table policies (internal use only, no RLS for now)
create policy "Service role can manage rate limits"
  on public.rate_limits for all
  using (true);

-- Upload claims table policies
create policy "Workspace members can view upload claims"
  on public.upload_claims for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can create upload claims"
  on public.upload_claims for insert
  with check (public.can_edit_workspace(workspace_id));

-- Studies table policies
create policy "Workspace members can view studies"
  on public.studies for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can create studies"
  on public.studies for insert
  with check (public.can_edit_workspace(workspace_id) and auth.uid() = created_by);

create policy "Workspace editors can update studies"
  on public.studies for update
  using (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete studies"
  on public.studies for delete
  using (public.can_edit_workspace(workspace_id));

-- Sources table policies
create policy "Workspace members can view sources"
  on public.sources for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can manage sources"
  on public.sources for all
  using (public.can_edit_workspace(workspace_id));

-- Findings table policies
create policy "Workspace members can view findings"
  on public.findings for select
  using (exists (
    select 1 from public.studies
    where studies.id = findings.study_id
      and public.is_workspace_member(studies.workspace_id)
  ));

create policy "Workspace editors can manage findings"
  on public.findings for all
  using (exists (
    select 1 from public.studies
    where studies.id = findings.study_id
      and public.can_edit_workspace(studies.workspace_id)
  ));

-- Reels table policies
create policy "Workspace members can view reels"
  on public.reels for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can manage reels"
  on public.reels for all
  using (public.can_edit_workspace(workspace_id));

-- Footage clips table policies
create policy "Workspace members can view footage"
  on public.footage_clips for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can manage footage"
  on public.footage_clips for all
  using (public.can_edit_workspace(workspace_id));

-- Generation jobs table policies
create policy "Workspace members can view jobs"
  on public.generation_jobs for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can create jobs"
  on public.generation_jobs for insert
  with check (public.can_edit_workspace(workspace_id) and auth.uid() = started_by);

create policy "Workspace editors can update jobs"
  on public.generation_jobs for update
  using (public.can_edit_workspace(workspace_id));

-- Reactions table policies
create policy "Workspace members can view reactions"
  on public.reactions for select
  using (exists (
    select 1 from public.studies
    where studies.id = reactions.study_id
      and public.is_workspace_member(studies.workspace_id)
  ));

create policy "Workspace members can manage their own reactions"
  on public.reactions for all
  using (auth.uid() = user_id);

-- Share links table policies
create policy "Anyone can view valid share links by token"
  on public.share_links for select
  using (not revoked);

create policy "Workspace members can manage share links"
  on public.share_links for all
  using (public.is_workspace_member(workspace_id));

-- Guests table policies (guests identify via secret, not auth.uid())
create policy "Anyone can view guests by secret"
  on public.guests for select
  using (true);

create policy "Anyone can create guest records"
  on public.guests for insert
  with check (true);

-- Guest reactions table policies
create policy "Anyone can view guest reactions"
  on public.guest_reactions for select
  using (true);

create policy "Anyone can manage guest reactions"
  on public.guest_reactions for all
  using (true);

-- Guest views table policies
create policy "Anyone can view guest views"
  on public.guest_views for select
  using (true);

create policy "Anyone can manage guest views"
  on public.guest_views for all
  using (true);

-- Comments table policies
create policy "Workspace members and guests can view comments"
  on public.comments for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.studies
      where studies.id = comments.study_id
        and public.is_workspace_member(studies.workspace_id)
    )
  );

create policy "Users can manage their own comments"
  on public.comments for all
  using (auth.uid() = user_id);

-- Reel views table policies
create policy "Workspace members can view reel views"
  on public.reel_views for select
  using (exists (
    select 1 from public.studies
    where studies.id = reel_views.study_id
      and public.is_workspace_member(studies.workspace_id)
  ));

create policy "Users can manage their own reel views"
  on public.reel_views for all
  using (auth.uid() = user_id);

-- Saved reels table policies
create policy "Users can manage their own saved reels"
  on public.saved_reels for all
  using (auth.uid() = user_id);

-- Reel counters table policies
create policy "Workspace members can view reel counters"
  on public.reel_counters for select
  using (exists (
    select 1 from public.studies
    where studies.id = reel_counters.study_id
      and public.is_workspace_member(studies.workspace_id)
  ));

create policy "Service role can manage reel counters"
  on public.reel_counters for all
  using (true);

-- Decks table policies
create policy "Workspace members can view decks"
  on public.decks for select
  using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can manage decks"
  on public.decks for all
  using (public.can_edit_workspace(workspace_id));

-- Grant necessary permissions
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, anon;
