-- Catálogo temporal de demostración hasta recibir la API oficial de PMO.
begin;
create table public.pmo_project_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  responsible_name text not null,
  status text not null,
  progress integer not null check (progress between 0 and 100),
  end_date date,
  project_url text,
  is_demo boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.pmo_project_catalog enable row level security;
grant select on public.pmo_project_catalog to authenticated;
create policy "Authorized users read project catalog" on public.pmo_project_catalog
  for select to authenticated using (exists (
    select 1 from public.role_assignments where lower(email) = lower(auth.jwt()->>'email')
  ));
alter table public.projects add column catalog_id uuid references public.pmo_project_catalog(id);
create unique index projects_objective_catalog_unique on public.projects(objective_id, catalog_id);

insert into public.pmo_project_catalog(code,name,description,responsible_name,status,progress,end_date) values
('DEMO-001','Obtención de la normativa OEA','Implementación de requisitos y preparación para la certificación OEA.','Equipo de Comercio Exterior','En ejecución',68,'2026-11-30'),
('DEMO-002','Certificación ISO 9001','Estandarización de procesos y preparación para la auditoría.','Equipo de Calidad','En ejecución',42,'2026-12-15'),
('DEMO-003','Mejora de trazabilidad documental','Implementación de trazabilidad en los procesos clave.','Sistema Integrado de Gestión','En ejecución',85,'2026-11-15'),
('DEMO-004','Modernización de la línea de producción','Renovación de equipos y optimización de capacidad instalada.','Equipo de Operaciones','En ejecución',35,'2027-03-31'),
('DEMO-005','Digitalización de almacenes','Control digital de ubicaciones, inventarios y movimientos.','Equipo de Logística','Planificado',0,'2027-02-28'),
('DEMO-006','Programa de eficiencia energética','Reducción del consumo energético en instalaciones productivas.','Equipo de Mantenimiento','En ejecución',57,'2026-12-31'),
('DEMO-007','Desarrollo de nuevos mercados','Evaluación comercial y apertura de canales internacionales.','Equipo Comercial','En pausa',24,'2027-04-30'),
('DEMO-008','Tablero de gestión financiera','Consolidación de información para decisiones financieras.','Equipo de Finanzas','Concluido',100,'2026-10-01'),
('DEMO-009','Escuela de liderazgo','Formación de competencias de gestión para líderes de área.','Equipo de Gestión Humana','En ejecución',73,'2026-12-20'),
('DEMO-010','Automatización del control de calidad','Digitalización de registros y seguimiento de ensayos.','Equipo de Control de Calidad','Planificado',0,'2027-05-31');

create function public.link_catalog_project(objective bigint, catalog_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare item pmo_project_catalog;
begin
  perform 1 from objectives o where o.id = objective and
    (is_gcg() or person_matches(o.owner_email)) for update;
  if not found or auth.uid() is null then raise exception 'No puedes vincular proyectos a este objetivo'; end if;
  select * into strict item from pmo_project_catalog where id = catalog_project;
  insert into projects(objective_id,catalog_id,name,status,progress,source)
  values(objective,item.id,item.name,item.status,item.progress,'Catálogo temporal PMO')
  on conflict (objective_id,catalog_id) do nothing;
end $$;

create function public.unlink_catalog_project(project bigint)
returns void language plpgsql security definer set search_path = public as $$
declare item projects;
begin
  select * into strict item from projects where id = project for update;
  if auth.uid() is null or not exists (
    select 1 from objectives o where o.id = item.objective_id
      and (is_gcg() or person_matches(o.owner_email))
  ) then raise exception 'No puedes desvincular este proyecto'; end if;
  update strategic_actions set project_id = null where project_id = item.id;
  delete from projects where id = item.id;
end $$;
revoke all on function public.link_catalog_project(bigint,uuid), public.unlink_catalog_project(bigint) from public,anon;
grant execute on function public.link_catalog_project(bigint,uuid), public.unlink_catalog_project(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
