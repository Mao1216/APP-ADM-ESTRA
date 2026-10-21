-- Correcci�n de nomenclatura para la sede Kuntur.
begin;

update public.sites
set name = 'Kuntur'
where lower(name) = 'kunthur';

insert into public.sites(name)
select 'Kuntur'
where not exists (select 1 from public.sites where lower(name) = 'kuntur');

-- jcardenas@biomont.com.pe mantiene el rol GCG y puede administrar la sede.
insert into public.role_assignments(email, role)
values ('jcardenas@biomont.com.pe', 'gcg')
on conflict (email) do update set role = excluded.role, updated_at = now();

notify pgrst, 'reload schema';
commit;
