-- Private /admin/analytics access. Clients cannot flip this flag.
-- 1528fa82-5a57-4d9f-a6b1-fc902d747593 is the owner of the Demo and PCG
-- workspaces (Isaac Abrego).

alter table public.users
  add column if not exists is_admin boolean not null default false;

comment on column public.users.is_admin is
  'Server-checked product-admin flag. Only service role may change it.';

create or replace function public.protect_users_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(nullif(auth.role(), ''), current_user);
begin
  -- SECURITY DEFINER runs as the table owner, so auth.role() is the caller.
  -- Bare SQL (migrations) has no JWT; current_user is postgres.
  if v_role not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    else
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_users_is_admin on public.users;
create trigger protect_users_is_admin
  before insert or update on public.users
  for each row execute function public.protect_users_is_admin();

revoke all on function public.protect_users_is_admin() from public;
revoke all on function public.protect_users_is_admin() from anon, authenticated;

revoke update (is_admin) on public.users from anon, authenticated;

update public.users
set is_admin = true
where id = '1528fa82-5a57-4d9f-a6b1-fc902d747593';
