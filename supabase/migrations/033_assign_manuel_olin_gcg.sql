-- Asigna acceso GCG a Manuel Freddy Olin Ponte.
begin;

insert into public.role_assignments(email, role)
values ('molin@biomont.com.pe', 'gcg')
on conflict (email) do update set role = excluded.role;

update public.profiles
set role = 'gcg', updated_at = now()
where lower(email) = 'molin@biomont.com.pe';

update public.organization_people
set role = 'gcg', updated_at = now()
where lower(email) = 'molin@biomont.com.pe';

notify pgrst, 'reload schema';
commit;
