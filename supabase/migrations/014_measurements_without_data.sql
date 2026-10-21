begin;
alter table public.indicator_reports alter column result drop not null;
alter table public.indicator_reports drop constraint if exists indicator_reports_status_check;
alter table public.indicator_reports add constraint indicator_reports_status_check check(status in ('En meta','Fuera de meta','Sin datos'));
alter table public.indicator_reports add constraint indicator_reports_result_status_check check((result is null) = (status='Sin datos'));

create or replace function public.prepare_measurement() returns trigger language plpgsql security definer set search_path=public as $$
declare i indicators;
begin
 select * into strict i from indicators where id=new.indicator_id for update;
 if tg_op='INSERT' and exists(select 1 from indicator_reports where indicator_id=new.indicator_id and indicator_period_date(period)=indicator_period_date(new.period)) then raise exception 'Este periodo ya fue registrado. Solicita una corrección a GCG.'; end if;
 perform indicator_period_date(new.period);
 if tg_op='INSERT' then new.measurement_target:=i.target; new.measurement_comparator:=i.comparator;
 else new.measurement_target:=coalesce(old.measurement_target,new.measurement_target); new.measurement_comparator:=coalesce(old.measurement_comparator,new.measurement_comparator); end if;
 if new.result is null then new.status:='Sin datos';
 else new.status:=measurement_status(new.result,coalesce(new.measurement_target,i.target),coalesce(new.measurement_comparator,i.comparator)); end if;
 return new;
end $$;

-- Un resultado nulo representa explícitamente un registro Sin datos.
create or replace function public.register_indicator_measurement(indicator bigint,report_period text,report_result numeric,report_observations text default null) returns bigint language plpgsql security definer set search_path=public as $$
declare i indicators; result_id bigint;
begin
 if auth.uid() is null then raise exception 'Tu sesión venció. Vuelve a iniciar sesión'; end if;
 select * into strict i from indicators where id=indicator for update;
 if not can_report(i.id) then raise exception 'Tu cuenta no está asignada para reportar este indicador'; end if;
 if i.approval_status<>'Aprobado' then raise exception 'El indicador debe estar aprobado antes de registrar resultados'; end if;
 perform indicator_period_date(report_period);
 insert into indicator_reports(indicator_id,period,result,status,registered_date,observations,created_by) values(i.id,trim(report_period),report_result,'Sin datos',current_date,case when report_result is null then null else nullif(trim(report_observations),'') end,auth.uid()) returning id into result_id;
 return result_id;
end $$;
notify pgrst,'reload schema';
commit;
