-- Detalle documental y código correlativo de análisis de causa.
begin;
create table if not exists public.analysis_code_counters (code_year integer primary key,last_number integer not null check(last_number>0));
alter table public.analysis_code_counters enable row level security;
revoke all on public.analysis_code_counters from public,anon,authenticated;
alter table public.cause_analyses add column if not exists code text;
alter table public.cause_analyses add column if not exists deviation_description text;
alter table public.cause_analyses add column if not exists complementary_data text not null default '';
create or replace function public.allocate_analysis_code(full_year integer) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare sequence_number integer;
begin
 insert into public.analysis_code_counters(code_year,last_number) values(full_year,1) on conflict(code_year) do update set last_number=public.analysis_code_counters.last_number+1 returning last_number into sequence_number;
 return 'ANC-'||right(full_year::text,2)||lpad(sequence_number::text,greatest(3,length(sequence_number::text)),'0');
end; $$;
revoke all on function public.allocate_analysis_code(integer) from public,anon,authenticated;
do $$
declare item record;
begin
 for item in select c.id,extract(year from public.indicator_period_date(r.period))::integer code_year,coalesce(nullif(trim(r.observations),''),'Desviación del indicador en el periodo '||r.period) deviation from public.cause_analyses c join public.indicator_reports r on r.id=c.report_id where c.code is null order by public.indicator_period_date(r.period),c.created_at,c.id loop
  update public.cause_analyses set code=public.allocate_analysis_code(item.code_year),deviation_description=item.deviation where id=item.id;
 end loop;
end $$;
alter table public.cause_analyses alter column code set not null;
alter table public.cause_analyses drop constraint if exists cause_analyses_code_key;
alter table public.cause_analyses add constraint cause_analyses_code_key unique(code);
-- Se mantiene nullable para compatibilidad con clientes que estaban abiertos antes del despliegue;
-- la nueva función exige el dato en toda creación o edición desde esta versión.
create or replace function public.prepare_analysis_code() returns trigger language plpgsql security definer set search_path=public as $$
declare report_year integer;
begin
 if new.code is null then select extract(year from indicator_period_date(period))::integer into strict report_year from indicator_reports where id=new.report_id; new.code=allocate_analysis_code(report_year); end if;
 return new;
end; $$;
drop trigger if exists prepare_analysis_code on public.cause_analyses;
create trigger prepare_analysis_code before insert on public.cause_analyses for each row execute function public.prepare_analysis_code();
revoke all on function public.prepare_analysis_code() from public,anon,authenticated;
create or replace function public.save_cause_analysis_details(measurement bigint,cause_text text,deviation_text text,complementary_text text) returns bigint language plpgsql security definer set search_path=public as $$
declare r indicator_reports;c cause_analyses;result_id bigint;
begin
 select * into strict r from indicator_reports where id=measurement for update;
 if auth.uid() is null or not can_manage_reporting(r.indicator_id) then raise exception 'Solo el gerente responsable puede registrar el análisis'; end if;
 if r.status<>'Fuera de meta' then raise exception 'El análisis requiere una medición fuera de meta'; end if;
 if coalesce(length(trim(cause_text)),0)=0 then raise exception 'Describe el análisis de causa'; end if;
 if coalesce(length(trim(deviation_text)),0)=0 then raise exception 'Describe la desviación'; end if;
 select * into c from cause_analyses where report_id=r.id for update;
 if found then
  if not can_edit_analysis(c.id) or exists(select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where a.analysis_id=c.id and t.review_status in ('En revisión','Aprobado')) then raise exception 'El análisis ya fue enviado a revisión'; end if;
  update cause_analyses set cause=trim(cause_text),deviation_description=trim(deviation_text),complementary_data=coalesce(trim(complementary_text),''),updated_at=now() where id=c.id returning id into result_id;
 else
  insert into cause_analyses(report_id,cause,deviation_description,complementary_data,created_by) values(r.id,trim(cause_text),trim(deviation_text),coalesce(trim(complementary_text),''),auth.uid()) returning id into result_id;
 end if;
 insert into corrective_events(analysis_id,event,note,actor) values(result_id,'Análisis guardado',trim(cause_text),auth.uid()); return result_id;
end; $$;
revoke all on function public.save_cause_analysis_details(bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.save_cause_analysis_details(bigint,text,text,text) to authenticated;
alter table public.corrective_actions add column if not exists responsible text;
alter table public.corrective_actions add column if not exists due_date date;
create or replace function public.add_corrective_action_details(analysis bigint,action_name text,action_description text,action_responsible text,action_due_date date) returns bigint language plpgsql security definer set search_path=public as $$
declare result_id bigint;
begin
 perform 1 from cause_analyses where id=analysis for update;
 if not can_edit_analysis(analysis) then raise exception 'El análisis no admite nuevas acciones'; end if;
 if coalesce(length(trim(action_name)),0)=0 or coalesce(length(trim(action_description)),0)=0 then raise exception 'Completa la acción y su descripción'; end if;
 if coalesce(length(trim(action_responsible)),0)=0 or action_due_date is null then raise exception 'Indica responsable y fecha fin'; end if;
 insert into corrective_actions(analysis_id,name,description,responsible,due_date) values(analysis,trim(action_name),trim(action_description),trim(action_responsible),action_due_date) returning id into result_id;
 insert into corrective_events(analysis_id,event,note,actor) values(analysis,'Acción creada',action_name,auth.uid()); return result_id;
end; $$;
revoke all on function public.add_corrective_action_details(bigint,text,text,text,date) from public,anon,authenticated;
grant execute on function public.add_corrective_action_details(bigint,text,text,text,date) to authenticated;
notify pgrst,'reload schema';
commit;
