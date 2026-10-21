-- Solicitudes revisables, auditoría de cambios directos GCG y dos porqués mínimos.
begin;

alter table public.indicator_change_requests
  add column if not exists requested_email text,
  add column if not exists review_comment text;

update public.indicator_change_requests request
set requested_email = users.email
from auth.users users
where request.requested_email is null and users.id = request.requested_by;

alter table public.indicator_change_requests
  drop constraint if exists indicator_change_requests_kind_check;
alter table public.indicator_change_requests
  add constraint indicator_change_requests_kind_check check (kind in ('target','report','definition','delete_report'));
alter table public.indicator_change_requests
  drop constraint if exists indicator_change_requests_check;
alter table public.indicator_change_requests
  add constraint indicator_change_requests_report_check check ((kind in ('report','delete_report')) = (report_id is not null));

create table if not exists public.indicator_change_audit (
  id bigint generated always as identity primary key,
  indicator_id bigint not null references public.indicators(id),
  report_id bigint references public.indicator_reports(id) on delete set null,
  kind text not null,
  previous jsonb not null default '{}'::jsonb,
  current jsonb not null default '{}'::jsonb,
  reason text not null,
  changed_by uuid not null references auth.users(id),
  changed_email text not null,
  created_at timestamptz not null default now()
);
alter table public.indicator_change_audit enable row level security;
create policy "Read audit as GCG" on public.indicator_change_audit for select to authenticated using (is_gcg());

create or replace function public.prepare_indicator_change() returns trigger language plpgsql security definer set search_path = public as $$
declare i indicators; r indicator_reports;
begin
 select * into strict i from indicators where id = new.indicator_id;
 new.requested_email := coalesce(new.requested_email, lower(auth.jwt()->>'email'));
 if new.kind = 'target' then
   if new.proposed - array['target','comparator'] <> '{}'::jsonb or new.proposed->>'target' is null or new.proposed->>'comparator' is null or new.proposed->>'comparator' not in ('>','>=','=','<=','<') then raise exception 'Propuesta de meta inválida'; end if;
   perform (new.proposed->>'target')::numeric;
   new.previous := jsonb_build_object('target',i.target,'comparator',i.comparator);
 elsif new.kind in ('report','delete_report') then
   select * into strict r from indicator_reports where id = new.report_id and indicator_id = new.indicator_id;
   new.proposed := coalesce(new.proposed,'{}'::jsonb) || jsonb_build_object('period',r.period);
   if new.kind = 'report' then
     if new.proposed - array['result','measurement_target','measurement_comparator','period'] <> '{}'::jsonb or new.proposed->>'result' is null then raise exception 'Resultado inválido'; end if;
     perform (new.proposed->>'result')::numeric;
     if r.measurement_target is null then
       if new.proposed->>'measurement_target' is null or new.proposed->>'measurement_comparator' is null or new.proposed->>'measurement_comparator' not in ('>','>=','=','<=','<') then raise exception 'Indica la meta histórica para que GCG la verifique'; end if;
       perform (new.proposed->>'measurement_target')::numeric;
     elsif new.proposed ? 'measurement_target' or new.proposed ? 'measurement_comparator' then raise exception 'La meta histórica registrada no se puede cambiar'; end if;
   elsif new.proposed - 'period' <> '{}'::jsonb then raise exception 'La eliminación de reporte no admite valores propuestos'; end if;
   new.previous := jsonb_build_object('result',r.result,'period',r.period);
 else
   if new.proposed - 'name' <> '{}'::jsonb or coalesce(length(trim(new.proposed->>'name')),0) = 0 then raise exception 'Nombre inválido'; end if;
   new.previous := jsonb_build_object('name',i.name);
 end if;
 return new;
end; $$;

create or replace function public.refresh_indicator_status_after_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update indicators set status = coalesce((select status from indicator_reports where indicator_id = old.indicator_id order by public.indicator_period_date(period) desc,created_at desc,id desc limit 1),'Sin reporte'), updated_at = now() where id = old.indicator_id;
  return old;
