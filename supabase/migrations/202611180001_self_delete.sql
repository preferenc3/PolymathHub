begin;

create or replace function public.polymath_delete_own_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller uuid := auth.uid();
begin
  -- This session must have been created by a new login, rather than a token refresh.
  if caller is null or not exists (
    select 1
    from auth.sessions s
    where s.user_id = caller
      and s.id::text = auth.jwt() ->> 'session_id'
      and s.created_at >= statement_timestamp() - interval '90 seconds'
  ) then
    return false;
  end if;

  delete from auth.users where id = caller;
  return found;
end;
$function$;

revoke all on function public.polymath_delete_own_account() from public, anon, authenticated;
grant execute on function public.polymath_delete_own_account() to authenticated;

commit;
