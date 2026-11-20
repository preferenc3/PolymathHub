begin;
alter table polymath_private.feedback_threads add column direct_message boolean not null default false,
  add column staff_id uuid references auth.users(id) on delete set null;

create or replace function public.polymath_inbox(p_action text,p_box text default 'account',p_id uuid default null,
  p_subject text default null,p_body text default null,p_nonce uuid default null,p_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  me uuid := auth.uid();
  team boolean; topic polymath_private.feedback_threads%rowtype;
  old_message polymath_private.feedback_messages%rowtype;
  messages jsonb; personal bigint; project bigint; feed jsonb;
begin
  if me is null or not exists(select 1 from auth.sessions where user_id=me and id::text=auth.jwt()->>'session_id')
    then return '{"error":"forbidden"}'; end if;
  team:=exists(select 1 from polymath_private.administrators where user_id=me);
  if p_box is null or p_box not in ('account','project') or (p_box='project' and not team)
    then return '{"error":"forbidden"}'; end if;
  if p_page is null or p_page not between 0 and 1000000 then return '{"error":"invalid"}'; end if;

  -- Opening a mailbox acknowledges its existing notices for this viewer only.
  if p_action='visit' then
    if p_box='account' then
      update polymath_private.progress_adjustments set seen_at=now()
        where recipient=me and seen_at is null;
    end if;
    insert into polymath_private.feedback_reads(thread_id,viewer,version)
      select t.id,me,t.version from polymath_private.feedback_threads t
      left join polymath_private.feedback_reads r on r.thread_id=t.id and r.viewer=me
      where ((p_box='project' and (not t.direct_message or t.staff_id=me)) or (p_box='account' and t.owner_id=me)) and t.version>coalesce(r.version,0)
      order by t.id
      on conflict(thread_id,viewer) do update set version=greatest(excluded.version,polymath_private.feedback_reads.version);
  end if;

  if p_action='counts' then
    select count(*) filter(where t.owner_id=me), count(*) filter(where team and t.owner_id<>me)
      into personal,project from polymath_private.feedback_threads t
      left join polymath_private.feedback_reads r on r.thread_id=t.id and r.viewer=me
      where ((team and (not t.direct_message or t.staff_id=me)) or t.owner_id=me) and t.version>coalesce(r.version,0);
    select personal+count(*) into personal from polymath_private.progress_adjustments where recipient=me and seen_at is null;
    return jsonb_build_object('account',personal,'project',project);
  elsif p_action in ('list','visit') then
    select coalesce(jsonb_agg(to_jsonb(f) order by f.at desc,f.id),'[]') into feed from (
      select * from (
        select a.request_id id,a.action kind,a.created_at at,a.reason body,
          a.before_value,a.after_value,null::text subject,coalesce(nullif(actor.raw_user_meta_data->>'display_name',''),split_part(actor.email,'@',1),'Administrator') sender,a.seen_at is null unread
        from polymath_private.progress_adjustments a left join auth.users actor on actor.id=a.actor where p_box='account' and a.recipient=me
        union all
        select t.id,case when t.direct_message then 'direct' else 'feedback' end,t.updated_at,left(m.body,160),null,null,t.subject,
          coalesce(nullif(writer.raw_user_meta_data->>'display_name',''),split_part(writer.email,'@',1),'Cont șters'),
          t.version>coalesce(r.version,0)
        from polymath_private.feedback_threads t join auth.users u on u.id=t.owner_id
        join polymath_private.feedback_messages m on m.thread_id=t.id and m.seq=t.version
        left join auth.users writer on writer.id=m.author_id
        left join polymath_private.feedback_reads r on r.thread_id=t.id and r.viewer=me
        where (p_box='project' and (not t.direct_message or t.staff_id=me)) or (p_box='account' and t.owner_id=me)
      ) items order by at desc,id limit 21 offset (p_page*20)
    ) f;
    return jsonb_build_object('items',feed,'admin',team);
  elsif p_action='seen' and p_box='account' then
    update polymath_private.progress_adjustments set seen_at=now() where recipient=me and request_id=p_id and seen_at is null;
    return '{"ok":true}';
  end if;

  if p_id is null or p_action is null or p_action not in ('new','thread','reply') then return '{"error":"invalid"}'; end if;
  if p_action in ('new','reply') and (p_nonce is null or length(btrim(coalesce(p_body,''))) not between 1 and 3000)
    then return '{"error":"invalid"}'; end if;
  if p_action='new' then
    if p_box<>'account' or length(btrim(coalesce(p_subject,''))) not between 1 and 120 then return '{"error":"invalid"}'; end if;
    insert into polymath_private.feedback_threads(id,owner_id,subject) values(p_id,me,btrim(p_subject)) on conflict do nothing;
  end if;
  select * into topic from polymath_private.feedback_threads where id=p_id and ((p_box='project' and (not direct_message or staff_id=me)) or (p_box='account' and owner_id=me)) for update;
  if not found then return '{"error":"missing"}'; end if;
  if p_action in ('new','reply') then
    select * into old_message from polymath_private.feedback_messages where thread_id=p_id and nonce=p_nonce;
    if found then
      if old_message.author_id=me and old_message.body=btrim(p_body) then return jsonb_build_object('id',p_id); end if;
      return '{"error":"conflict"}';
    end if;
    if p_action='new' and topic.version<>0 then return '{"error":"conflict"}'; end if;
    update polymath_private.feedback_threads set version=version+1,updated_at=clock_timestamp() where id=p_id returning * into topic;
    insert into polymath_private.feedback_messages(thread_id,seq,nonce,author_id,from_team,body)
      values(p_id,topic.version,p_nonce,me,p_box='project',btrim(p_body));
  end if;
  if p_action<>'thread' or p_page=0 then
    insert into polymath_private.feedback_reads(thread_id,viewer,version) values(p_id,me,topic.version)
      on conflict(thread_id,viewer) do update set version=greatest(excluded.version,polymath_private.feedback_reads.version);
  end if;
  if p_action='thread' then
    select coalesce(jsonb_agg(to_jsonb(m) order by m.seq),'[]') into messages from
      (select msg.seq,msg.body,msg.created_at,msg.from_team,msg.author_id=me mine,
         coalesce(nullif(writer.raw_user_meta_data->>'display_name',''),split_part(writer.email,'@',1),'Cont șters') sender
       from polymath_private.feedback_messages msg left join auth.users writer on writer.id=msg.author_id
       where thread_id=p_id and (p_page=0 or seq<p_page) order by seq desc limit 30) m;
    return jsonb_build_object('subject',topic.subject,'messages',messages);
  end if;
  return jsonb_build_object('id',p_id);
end $$;
revoke all on function public.polymath_inbox(text,text,uuid,text,text,uuid,integer) from public,anon;
grant execute on function public.polymath_inbox(text,text,uuid,text,text,uuid,integer) to authenticated;
create function public.polymath_start_message(p_id uuid,p_recipient uuid,p_subject text,p_body text,p_nonce uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); topic polymath_private.feedback_threads%rowtype;
begin
  if not exists(select 1 from auth.sessions where user_id=me and id::text=auth.jwt()->>'session_id')
    or not exists(select 1 from polymath_private.administrators where user_id=me)
    then return '{"error":"forbidden"}'; end if;
  if p_id is null or p_nonce is null or p_recipient is null or p_recipient=me
     or length(btrim(coalesce(p_subject,''))) not between 1 and 120
     or length(btrim(coalesce(p_body,''))) not between 1 and 3000 then return '{"error":"invalid"}'; end if;
  if not exists(select 1 from auth.users where id=p_recipient) then return '{"error":"missing"}'; end if;
  insert into polymath_private.feedback_threads(id,owner_id,subject,direct_message,staff_id)
    values(p_id,p_recipient,btrim(p_subject),true,me) on conflict do nothing;
  select * into strict topic from polymath_private.feedback_threads where id=p_id for update;
  if topic.owner_id<>p_recipient or topic.staff_id is distinct from me or not topic.direct_message or topic.subject<>btrim(p_subject)
     or (topic.version>0 and not exists(select 1 from polymath_private.feedback_messages
       where thread_id=p_id and seq=1 and author_id=me and nonce=p_nonce and body=btrim(p_body)))
    then return '{"error":"conflict"}'; end if;
  return public.polymath_inbox('reply','project',p_id,null,p_body,p_nonce,0);
end $$;
revoke all on function public.polymath_start_message(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.polymath_start_message(uuid,uuid,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