end; $$;
drop trigger if exists refresh_measurement_status_after_delete on public.indicator_reports;
create trigger refresh_measurement_status_after_delete after delete on public.indicator_reports for each row execute function public.refresh_indicator_status_after_delete();

drop function if exists public.review_indicator_change(bigint,boolean);
create function public.review_indicator_change(request_id bigint, approve boolean, review_comment text default null) returns void language plpgsql security definer set search_path = public as $$
declare q indicator_change_requests; i indicators; r indicator_reports;
begin
 if not is_gcg() then raise exception 'Solo GCG puede revisar solicitudes'; end if;
 if not approve and coalesce(length(trim(review_comment)),0) = 0 then raise exception 'Ingresa un comentario al rechazar la solicitud'; end if;
 select * into strict q from indicator_change_requests where id = request_id for update;
 if q.status <> 'Pendiente' then raise exception 'La solicitud ya fue revisada'; end if;
 if approve then
   select * into strict i from indicators where id = q.indicator_id for update;
   if q.kind = 'target' then
     if q.previous <> jsonb_build_object('target',i.target,'comparator',i.comparator) then raise exception 'La meta cambió desde la solicitud. Envía otra solicitud.'; end if;
     insert into indicator_target_history(indicator_id,target,comparator,changed_by) values(i.id,i.target,i.comparator,auth.uid());
     update indicators set target=(q.proposed->>'target')::numeric, comparator=q.proposed->>'comparator', updated_at=now() where id=i.id;
   elsif q.kind = 'report' then
     select * into strict r from indicator_reports where id=q.report_id for update;
     if q.previous->>'result' <> r.result::text then raise exception 'La medición cambió desde la solicitud'; end if;
     update indicator_reports set result=(q.proposed->>'result')::numeric, measurement_target=coalesce(r.measurement_target,(q.proposed->>'measurement_target')::numeric), measurement_comparator=coalesce(r.measurement_comparator,q.proposed->>'measurement_comparator'), updated_at=now() where id=r.id;
   elsif q.kind = 'delete_report' then
     delete from indicator_reports where id=q.report_id;
   else
     if q.previous <> jsonb_build_object('name',i.name) then raise exception 'El nombre cambió desde la solicitud'; end if;
     update indicators set name=q.proposed->>'name', updated_at=now() where id=i.id;
   end if;
 end if;
 update indicator_change_requests set status=case when approve then 'Aprobado' else 'Rechazado' end, reviewed_by=auth.uid(), reviewed_at=now(), review_comment=nullif(trim(review_comment),'') where id=q.id;
end; $$;

