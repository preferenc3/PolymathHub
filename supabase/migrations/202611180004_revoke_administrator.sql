begin;

create function public.polymath_revoke_administrator(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false) is not true then
    return 'forbidden';
  end if;
  -- Serialize membership changes, then recheck the caller after any wait.
  lock table polymath_private.administrators in share row exclusive mode;
  if coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false) is not true then
    return 'forbidden';
  end if;
  if not exists (select 1 from polymath_private.administrators where user_id=p_user_id) then
    return 'absent';
  end if;
  if not exists (select 1 from polymath_private.administrators where user_id<>p_user_id) then
    return 'last_admin';
  end if;
  delete from polymath_private.administrators where user_id=p_user_id;
  return 'revoked';
end $$;

create or replace function public.polymath_grant_administrator(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false) is not true then
    return false;
  end if;
  lock table polymath_private.administrators in share row exclusive mode;
  if coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false) is not true then
    return false;
  end if;
  insert into polymath_private.administrators(user_id)
    select id from auth.users where id=p_user_id on conflict do nothing;
  return exists (select 1 from polymath_private.administrators where user_id=p_user_id);
end $$;

revoke all on function public.polymath_revoke_administrator(uuid) from public, anon, authenticated;
grant execute on function public.polymath_revoke_administrator(uuid) to authenticated;

commit;
