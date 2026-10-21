-- Añade Usuario y habilita su acceso al asignarle un indicador como apoyo.
-- Conserva las políticas RLS existentes y los roles ya asignados.
begin;
alter table public.role_assignments drop constraint if exists role_assignments_role_check;
alter table public.role_assignments add constraint role_assignments_role_check
  check(role in ('gcg','gerente_responsable','usuario','super_admin'));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check(role in ('gcg','gerente_responsable','usuario','super_admin'));
alter table public.organization_people drop constraint if exists organization_people_role_check;
alter table public.organization_people add constraint organization_people_role_check
  check(role in ('gcg','gerente_responsable','usuario','super_admin'));

create or replace function public.can_manage_reporting(indicator bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select is_super_admin() or (
    exists(select 1 from role_assignments where email=lower(auth.jwt()->>'email')
      and role in ('gcg','gerente_responsable'))
    and exists (
      select 1 from indicators i join objectives o on o.id=i.objective_id
      where i.id=indicator and (person_matches(i.owner_email) or person_matches(o.owner_email))
    )
  );
$$;
create or replace function public.can_report(indicator bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null
    and exists(select 1 from role_assignments where email=lower(auth.jwt()->>'email')
      and role in ('gcg','gerente_responsable','usuario','super_admin'))
    and (can_manage_reporting(indicator) or exists (
      select 1 from indicators i where i.id=indicator and person_matches(i.reporter_email)
    ));
$$;

create or replace function public.assign_indicator_reporter(indicator bigint, reporter text)
returns void language plpgsql security definer set search_path=public as $$
declare support_email text; effective_role text;
begin
  if auth.uid() is null or not (can_manage_reporting(indicator) or is_gcg()) then
    raise exception 'Solo GCG o el gerente asignado puede delegar el reporte';
  end if;
  perform 1 from indicators where id=indicator for update;
  if not found then raise exception 'No se encontró el indicador'; end if;

  if reporter is not null then
    select lower(trim(p.email)) into support_email from organization_people p
    where p.active and p.email is not null
      and (p.id::text=reporter or lower(p.email)=lower(trim(reporter))) limit 1;
    if support_email is null then
      select lower(p.email) into support_email from microsoft_directory p
      where p.email=lower(trim(reporter));
    end if;
    if support_email is null then
      select lower(p.email) into support_email from profiles p
      where lower(p.email)=lower(trim(reporter));
    end if;
    if support_email is null then raise exception 'Selecciona una persona con correo del directorio'; end if;
    insert into role_assignments(email,role) values(support_email,'usuario')
      on conflict(email) do nothing;
    select role into effective_role from role_assignments where email=support_email;
    update profiles set role=effective_role,updated_at=now() where lower(email)=support_email;
    update organization_people set role=effective_role,updated_at=now() where lower(email)=support_email;
  end if;
  update indicators set reporter_email=support_email,updated_at=now() where id=indicator;
end $$;
revoke all on function public.assign_indicator_reporter(bigint,text) from public,anon;
grant execute on function public.assign_indicator_reporter(bigint,text) to authenticated;

-- Habilita apoyos existentes sin reemplazar ningún rol vigente.
insert into role_assignments(email,role)
select distinct lower(coalesce(p.email,d.email,u.email)), 'usuario'
from indicators i
left join organization_people p on p.active and (p.id::text=i.reporter_email or lower(p.email)=lower(i.reporter_email))
left join microsoft_directory d on d.email=lower(i.reporter_email)
left join profiles u on lower(u.email)=lower(i.reporter_email)
where i.reporter_email is not null and coalesce(p.email,d.email,u.email) is not null
on conflict(email) do nothing;
update profiles p set role=a.role,updated_at=now()
from role_assignments a where lower(p.email)=a.email and p.role is distinct from a.role;
notify pgrst,'reload schema';
commit;
