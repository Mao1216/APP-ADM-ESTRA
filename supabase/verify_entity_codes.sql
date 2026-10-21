-- Verifica la migración 007 sin dejar registros de prueba ni avanzar correlativos.
begin;
do $$
declare objective_id bigint; indicator_id bigint; objective_code text; indicator_code text; prefix_year text;
begin
  if exists(select 1 from public.objectives where code is null)
    or exists(select 1 from public.indicators where code is null) then raise exception 'Existen registros sin código'; end if;
  if exists(select code from public.objectives group by code having count(*) > 1)
    or exists(select code from public.indicators group by code having count(*) > 1) then raise exception 'Existen códigos duplicados'; end if;
  prefix_year = right(extract(year from current_timestamp at time zone 'America/Lima')::text, 2);
  insert into public.objectives(name, category, target_date)
    values ('Verificación temporal - rollback', 'Verificación', current_date + 1)
    returning id, code into objective_id, objective_code;
  insert into public.indicators(objective_id, name, target, unit, comparator, frequency, approval_status)
    values (objective_id, 'Verificación temporal - rollback', 90, '%', '>=', 'Mensual', 'Aprobado')
    returning id, code into indicator_id, indicator_code;
  if objective_code not like 'OBJ-' || prefix_year || '%' or indicator_code not like 'IND-' || prefix_year || '%' then
    raise exception 'Falló la generación automática del código';
  end if;
  begin
    update public.objectives set code = 'OBJ-00000' where id = objective_id;
    raise exception 'El código del objetivo se pudo modificar';
  exception when raise_exception then
    if sqlerrm <> 'El código es permanente y no puede modificarse' then raise; end if;
  end;
  begin
    update public.indicators set code = 'IND-00000' where id = indicator_id;
    raise exception 'El código del indicador se pudo modificar';
  exception when raise_exception then
    if sqlerrm <> 'El código es permanente y no puede modificarse' then raise; end if;
  end;
end;
$$;
rollback;
select 'Códigos existentes, generación automática e inmutabilidad: OK' as verification;
