begin;

create table polymath_private.catalog_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('domain','topic','question')),
  parent uuid references polymath_private.catalog_items,
  title text not null check (length(trim(title)) between 1 and 250),
  body text not null default '' check (length(body) <= 12000),
  example text not null default '' check (length(example) <= 6000),
  answer text not null default '' check (length(answer) <= 500),
  published boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  check ((kind = 'domain') = (parent is null)),
  check ((kind = 'question') = (length(trim(answer)) > 0))
);
alter table polymath_private.catalog_items enable row level security;
revoke all on polymath_private.catalog_items from public, anon, authenticated;

insert into polymath_private.catalog_items(id,kind,title,published) values
  ('00000000-0000-4000-8000-000000000001','domain','SQL',true),
  ('00000000-0000-4000-8000-000000000002','domain','Limbi străine',true);

-- The recursive join hides the entire subtree when an ancestor is a draft.
create view polymath_private.visible_catalog as
with recursive visible as (
  select i.* from polymath_private.catalog_items i where parent is null and published
  union all
  select i.* from polymath_private.catalog_items i join visible v on i.parent = v.id where i.published
)
select * from visible;
revoke all on polymath_private.visible_catalog from public, anon, authenticated;

create function public.polymath_catalog(p_admin boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_admin then
    if coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false) is not true then
      raise insufficient_privilege;
    end if;
    return (select coalesce(jsonb_agg(to_jsonb(i) order by created_at,id),'[]') from polymath_private.catalog_items i);
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(i) - 'answer' order by created_at,id),'[]') from polymath_private.visible_catalog i);
end $$;

create function public.polymath_catalog_save(p_item jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  item_id uuid := (p_item->>'id')::uuid;
  parent_id uuid := (p_item->>'parent')::uuid;
  item_kind text := p_item->>'kind';
  item_title text := trim(p_item->>'title');
  item_body text := trim(coalesce(p_item->>'body',''));
  item_example text := trim(coalesce(p_item->>'example',''));
  item_answer text := trim(coalesce(p_item->>'answer',''));
  is_published boolean := (p_item->>'published')::boolean;
begin
  if coalesce((public.polymath_admin_accounts(1,'',true)->>'allowed')::boolean,false) is not true then
    raise insufficient_privilege;
  end if;
  if item_kind in ('topic','question') and not exists (
    select 1 from polymath_private.catalog_items where id = parent_id
    and kind = case item_kind when 'topic' then 'domain' else 'topic' end
  ) then raise exception 'Invalid parent'; end if;
  if item_id is null then
    insert into polymath_private.catalog_items(kind,parent,title,body,example,answer,published)
    values(item_kind,parent_id,item_title,item_body,item_example,item_answer,is_published) returning id into item_id;
  else
    update polymath_private.catalog_items set title=item_title,body=item_body,example=item_example,
      answer=item_answer,published=is_published,revision=revision+1
      where id=item_id and id not in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002') and kind=item_kind and parent is not distinct from parent_id and revision=(p_item->>'revision')::integer;
    if not found then return null; end if;
  end if;
  return item_id;
end $$;

create function public.polymath_catalog_check(p_id uuid,p_answer text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(trim(answer))=lower(trim(p_answer)) from polymath_private.visible_catalog
  where id=p_id and kind='question' and length(p_answer) between 1 and 500
$$;
revoke all on function public.polymath_catalog(boolean), public.polymath_catalog_check(uuid,text), public.polymath_catalog_save(jsonb) from public, anon, authenticated;
grant execute on function public.polymath_catalog(boolean), public.polymath_catalog_check(uuid,text) to anon, authenticated;
grant execute on function public.polymath_catalog_save(jsonb) to authenticated;
commit;
