-- Códigos permanentes por tipo y año de creación (Lima). Reejecutable.
begin;
lock table public.objectives, public.indicators in share row exclusive mode;
create table if not exists public.entity_code_counters (
  entity_type text not null check (entity_type in ('OBJ', 'IND')),
  code_year integer not null,
  last_number integer not null check (last_number > 0),
  primary key (entity_type, code_year)
);
alter table public.entity_code_counters enable row level security;
revoke all on public.entity_code_counters from public, anon, authenticated;
alter table public.objectives add column if not exists code text;
alter table public.indicators add column if not exists code text;
create or replace function public.allocate_entity_code(prefix text, full_year integer)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare sequence_number integer;
begin
  insert into public.entity_code_counters(entity_type, code_year, last_number)
  values (prefix, full_year, 1)
  on conflict (entity_type, code_year) do update
    set last_number = public.entity_code_counters.last_number + 1
  returning last_number into sequence_number;
  return prefix || '-' || right(full_year::text, 2) ||
    lpad(sequence_number::text, greatest(3, length(sequence_number::text)), '0');
end;
$$;
revoke all on function public.allocate_entity_code(text, integer) from public, anon, authenticated;
insert into public.entity_code_counters(entity_type, code_year, last_number)
select prefix, full_year, max(number) from (
  select 'OBJ' as prefix, extract(year from created_at at time zone 'America/Lima')::integer as full_year,
    substring(code from 7)::integer as number from public.objectives where code ~ '^OBJ-[0-9]{5,}$'
  union all
  select 'IND', extract(year from created_at at time zone 'America/Lima')::integer,
    substring(code from 7)::integer from public.indicators where code ~ '^IND-[0-9]{5,}$'
) existing group by prefix, full_year
on conflict (entity_type, code_year) do update
  set last_number = greatest(public.entity_code_counters.last_number, excluded.last_number);
do $$
declare item record;
begin
  for item in select id, extract(year from created_at at time zone 'America/Lima')::integer as code_year
    from public.objectives where code is null order by created_at, id
  loop
    update public.objectives set code = public.allocate_entity_code('OBJ', item.code_year) where id = item.id;
  end loop;
  for item in select id, extract(year from created_at at time zone 'America/Lima')::integer as code_year
    from public.indicators where code is null order by created_at, id
  loop
    update public.indicators set code = public.allocate_entity_code('IND', item.code_year) where id = item.id;
  end loop;
end;
$$;
create unique index if not exists objectives_code_unique on public.objectives(code);
create unique index if not exists indicators_code_unique on public.indicators(code);
alter table public.objectives alter column code set not null;
alter table public.indicators alter column code set not null;
create or replace function public.assign_entity_code()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' then
    if new.code is distinct from old.code then raise exception 'El código es permanente y no puede modificarse'; end if;
  else
    new.code = public.allocate_entity_code(tg_argv[0], extract(year from current_timestamp at time zone 'America/Lima')::integer);
  end if;
  return new;
end;
$$;
revoke all on function public.assign_entity_code() from public, anon, authenticated;
drop trigger if exists assign_objective_code on public.objectives;
create trigger assign_objective_code before insert or update on public.objectives
for each row execute function public.assign_entity_code('OBJ');
drop trigger if exists assign_indicator_code on public.indicators;
create trigger assign_indicator_code before insert or update on public.indicators
for each row execute function public.assign_entity_code('IND');
commit;
