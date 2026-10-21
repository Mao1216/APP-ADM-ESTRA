-- Verificación estructural de solo lectura, después de ejecutar 006.
do $$
declare t text;
begin
 foreach t in array array['role_assignments','profiles','organization_people'] loop
   if exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'role') then
     execute format('select exists(select 1 from public.%I where role = ''gerente_general'')',t) into strict t;
     if t = 'true' then raise exception 'Persisten asignaciones de gerente general'; end if;
   end if;
 end loop;
 if to_regclass('public.indicator_change_requests') is null then raise exception 'Falta la tabla de solicitudes'; end if;
 if exists(select 1 from pg_policies where schemaname = 'public' and tablename in ('objectives','indicators','indicator_reports','indicator_change_requests') and cmd = 'ALL') then raise exception 'Persiste una política de escritura general'; end if;
 if exists(select 1 from pg_policies where schemaname = 'public' and tablename in ('indicator_reports','indicator_change_requests') and cmd in ('UPDATE','DELETE')) then raise exception 'Hay una política que permite modificar registros directamente'; end if;
 if (select count(*) from pg_trigger where not tgisinternal and tgname in ('guard_indicator_target','prepare_indicator_change','prepare_measurement','refresh_measurement_status')) <> 4 then raise exception 'Faltan triggers de gobierno'; end if;
 if public.indicator_period_date('Setiembre,2026') <> date '2026-09-01' then raise exception 'El orden de periodos no es correcto'; end if;
 if public.measurement_status(4,5,'>=') <> 'Fuera de meta' or public.measurement_status(4,5,'<=') <> 'En meta' then raise exception 'La evaluación de metas no es correcta'; end if;
 raise notice 'Verificación estructural de gobierno de indicadores: OK';
end; $$;

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename in ('objectives','indicators','indicator_reports','indicator_change_requests')
order by tablename,cmd;
