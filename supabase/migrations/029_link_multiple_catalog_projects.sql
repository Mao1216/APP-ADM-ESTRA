-- Vinculación múltiple atómica: todos los vínculos se guardan juntos.
begin;
create or replace function public.link_catalog_projects(objective bigint, catalog_projects uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare project_id uuid;
begin
  if catalog_projects is null or cardinality(catalog_projects) = 0 then
    raise exception 'Selecciona al menos un proyecto';
  end if;
  foreach project_id in array catalog_projects loop
    perform public.link_catalog_project(objective, project_id);
  end loop;
end $$;
revoke all on function public.link_catalog_projects(bigint,uuid[]) from public,anon;
grant execute on function public.link_catalog_projects(bigint,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
