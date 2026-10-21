-- Prepara el catálogo para la sincronización de la API oficial de PfMS.
-- Los registros de demostración se conservan si ya están vinculados a un objetivo.
begin;

alter table public.pmo_project_catalog
  add column if not exists source_status_code text,
  add column if not exists source text not null default 'local';

update public.pmo_project_catalog
set source = case when is_demo then 'demo' else source end
where source = 'local';

create index if not exists pmo_project_catalog_source_idx
  on public.pmo_project_catalog(source, is_demo);

notify pgrst, 'reload schema';
commit;
