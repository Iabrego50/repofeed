-- Pin search_path on helper/trigger functions so a hostile role cannot
-- redirect unqualified names. Also drop the default PUBLIC execute grant
-- on SECURITY DEFINER helpers.

alter function public.is_workspace_member(uuid) set search_path = public, pg_temp;
alter function public.get_workspace_role(uuid) set search_path = public, pg_temp;
alter function public.can_edit_workspace(uuid) set search_path = public, pg_temp;
alter function public.update_updated_at_column() set search_path = public, pg_temp;
alter function public.reel_visible_via_share(uuid) set search_path = public, pg_temp;

-- These three helpers are SECURITY DEFINER and are invoked from RLS
-- policies on tables that anon can query (guest share pages select
-- public.reels; Postgres ORs every permissive policy, including
-- "Workspace members can view reels" which calls is_workspace_member).
-- Revoking EXECUTE from anon would turn those reads into
-- "permission denied for function" instead of a clean RLS miss.
-- Keep anon + authenticated execute; drop the PUBLIC default.
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.get_workspace_role(uuid) from public;
revoke all on function public.can_edit_workspace(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated, service_role;
grant execute on function public.get_workspace_role(uuid) to anon, authenticated, service_role;
grant execute on function public.can_edit_workspace(uuid) to anon, authenticated, service_role;

-- Guest share pages evaluate reel_visible_via_share as anon.
revoke all on function public.reel_visible_via_share(uuid) from public;
grant execute on function public.reel_visible_via_share(uuid) to anon, authenticated, service_role;

-- Trigger function: not called by clients.
revoke all on function public.update_updated_at_column() from public;
revoke all on function public.update_updated_at_column() from anon;
