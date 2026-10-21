-- Alinea las cuentas operativas y permite al super administrador operar todos los perfiles.
begin;

update public.role_assignments
set role = case
  when lower(email) = 'sig@biomont.com.pe' then 'super_admin'
  when lower(email) = 'jcardenas@biomont.com.pe' then 'gcg'
  when lower(email) = 'molin@biomont.com.pe' then 'gerente_responsable'
  else role
end
where lower(email) in ('sig@biomont.com.pe', 'jcardenas@biomont.com.pe', 'molin@biomont.com.pe');

update public.profiles
set role = case
  when lower(email) = 'sig@biomont.com.pe' then 'super_admin'
  when lower(email) = 'jcardenas@biomont.com.pe' then 'gcg'
  when lower(email) = 'molin@biomont.com.pe' then 'gerente_responsable'
  else role
end
where lower(email) in ('sig@biomont.com.pe', 'jcardenas@biomont.com.pe', 'molin@biomont.com.pe');

update public.organization_people
set role = case
  when lower(email) = 'sig@biomont.com.pe' then 'super_admin'
  when lower(email) = 'jcardenas@biomont.com.pe' then 'gcg'
  when lower(email) = 'molin@biomont.com.pe' then 'gerente_responsable'
  else role
end
where lower(email) in ('sig@biomont.com.pe', 'jcardenas@biomont.com.pe', 'molin@biomont.com.pe');

insert into public.role_assignments (email, role)
values
  ('sig@biomont.com.pe', 'super_admin'),
  ('jcardenas@biomont.com.pe', 'gcg'),
  ('molin@biomont.com.pe', 'gerente_responsable')
on conflict (email) do update set role = excluded.role;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments
    where lower(email) = lower(auth.jwt() ->> 'email')
      and role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.can_manage_reporting(indicator bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.indicators i
    join public.objectives o on o.id = i.objective_id
    where i.id = indicator
      and (public.person_matches(i.owner_email) or public.person_matches(o.owner_email))
  );
$$;

create or replace function public.can_report(indicator bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.can_manage_reporting(indicator)
    or exists (
      select 1
      from public.indicators
      where id = indicator
        and public.person_matches(reporter_email)
    );
$$;

notify pgrst, 'reload schema';
commit;
