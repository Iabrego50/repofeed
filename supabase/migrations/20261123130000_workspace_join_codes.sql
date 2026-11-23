-- Short regenerable join codes for teams (native viewers + web creators).
-- Redeem via security-definer RPC so non-members never need a SELECT on workspaces.

alter table public.workspaces
  add column if not exists join_code text;

-- Case-insensitive uniqueness (codes stored uppercase).
create unique index if not exists workspaces_join_code_uidx
  on public.workspaces (join_code)
  where join_code is not null;

comment on column public.workspaces.join_code is
  'Short uppercase team join code. Prefer get/regenerate RPCs over reading this column.';

-- Alphabet omits 0/O/1/I/L to reduce misreads when sharing verbally.
create or replace function public._join_code_alphabet()
returns text
language sql
immutable
as $$
  select '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
$$;

create or replace function public.generate_workspace_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := public._join_code_alphabet();
  candidate text;
  i int;
  attempts int := 0;
begin
  loop
    attempts := attempts + 1;
    if attempts > 40 then
      raise exception 'Could not allocate a unique join code';
    end if;
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.workspaces w where w.join_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_workspace_join_code() from public;
grant execute on function public.generate_workspace_join_code() to service_role;

create or replace function public.workspaces_set_join_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.join_code is null or btrim(new.join_code) = '' then
    new.join_code := public.generate_workspace_join_code();
  else
    new.join_code := upper(regexp_replace(new.join_code, '\s+', '', 'g'));
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_set_join_code on public.workspaces;
create trigger workspaces_set_join_code
  before insert or update of join_code
  on public.workspaces
  for each row
  execute function public.workspaces_set_join_code();

-- Backfill existing teams.
update public.workspaces
set join_code = public.generate_workspace_join_code()
where join_code is null;

alter table public.workspaces
  alter column join_code set not null;

create or replace function public.normalize_join_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
$$;

-- Rate-limit redeems: 10 attempts per 15 minutes per user.
create or replace function public.assert_join_code_rate_limit()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rate_key text;
  since timestamptz := now() - interval '15 minutes';
  attempts int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  rate_key := 'join_code:' || uid::text;

  select coalesce(sum(rl.count), 0) into attempts
  from public.rate_limits rl
  where rl.key = rate_key
    and rl.window_start >= since;

  if attempts >= 10 then
    raise exception 'Too many join attempts. Try again in a few minutes.';
  end if;

  insert into public.rate_limits (key, window_start, count)
  values (rate_key, now(), 1);
end;
$$;

revoke all on function public.assert_join_code_rate_limit() from public;

create or replace function public.redeem_join_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text := public.normalize_join_code(p_code);
  ws_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if normalized is null or length(normalized) < 6 or length(normalized) > 12 then
    perform public.assert_join_code_rate_limit();
    raise exception 'That join code is not valid';
  end if;

  perform public.assert_join_code_rate_limit();

  select w.id into ws_id
  from public.workspaces w
  where w.join_code = normalized
  limit 1;

  if ws_id is null then
    raise exception 'That join code is not valid';
  end if;

  if exists (
    select 1 from public.workspace_removals r
    where r.workspace_id = ws_id and r.user_id = uid
  ) then
    raise exception 'You were removed from this workspace and cannot rejoin';
  end if;

  if exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws_id and m.user_id = uid
  ) then
    return ws_id;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'member');

  return ws_id;
end;
$$;

revoke all on function public.redeem_join_code(text) from public;
grant execute on function public.redeem_join_code(text) to authenticated;

create or replace function public.get_workspace_join_code(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_edit_workspace(p_workspace_id) then
    raise exception 'Not authorized';
  end if;

  select w.join_code into code
  from public.workspaces w
  where w.id = p_workspace_id;

  if code is null then
    raise exception 'Workspace not found';
  end if;
  return code;
end;
$$;

revoke all on function public.get_workspace_join_code(uuid) from public;
grant execute on function public.get_workspace_join_code(uuid) to authenticated;

create or replace function public.regenerate_workspace_join_code(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_edit_workspace(p_workspace_id) then
    raise exception 'Not authorized';
  end if;

  new_code := public.generate_workspace_join_code();

  update public.workspaces
  set join_code = new_code,
      updated_at = now()
  where id = p_workspace_id;

  if not found then
    raise exception 'Workspace not found';
  end if;

  return new_code;
end;
$$;

revoke all on function public.regenerate_workspace_join_code(uuid) from public;
grant execute on function public.regenerate_workspace_join_code(uuid) to authenticated;

comment on function public.redeem_join_code(text) is
  'Adds the signed-in user as a member via a short team join code. Rate-limited.';
comment on function public.get_workspace_join_code(uuid) is
  'Returns the join code for editors/owners of the workspace.';
comment on function public.regenerate_workspace_join_code(uuid) is
  'Rotates the workspace join code. Prior codes stop working immediately.';
