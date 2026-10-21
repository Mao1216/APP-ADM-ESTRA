-- Retira los datos ficticios del catálogo temporal de PMO.
-- Conserva la estructura para recibir los proyectos oficiales y no elimina acciones.
begin;

update public.strategic_actions
set project_id = null
where project_id in (
  select p.id
  from public.projects p
  join public.pmo_project_catalog c on c.id = p.catalog_id
  where c.is_demo = true
);

delete from public.projects
where catalog_id in (
  select id from public.pmo_project_catalog where is_demo = true
);

delete from public.pmo_project_catalog
where is_demo = true;

commit;