create or replace function public.apply_gcg_indicator_change(indicator bigint, change_kind text, target_report bigint, proposed jsonb, change_reason text) returns void language plpgsql security definer set search_path = public as $$
declare i indicators; r indicator_reports; before_value jsonb; after_value jsonb;
begin
 if not is_gcg() then raise exception 'Solo GCG puede aplicar cambios directos'; end if;
 if coalesce(length(trim(change_reason)),0)=0 then raise exception 'Indica el motivo del cambio'; end if;
 select * into strict i from indicators where id=indicator for update;
 if change_kind='target' then
   if proposed->>'target' is null or proposed->>'comparator' not in ('>','>=','=','<=','<') then raise exception 'Meta inválida'; end if;
   before_value:=jsonb_build_object('target',i.target,'comparator',i.comparator); after_value:=jsonb_build_object('target',(proposed->>'target')::numeric,'comparator',proposed->>'comparator');
   insert into indicator_target_history(indicator_id,target,comparator,changed_by) values(i.id,i.target,i.comparator,auth.uid()); update indicators set target=(proposed->>'target')::numeric, comparator=proposed->>'comparator', updated_at=now() where id=i.id;
 elsif change_kind='definition' then
   if coalesce(length(trim(proposed->>'name')),0)=0 then raise exception 'Nombre inválido'; end if;
   before_value:=jsonb_build_object('name',i.name,'resource',i.resource,'formula',i.formula,'unit',i.unit,'frequency',i.frequency,'review_frequency',i.review_frequency,'owner_email',i.owner_email);
   after_value:=jsonb_build_object('name',proposed->>'name','resource',coalesce(proposed->>'resource',i.resource),'formula',coalesce(proposed->>'formula',i.formula),'unit',coalesce(proposed->>'unit',i.unit),'frequency',coalesce(proposed->>'frequency',i.frequency),'review_frequency',coalesce(proposed->>'review_frequency',i.review_frequency),'owner_email',coalesce(proposed->>'owner_email',i.owner_email));
   update indicators set name=after_value->>'name', resource=after_value->>'resource', formula=after_value->>'formula', unit=after_value->>'unit', frequency=after_value->>'frequency', review_frequency=after_value->>'review_frequency', owner_email=after_value->>'owner_email', updated_at=now() where id=i.id;
 elsif change_kind in ('report','delete_report') then
   select * into strict r from indicator_reports where id=target_report and indicator_id=i.id for update;
   before_value:=jsonb_build_object('result',r.result,'period',r.period);
   if change_kind='report' then if proposed->>'result' is null then raise exception 'Resultado inválido'; end if; after_value:=jsonb_build_object('result',(proposed->>'result')::numeric,'period',r.period); update indicator_reports set result=(proposed->>'result')::numeric,updated_at=now() where id=r.id;
   else after_value:=jsonb_build_object('deleted',true,'period',r.period); delete from indicator_reports where id=r.id; end if;
 else raise exception 'Tipo de cambio inválido'; end if;
 insert into indicator_change_audit(indicator_id,report_id,kind,previous,current,reason,changed_by,changed_email) values(i.id,case when change_kind='delete_report' then null else target_report end,change_kind,before_value,after_value,trim(change_reason),auth.uid(),lower(auth.jwt()->>'email'));
end; $$;

revoke all on function public.review_indicator_change(bigint,boolean,text), public.apply_gcg_indicator_change(bigint,text,bigint,jsonb,text) from public;
grant execute on function public.review_indicator_change(bigint,boolean,text), public.apply_gcg_indicator_change(bigint,text,bigint,jsonb,text) to authenticated;

create or replace function public.save_five_whys(measurement bigint, answers jsonb) returns bigint language plpgsql security definer set search_path = public as $$
declare r indicator_reports; c cause_analyses; answer_count integer; result_id bigint;
begin
 select * into strict r from indicator_reports where id=measurement for update;
 if auth.uid() is null or not can_manage_reporting(r.indicator_id) then raise exception 'Solo el gerente responsable puede registrar los porqués'; end if;
 if r.status <> 'Fuera de meta' then raise exception 'Los porqués requieren una medición fuera de meta'; end if;
 if jsonb_typeof(answers) <> 'array' then raise exception 'Las respuestas no son válidas'; end if;
 select count(*) into answer_count from jsonb_array_elements_text(answers) answer where length(trim(answer))>0;
 if jsonb_array_length(answers) <> 2 or answer_count <> 2 then raise exception 'Completa los dos porqués antes de guardar'; end if;
 select * into c from cause_analyses where report_id=r.id for update;
 if found then
   if not can_edit_analysis(c.id) or exists (select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where a.analysis_id=c.id and t.review_status in ('En revisión','Aprobado')) then raise exception 'El análisis ya fue enviado a revisión'; end if;
   update cause_analyses set five_whys=answers,cause=trim(answers->>1),updated_at=now() where id=c.id returning id into result_id;
 else
   insert into cause_analyses(report_id,cause,deviation_description,complementary_data,five_whys,created_by) values(r.id,trim(answers->>1),coalesce(nullif(trim(r.observations),''),'El resultado del periodo '||r.period||' se encuentra fuera de meta.'),'',answers,auth.uid()) returning id into result_id;
 end if;
 insert into corrective_events(analysis_id,event,note,actor) values(result_id,'Dos porqués guardados',trim(answers->>1),auth.uid());
 return result_id;
end; $$;
revoke all on function public.save_five_whys(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_five_whys(bigint,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
