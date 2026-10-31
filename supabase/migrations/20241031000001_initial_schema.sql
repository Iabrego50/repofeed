-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (synced from Supabase Auth)
create table public.users (
  id uuid primary key references auth.users on delete cascade,
  token_identifier text unique not null,
  name text,
  email text,
  avatar text,
  onboarded_at timestamptz,
  trial_used_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Workspaces table
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references public.users on delete cascade not null,
  customer_id text,
  seat_variant text,
  seats integer,
  billing_return_url text,
  checkout_by uuid references public.users on delete set null,
  paid_plan text check (paid_plan in ('pro', 'team')),
  lapsed_plan text check (lapsed_plan in ('pro', 'team')),
  seat_overage boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Workspace members table
create table public.workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  role text not null check (role in ('owner', 'editor', 'member')),
  created_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);

create index workspace_members_workspace_id_idx on public.workspace_members(workspace_id);
create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_role_idx on public.workspace_members(workspace_id, role);

-- Workspace invites table
create table public.workspace_invites (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  token text unique not null,
  role text not null check (role in ('editor', 'member')),
  expires_at timestamptz not null,
  created_by uuid references public.users on delete cascade not null,
  revoked boolean default false not null,
  uses integer default 0 not null,
  max_uses integer,
  created_at timestamptz default now() not null
);

create index workspace_invites_token_idx on public.workspace_invites(token);
create index workspace_invites_workspace_id_idx on public.workspace_invites(workspace_id);

-- Workspace removals table (prevent re-joining via invite)
create table public.workspace_removals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);

-- Email preferences table
create table public.email_prefs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  new_studies boolean default true not null,
  feedback boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);

