-- Unifica acciones y tareas conservando registros, evidencias e historial.
begin;
drop trigger if exists update_corrective_followups on public.indicator_reports;
revoke execute on function public.notify_corrective_task(bigint), public.review_corrective_task(bigint,boolean,text), public.decide_cause_efficacy(bigint,boolean,text) from public,anon,authenticated;

create or replace function public.can_edit_analysis(analysis bigint) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (is_super_admin() or not is_gcg()) and exists(select 1 from cause_analyses c join indicator_reports r on r.id=c.report_id where c.id=analysis and can_manage_reporting(r.indicator_id));
$$;
create or replace function public.can_edit_corrective_task(task bigint) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where t.id=task and can_edit_analysis(a.analysis_id));
$$;

-- Cada tarea mantiene su ID para conservar evidencias e historial y se convierte
-- en una acción independiente, heredando responsable y fecha fin.
do $$
declare a corrective_actions; t corrective_tasks; parent_id bigint; first_item boolean;
begin
 for a in select * from corrective_actions order by id loop
  first_item := true;
  for t in select * from corrective_tasks where action_id=a.id order by id loop
   if first_item then parent_id:=a.id; first_item:=false;
   else
    insert into corrective_actions(analysis_id,name,description,responsible,due_date) values(a.analysis_id,t.name,t.description,a.responsible,a.due_date) returning id into parent_id;
   end if;
   update corrective_tasks set action_id=parent_id where id=t.id;
  end loop;
  if first_item then insert into corrective_tasks(action_id,name,description,progress) values(a.id,a.name,a.description,0); end if;
 end loop;
end $$;
update corrective_tasks set review_status='Borrador';
update cause_analyses set status='En proceso',approved_at=null,followup_report_id=null,efficacy_decided_by=null;

create or replace function public.save_unified_corrective_action(analysis bigint,item bigint,action_name text,action_description text,action_responsible text,action_due_date date,action_progress integer) returns bigint language plpgsql security definer set search_path=public as $$
declare parent_id bigint; result_id bigint;
begin
 perform 1 from cause_analyses where id=analysis for update;
 if not can_edit_analysis(analysis) then raise exception 'No tienes permiso para editar estas acciones'; end if;
 if coalesce(length(trim(action_name)),0)=0 or coalesce(length(trim(action_description)),0)=0 or coalesce(length(trim(action_responsible)),0)=0 or action_due_date is null or action_progress is null or action_progress not between 0 and 100 then raise exception 'Completa la acción, responsable, fecha y avance entre 0 y 100'; end if;
 if item is null then
  insert into corrective_actions(analysis_id,name,description,responsible,due_date) values(analysis,trim(action_name),trim(action_description),action_responsible,action_due_date) returning id into parent_id;
  insert into corrective_tasks(action_id,name,description,progress) values(parent_id,trim(action_name),trim(action_description),action_progress) returning id into result_id;
 else
  select a.id into strict parent_id from corrective_actions a join corrective_tasks t on t.action_id=a.id where t.id=item and a.analysis_id=analysis for update of a,t;
  update corrective_actions set name=trim(action_name),description=trim(action_description),responsible=action_responsible,due_date=action_due_date where id=parent_id;
  update corrective_tasks set name=trim(action_name),description=trim(action_description),progress=action_progress,updated_at=now() where id=item;
  result_id:=item;
 end if;
 insert into corrective_events(analysis_id,task_id,event,snapshot,actor) values(analysis,result_id,'Acción guardada',jsonb_build_object('name',action_name,'description',action_description,'progress',action_progress,'responsible',action_responsible,'due_date',action_due_date),auth.uid());
 return result_id;
end $$;
revoke all on function public.save_unified_corrective_action(bigint,bigint,text,text,text,date,integer) from public,anon;
grant execute on function public.save_unified_corrective_action(bigint,bigint,text,text,text,date,integer) to authenticated;
-- Las rutas antiguas de creación no deben volver a crear la jerarquía retirada.
revoke execute on function public.add_corrective_action(bigint,text,text),public.add_corrective_action_details(bigint,text,text,text,date),public.save_corrective_task(bigint,bigint,text,text,integer),public.update_corrective_action(bigint,text,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
