begin;

-- Keep the existing revocation and last-admin checks behind the same public RPC.
alter function public.polymath_revoke_administrator(uuid) set schema polymath_private;
revoke all on function polymath_private.polymath_revoke_administrator(uuid) from public, anon, authenticated;
create function public.polymath_revoke_administrator(p_user_id uuid)
returns text language sql security definer set search_path = '' as $$
  select case when p_user_id = auth.uid() then 'self'
    else polymath_private.polymath_revoke_administrator(p_user_id) end
$$;
revoke all on function public.polymath_revoke_administrator(uuid) from public, anon;
grant execute on function public.polymath_revoke_administrator(uuid) to authenticated;

create table polymath_private.progress_adjustments (
  request_id uuid primary key,
  recipient uuid not null references auth.users(id) on delete cascade,
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  before_value integer not null,
  after_value integer not null,
  reason text not null,
  restored_until date,
  created_at timestamptz not null default now(),
  unique (recipient, restored_until)
);
create index progress_adjustments_history on polymath_private.progress_adjustments(recipient, created_at desc);
alter table polymath_private.progress_adjustments enable row level security;
revoke all on polymath_private.progress_adjustments from public, anon, authenticated;

-- Older clients could save an invalid date string in their progress.
create function polymath_private.progress_day(raw text) returns date
language plpgsql immutable strict set search_path = '' as $$
begin
  if raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return raw::date; end if;
  return null;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;

create function public.polymath_admin_progress(p_user_id uuid, p_action text, p_value integer default null,
  p_reason text default '', p_revision bigint default null, p_request uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c jsonb; rev bigint; before_val integer; after_val integer;
  today date := (now() at time zone 'Europe/Chisinau')::date;
  new_row boolean; last_day date; lost_end date; recovered integer; current_days integer; history jsonb; prior record;
begin
  if not coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false)
    then return '{"error":"forbidden"}'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then return '{"error":"missing"}'; end if;
  if p_action not in ('inspect','bonus','restore','goal') or p_action is null then return '{"error":"invalid"}'; end if;
  if p_action <> 'inspect' then
    if p_request is null or p_revision is null or length(btrim(coalesce(p_reason,''))) not between 1 and 240
      then return '{"error":"invalid"}'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
    select * into prior from polymath_private.progress_adjustments where request_id=p_request;
    if found then
      if prior.recipient=p_user_id and prior.actor=auth.uid() and prior.action=p_action and prior.reason=btrim(p_reason)
        and (p_action='restore' or p_value=case when p_action='bonus' then prior.after_value-prior.before_value else prior.after_value end)
        then return '{"ok":true}'; end if;
      return '{"error":"conflict"}';
    end if;
    select course, revision into c,rev from public.learning_progress where user_id=p_user_id for update;
    new_row:=not found;
    if coalesce(rev,0)<>p_revision then return '{"error":"conflict"}'; end if;
  else
    select course, revision into c,rev from public.learning_progress where user_id=p_user_id;
  end if;
  c:=coalesce(c,'{}');
  last_day:=polymath_private.progress_day(c->>'lastCompletionDate');
  current_days:=case when last_day>=today-1 then coalesce((c->>'streak')::integer,0) else 0 end;

  if p_action in ('inspect','restore') then
    -- Group contiguous days, taking the most recent interrupted run.
    with days as (
      select distinct polymath_private.progress_day(day) d
      from jsonb_object_keys(coalesce(c->'dailyHistory','{}') || coalesce(c->'assistedHistory','{}')) as k(day)
      where polymath_private.progress_day(day)<=today
    ), runs as (select d,d-row_number() over(order by d)::integer grp from days)
    select max(d),count(*)::integer into lost_end,recovered from runs group by grp having max(d)<today-1
      order by max(d) desc limit 1;
    if last_day<today-1 and coalesce((c->>'streak')::integer,0)>0 and (lost_end is null or last_day>=lost_end) then
      lost_end:=last_day;
      recovered:=greatest(coalesce(recovered,0),(c->>'streak')::integer);
    end if;
    if exists(select 1 from polymath_private.progress_adjustments where recipient=p_user_id and restored_until>=lost_end) then recovered:=0; end if;
  end if;

  if p_action='inspect' then
    select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc),'[]') into history from
      (select a.action,a.before_value,a.after_value,a.reason,a.created_at,coalesce(u.email,'Cont șters') as actor
       from polymath_private.progress_adjustments a left join auth.users u on u.id=a.actor
       where a.recipient=p_user_id order by a.created_at desc limit 20) h;
    return jsonb_build_object('revision',coalesce(rev,0),'xp',coalesce((c->>'xp')::integer,0),'streak',current_days,
      'restorable',coalesce(recovered,0),'goal',coalesce((c#>>'{preferences,dailyTarget}')::integer,3),
      'lessons',jsonb_array_length(coalesce(c->'completedLessons','[]')),'history',history);
  elsif p_action='bonus' then
    before_val:=coalesce((c->>'xp')::integer,0);
    if p_value is null or p_value not between 1 and 10000 or p_value>10000000-before_val then return '{"error":"invalid"}'; end if;
    after_val:=before_val+p_value;
    c:=c || jsonb_build_object('xp',after_val);
  elsif p_action='restore' then
    if coalesce(recovered,0)=0 then return '{"error":"no_streak"}'; end if;
    before_val:=current_days; after_val:=current_days+recovered;
    c:=c || jsonb_build_object('streak',after_val,'longestStreak',greatest(after_val,coalesce((c->>'longestStreak')::integer,0)),
      'lastCompletionDate',greatest(last_day,today-1));
  else
    if p_value is null or p_value not between 1 and 100 then return '{"error":"invalid"}'; end if;
    before_val:=coalesce((c#>>'{preferences,dailyTarget}')::integer,3); after_val:=p_value;
    c:=c || jsonb_build_object('preferences',coalesce(c->'preferences','{}') || jsonb_build_object('dailyTarget',after_val));
  end if;
  if new_row then
    insert into public.learning_progress(user_id,course,revision) values(p_user_id,c,1) on conflict do nothing;
    if not found then return '{"error":"conflict"}'; end if;
  else
    update public.learning_progress set course=c,revision=rev+1,updated_at=now() where user_id=p_user_id;
  end if;
  insert into polymath_private.progress_adjustments(request_id,recipient,actor,action,before_value,after_value,reason,restored_until)
    values(p_request,p_user_id,auth.uid(),p_action,before_val,after_val,btrim(p_reason),case when p_action='restore' then lost_end end);
  return '{"ok":true}';
end $$;
revoke all on function public.polymath_admin_progress(uuid,text,integer,text,bigint,uuid) from public, anon;
grant execute on function public.polymath_admin_progress(uuid,text,integer,text,bigint,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
