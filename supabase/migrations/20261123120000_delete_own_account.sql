-- Account deletion for App Store guideline 5.1.1(v).
-- Call via POST /api/account/delete (preferred) or rpc('delete_own_account').
-- Deletes the caller's auth.users row; public.users and related rows cascade.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = uid;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is
  'Permanently deletes the signed-in user (auth.users). Cascades to public app data.';
