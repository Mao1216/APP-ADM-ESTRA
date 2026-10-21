-- Directorio de personas independiente de la autorización de acceso a BIOMET.
begin;
create table public.microsoft_directory (
  email text primary key,
  microsoft_id text not null,
  full_name text not null,
  synced_at timestamptz not null default now()
);
alter table public.microsoft_directory enable row level security;
grant select on public.microsoft_directory to authenticated;
create policy "Authorized users read Microsoft directory" on public.microsoft_directory
for select to authenticated using (
  exists(select 1 from public.role_assignments where lower(email) = lower(auth.jwt()->>'email'))
);

create function public.sync_microsoft_directory(people jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare imported integer;
begin
  if auth.uid() is null or not is_gcg() then raise exception 'Solo GCG puede sincronizar el directorio'; end if;
  if jsonb_typeof(people) is distinct from 'array' or jsonb_array_length(people) = 0 then
    raise exception 'El directorio no contiene personas';
  end if;
  insert into microsoft_directory(email,microsoft_id,full_name,synced_at)
  select distinct on (lower(trim(person.email)))
    lower(trim(person.email)),person.microsoft_id,trim(person.full_name),now()
  from jsonb_to_recordset(people) as person(email text,microsoft_id text,full_name text)
  where length(trim(person.full_name)) > 0 and length(person.microsoft_id) > 0
    and person.email like '%@%'
  on conflict (email) do update set
    microsoft_id=excluded.microsoft_id,full_name=excluded.full_name,synced_at=excluded.synced_at;
  get diagnostics imported = row_count;
  return imported;
end $$;
revoke all on function public.sync_microsoft_directory(jsonb) from public,anon;
grant execute on function public.sync_microsoft_directory(jsonb) to authenticated;

create or replace function public.assign_indicator_reporter(indicator bigint, reporter text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_reporting(indicator) and not is_gcg() then
    raise exception 'Solo el gerente asignado puede delegar el reporte';
  end if;
  if reporter is not null
     and not exists(select 1 from organization_people where id::text=reporter and email is not null and active)
     and not exists(select 1 from profiles where email=reporter)
     and not exists(select 1 from microsoft_directory where email=reporter) then
    raise exception 'Selecciona una persona del directorio';
  end if;
  update indicators set reporter_email=reporter where id=indicator;
end $$;
notify pgrst,'reload schema';
commit;
