-- Identidad operativa de John Cardenas para asignaciones de la sede Kuntur.
-- No sustituye su cuenta biomont ni el rol GCG existente.
begin;

insert into public.organization_people (full_name, email, role, active)
values ('John Cardenas · Kuntur', 'jcardenas@kunturpharma.pe', 'gerente_responsable', true)
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

insert into public.role_assignments (email, role)
values ('jcardenas@kunturpharma.pe', 'gerente_responsable')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();

notify pgrst, 'reload schema';
commit;
