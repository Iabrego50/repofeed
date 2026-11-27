-- Allow workspace creators to SELECT the row they just inserted.
-- createWorkspace() does insert(...).select().single(); RETURNING is checked
-- against SELECT policies. Before the creator has a workspace_members row,
-- is_workspace_member(id) is false, so INSERT...RETURNING failed with 403 RLS.
-- Live DB is patched separately — this migration keeps repo + CI in sync.

drop policy if exists "Workspace members can view their workspaces" on public.workspaces;

create policy "Workspace members can view their workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    public.is_workspace_member(id)
    or created_by = (select auth.uid())
  );