-- Rate limits table
create table public.rate_limits (
  id uuid primary key default uuid_generate_v4(),
  key text not null,
  window_start timestamptz not null,
  count integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index rate_limits_key_idx on public.rate_limits(key);

-- Upload claims table (file storage tracking)
create table public.upload_claims (
  id uuid primary key default uuid_generate_v4(),
  storage_id uuid not null,
  workspace_id uuid references public.workspaces on delete cascade not null,
  created_at timestamptz default now() not null
);

create index upload_claims_storage_id_idx on public.upload_claims(storage_id);

-- Studies table
create table public.studies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  title text not null,
  audience text not null,
  goal text,
  status text not null check (status in ('draft', 'processing', 'published', 'failed')),
  tracks jsonb default '[]'::jsonb not null,
  created_by uuid references public.users on delete cascade not null,
  published_at timestamptz,
  last_error text,
  is_demo boolean default false,
  deleting boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index studies_workspace_id_idx on public.studies(workspace_id);
create index studies_workspace_status_idx on public.studies(workspace_id, status);

-- Sources table
create table public.sources (
  id uuid primary key default uuid_generate_v4(),
  study_id uuid references public.studies on delete cascade not null,
  workspace_id uuid references public.workspaces on delete cascade not null,
  name text not null,
  kind text not null check (kind in ('file', 'paste')),
  storage_id uuid,
  text text not null,
  chars integer not null,
  created_at timestamptz default now() not null
);

create index sources_study_id_idx on public.sources(study_id);

-- Findings table
create table public.findings (
  id uuid primary key default uuid_generate_v4(),
  study_id uuid references public.studies on delete cascade not null,
  source_id uuid references public.sources on delete cascade not null,
  chunk_index integer not null,
  type text not null check (type in ('insight', 'quote', 'stat', 'recommendation', 'context')),
  text text not null,
  speaker text,
  number text,
  label text,
  strength integer not null check (strength between 1 and 3),
  created_at timestamptz default now() not null
);

create index findings_study_id_idx on public.findings(study_id);
create index findings_study_chunk_idx on public.findings(study_id, chunk_index);

-- Reels table
create table public.reels (
  id uuid primary key default uuid_generate_v4(),
  study_id uuid references public.studies on delete cascade not null,
  workspace_id uuid references public.workspaces on delete cascade not null,
  position integer not null,
  track text not null,
  track_index integer not null,
  title text not null,
  scenes jsonb not null,
  finding_ids jsonb default '[]'::jsonb not null,
  source_names jsonb default '[]'::jsonb not null,
  warning text,
  enabled boolean default true not null,
  footage jsonb,
  art jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index reels_study_position_idx on public.reels(study_id, position);
create index reels_workspace_id_idx on public.reels(workspace_id);

-- Footage clips table
create table public.footage_clips (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  storage_id uuid not null,
  url text not null,
  name text not null,
  size bigint not null,
  uploaded_by uuid references public.users on delete cascade not null,
  created_at timestamptz default now() not null
);

create index footage_clips_workspace_id_idx on public.footage_clips(workspace_id);

-- Generation jobs table
create table public.generation_jobs (
  id uuid primary key default uuid_generate_v4(),
  study_id uuid references public.studies on delete cascade not null,
  workspace_id uuid references public.workspaces on delete cascade not null,
  status text not null check (status in ('pending', 'running', 'done', 'failed')),
  phase text not null check (phase in ('extracting', 'composing', 'done')),
  cursor integer default 0 not null,
  chunks jsonb default '[]'::jsonb not null,
  attempts integer default 0 not null,
  log jsonb default '[]'::jsonb not null,
  locked_until timestamptz not null,
  error text,
  error_detail text,
  started_by uuid references public.users on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index generation_jobs_study_id_idx on public.generation_jobs(study_id);

-- Reactions table
create table public.reactions (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references public.reels on delete cascade not null,
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  kind text not null check (kind in ('true', 'surprised', 'pushback')),
  created_at timestamptz default now() not null,
  unique(reel_id, user_id, kind)
);

create index reactions_reel_user_idx on public.reactions(reel_id, user_id);
create index reactions_study_id_idx on public.reactions(study_id);

-- Share links table
create table public.share_links (
  id uuid primary key default uuid_generate_v4(),
  study_id uuid references public.studies on delete cascade not null,
  workspace_id uuid references public.workspaces on delete cascade not null,
  token text unique not null,
  created_by uuid references public.users on delete cascade not null,
  revoked boolean default false not null,
  hide_team_comments boolean default false,
  created_at timestamptz default now() not null
);

create index share_links_token_idx on public.share_links(token);
create index share_links_study_id_idx on public.share_links(study_id);

-- Guests table
create table public.guests (
  id uuid primary key default uuid_generate_v4(),
  study_id uuid references public.studies on delete cascade not null,
  link_id uuid references public.share_links on delete cascade not null,
  name text not null,
  secret text unique not null,
  created_at timestamptz default now() not null
);

create index guests_secret_idx on public.guests(secret);
create index guests_study_id_idx on public.guests(study_id);

-- Guest reactions table
create table public.guest_reactions (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references public.reels on delete cascade not null,
  study_id uuid references public.studies on delete cascade not null,
  guest_id uuid references public.guests on delete cascade not null,
  kind text not null check (kind in ('true', 'surprised', 'pushback')),
  created_at timestamptz default now() not null,
  unique(reel_id, guest_id, kind)
);

create index guest_reactions_reel_guest_idx on public.guest_reactions(reel_id, guest_id);
create index guest_reactions_study_id_idx on public.guest_reactions(study_id);

-- Guest views table
create table public.guest_views (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references public.reels on delete cascade not null,
  study_id uuid references public.studies on delete cascade not null,
  guest_id uuid references public.guests on delete cascade not null,
  view_count integer default 0 not null,
  completed boolean default false not null,
  last_viewed_at timestamptz not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(reel_id, guest_id)
);

create index guest_views_reel_guest_idx on public.guest_views(reel_id, guest_id);
create index guest_views_study_id_idx on public.guest_views(study_id);

-- Comments table
create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references public.reels on delete cascade not null,
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references public.users on delete set null,
  guest_id uuid references public.guests on delete set null,
  parent_id uuid references public.comments on delete cascade,
  kind text not null check (kind in ('comment', 'reply')),
  body text not null,
  resolved boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  check ((user_id is not null and guest_id is null) or (user_id is null and guest_id is not null))
);

create index comments_reel_id_idx on public.comments(reel_id);
create index comments_study_id_idx on public.comments(study_id);

-- Reel views table
create table public.reel_views (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references public.reels on delete cascade not null,
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  view_count integer default 0 not null,
  completed boolean default false not null,
  last_viewed_at timestamptz not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(reel_id, user_id)
);

create index reel_views_reel_user_idx on public.reel_views(reel_id, user_id);
create index reel_views_study_id_idx on public.reel_views(study_id);

-- Saved reels table
create table public.saved_reels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users on delete cascade not null,
  workspace_id uuid references public.workspaces on delete cascade not null,
  reel_id uuid references public.reels on delete cascade not null,
  study_id uuid references public.studies on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(reel_id, user_id)
);

create index saved_reels_user_workspace_idx on public.saved_reels(user_id, workspace_id);
create index saved_reels_reel_user_idx on public.saved_reels(reel_id, user_id);
create index saved_reels_study_id_idx on public.saved_reels(study_id);

-- Reel counters table (denormalized counts)
create table public.reel_counters (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references public.reels on delete cascade not null unique,
  study_id uuid references public.studies on delete cascade not null,
  true_count integer default 0 not null,
  surprised_count integer default 0 not null,
  pushback_count integer default 0 not null,
  comment_count integer default 0 not null,
  open_count integer default 0 not null,
  guest_comment_count integer default 0 not null,
  guest_open_count integer default 0 not null,
  views integer default 0 not null,
  viewers integer default 0 not null,
  completions integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index reel_counters_reel_id_idx on public.reel_counters(reel_id);
create index reel_counters_study_id_idx on public.reel_counters(study_id);

-- Decks table
create table public.decks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  scope text not null,
  scope_label text not null,
  created_by uuid references public.users on delete cascade not null,
  slides jsonb default '[]'::jsonb not null,
  stats jsonb not null,
  reels jsonb default '[]'::jsonb not null,
  created_at timestamptz default now() not null
);

create index decks_workspace_scope_idx on public.decks(workspace_id, scope);

-- Create updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger update_users_updated_at before update on public.users
  for each row execute function update_updated_at_column();
create trigger update_workspaces_updated_at before update on public.workspaces
  for each row execute function update_updated_at_column();
create trigger update_email_prefs_updated_at before update on public.email_prefs
  for each row execute function update_updated_at_column();
create trigger update_rate_limits_updated_at before update on public.rate_limits
  for each row execute function update_updated_at_column();
create trigger update_studies_updated_at before update on public.studies
  for each row execute function update_updated_at_column();
create trigger update_reels_updated_at before update on public.reels
  for each row execute function update_updated_at_column();
create trigger update_generation_jobs_updated_at before update on public.generation_jobs
  for each row execute function update_updated_at_column();
create trigger update_guest_views_updated_at before update on public.guest_views
  for each row execute function update_updated_at_column();
create trigger update_comments_updated_at before update on public.comments
  for each row execute function update_updated_at_column();
create trigger update_reel_views_updated_at before update on public.reel_views
  for each row execute function update_updated_at_column();
create trigger update_reel_counters_updated_at before update on public.reel_counters
  for each row execute function update_updated_at_column();
