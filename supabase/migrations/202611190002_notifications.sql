begin;
alter table polymath_private.progress_adjustments add column seen_at timestamptz;

create table polymath_private.feedback_threads (
  id uuid primary key,
  owner_id uuid not null references auth.users on delete cascade,
  subject text not null check (length(subject) between 1 and 120),
  updated_at timestamptz not null default now(),
  version integer not null default 0
);
create index feedback_owner_activity on polymath_private.feedback_threads(owner_id,updated_at desc);
create index feedback_activity on polymath_private.feedback_threads(updated_at desc);
create table polymath_private.feedback_messages (
  thread_id uuid not null references polymath_private.feedback_threads on delete cascade,
  seq integer not null, nonce uuid not null,
  author_id uuid references auth.users on delete set null,
  from_team boolean not null,
  body text not null check (length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  primary key(thread_id,seq), unique(thread_id,nonce)
);
create table polymath_private.feedback_reads (
  thread_id uuid not null references polymath_private.feedback_threads on delete cascade,
  viewer uuid not null references auth.users on delete cascade,
  version integer not null, primary key(thread_id,viewer)
);
alter table polymath_private.feedback_threads enable row level security;
alter table polymath_private.feedback_messages enable row level security;
alter table polymath_private.feedback_reads enable row level security;
revoke all on polymath_private.feedback_threads, polymath_private.feedback_messages, polymath_private.feedback_reads from public,anon,authenticated;

create function public.polymath_inbox(p_action text,p_box text default 'account',p_id uuid default null,
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

  if p_action='counts' then
    select count(*) filter(where t.owner_id=me), count(*) filter(where team and t.owner_id<>me)
      into personal,project from polymath_private.feedback_threads t
      left join polymath_private.feedback_reads r on r.thread_id=t.id and r.viewer=me
      where (team or t.owner_id=me) and t.version>coalesce(r.version,0);
    select personal+count(*) into personal from polymath_private.progress_adjustments where recipient=me and seen_at is null;
    return jsonb_build_object('account',personal,'project',project);
  elsif p_action='list' then
    select coalesce(jsonb_agg(to_jsonb(f) order by f.at desc,f.id),'[]') into feed from (
      select * from (
        select a.request_id id,a.action kind,a.created_at at,a.reason body,
          a.before_value,a.after_value,null::text subject,null::text sender,a.seen_at is null unread
        from polymath_private.progress_adjustments a where p_box='account' and a.recipient=me
        union all
        select t.id,'feedback',t.updated_at,left(m.body,160),null,null,t.subject,
          case when p_box='project' then coalesce(nullif(u.raw_user_meta_data->>'display_name',''),u.email) end,
          t.version>coalesce(r.version,0)
        from polymath_private.feedback_threads t join auth.users u on u.id=t.owner_id
        join polymath_private.feedback_messages m on m.thread_id=t.id and m.seq=t.version
        left join polymath_private.feedback_reads r on r.thread_id=t.id and r.viewer=me
        where p_box='project' or t.owner_id=me
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
  select * into topic from polymath_private.feedback_threads where id=p_id and (p_box='project' or owner_id=me) for update;
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
      (select seq,body,created_at,from_team,author_id=me mine from polymath_private.feedback_messages
       where thread_id=p_id and (p_page=0 or seq<p_page) order by seq desc limit 30) m;
    return jsonb_build_object('subject',topic.subject,'messages',messages);
  end if;
  return jsonb_build_object('id',p_id);
end $$;
revoke all on function public.polymath_inbox(text,text,uuid,text,text,uuid,integer) from public,anon;
grant execute on function public.polymath_inbox(text,text,uuid,text,text,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
