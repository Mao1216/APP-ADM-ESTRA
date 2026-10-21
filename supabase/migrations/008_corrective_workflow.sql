-- Después de 007: análisis, acciones, tareas, revisión individual y eficacia.
begin;
create table if not exists public.cause_analyses (
 id bigint generated always as identity primary key,
 report_id bigint not null unique references public.indicator_reports(id),
 cause text not null check(length(trim(cause))>0),
 status text not null default 'En proceso' check(status in ('En proceso','Pendiente de verificación','Eficaz','No eficaz')),
 approved_at timestamptz, followup_report_id bigint references public.indicator_reports(id), efficacy_decided_by uuid references auth.users(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.corrective_actions (
 id bigint generated always as identity primary key, analysis_id bigint not null references public.cause_analyses(id),
 name text not null check(length(trim(name))>0), description text not null check(length(trim(description))>0), created_at timestamptz not null default now()
);
create table if not exists public.corrective_tasks (
 id bigint generated always as identity primary key, action_id bigint not null references public.corrective_actions(id),
 name text not null check(length(trim(name))>0), description text not null check(length(trim(description))>0),
 progress integer not null default 0 check(progress between 0 and 100),
 review_status text not null default 'Borrador' check(review_status in ('Borrador','En revisión','Observado','Aprobado')),
 review_note text, notified_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(review_status not in ('En revisión','Aprobado') or progress=100)
);
create table if not exists public.corrective_evidence (
 id bigint generated always as identity primary key, task_id bigint not null references public.corrective_tasks(id),
 storage_path text not null unique, file_name text not null, file_size bigint not null check(file_size between 1 and 20971520),
 uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.corrective_events (
 id bigint generated always as identity primary key, analysis_id bigint not null references public.cause_analyses(id),
 task_id bigint references public.corrective_tasks(id), event text not null, note text, snapshot jsonb not null default '{}',
 actor uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists corrective_actions_analysis_id_idx on public.corrective_actions(analysis_id);
create index if not exists corrective_tasks_action_id_idx on public.corrective_tasks(action_id);
create index if not exists corrective_evidence_task_id_idx on public.corrective_evidence(task_id);
create index if not exists corrective_events_analysis_id_idx on public.corrective_events(analysis_id);
create or replace function public.can_read_analysis(analysis bigint) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from cause_analyses c join indicator_reports r on r.id=c.report_id where c.id=analysis and (is_gcg() or can_manage_reporting(r.indicator_id)));
$$;
create or replace function public.can_edit_analysis(analysis bigint) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from cause_analyses c join indicator_reports r on r.id=c.report_id where c.id=analysis and c.status='En proceso' and c.approved_at is null and can_manage_reporting(r.indicator_id));
$$;
create or replace function public.can_edit_corrective_task(task bigint) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where t.id=task and t.review_status in ('Borrador','Observado') and can_edit_analysis(a.analysis_id));
$$;
alter table public.cause_analyses enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.corrective_tasks enable row level security;
alter table public.corrective_evidence enable row level security;
alter table public.corrective_events enable row level security;
drop policy if exists "Read authorized analyses" on public.cause_analyses;
drop policy if exists "Read authorized actions" on public.corrective_actions;
drop policy if exists "Read authorized corrective tasks" on public.corrective_tasks;
drop policy if exists "Read authorized evidence" on public.corrective_evidence;
drop policy if exists "Read corrective history" on public.corrective_events;
create policy "Read authorized analyses" on public.cause_analyses for select to authenticated using(can_read_analysis(id));
create policy "Read authorized actions" on public.corrective_actions for select to authenticated using(can_read_analysis(analysis_id));
create policy "Read authorized corrective tasks" on public.corrective_tasks for select to authenticated using(exists(select 1 from corrective_actions a where a.id=action_id and can_read_analysis(a.analysis_id)));
create policy "Read authorized evidence" on public.corrective_evidence for select to authenticated using(exists(select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where t.id=task_id and can_read_analysis(a.analysis_id)));
create policy "Read corrective history" on public.corrective_events for select to authenticated using(can_read_analysis(analysis_id));
revoke all on public.cause_analyses,public.corrective_actions,public.corrective_tasks,public.corrective_evidence,public.corrective_events from public,anon,authenticated;
grant select on public.cause_analyses,public.corrective_actions,public.corrective_tasks,public.corrective_evidence,public.corrective_events to authenticated;

create or replace function public.save_cause_analysis(measurement bigint,cause_text text) returns bigint language plpgsql security definer set search_path=public as $$
declare r indicator_reports; c cause_analyses; result_id bigint;
begin
 select * into strict r from indicator_reports where id=measurement for update;
 if auth.uid() is null or not can_manage_reporting(r.indicator_id) then raise exception 'Solo el gerente responsable puede registrar el análisis'; end if;
 if r.status<>'Fuera de meta' then raise exception 'El análisis requiere una medición fuera de meta'; end if;
 if coalesce(length(trim(cause_text)),0)=0 then raise exception 'Describe el análisis de causa'; end if;
 select * into c from cause_analyses where report_id=r.id for update;
 if found then
  if not can_edit_analysis(c.id) or exists(select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where a.analysis_id=c.id and t.review_status in ('En revisión','Aprobado')) then raise exception 'El análisis ya fue enviado a revisión'; end if;
  update cause_analyses set cause=trim(cause_text),updated_at=now() where id=c.id returning id into result_id;
 else
  insert into cause_analyses(report_id,cause,created_by) values(r.id,trim(cause_text),auth.uid()) returning id into result_id;
 end if;
 insert into corrective_events(analysis_id,event,note,actor) values(result_id,'Análisis guardado',trim(cause_text),auth.uid());
 return result_id;
end; $$;
create or replace function public.add_corrective_action(analysis bigint,action_name text,action_description text) returns bigint language plpgsql security definer set search_path=public as $$
declare result_id bigint;
begin
 perform 1 from cause_analyses where id=analysis for update;
 if not can_edit_analysis(analysis) then raise exception 'El análisis no admite nuevas acciones'; end if;
 insert into corrective_actions(analysis_id,name,description) values(analysis,trim(action_name),trim(action_description)) returning id into result_id;
 insert into corrective_events(analysis_id,event,note,actor) values(analysis,'Acción creada',action_name,auth.uid());
 return result_id;
end; $$;
create or replace function public.update_corrective_action(action bigint,action_name text,action_description text) returns void language plpgsql security definer set search_path=public as $$
declare a corrective_actions;
begin
 select * into strict a from corrective_actions where id=action;
 perform 1 from cause_analyses where id=a.analysis_id for update;
 if not can_edit_analysis(a.analysis_id) or exists(select 1 from corrective_tasks where action_id=action and review_status in ('En revisión','Aprobado')) then raise exception 'No se puede cambiar una acción que tiene tareas en revisión o aprobadas'; end if;
 update corrective_actions set name=trim(action_name),description=trim(action_description) where id=action;
 insert into corrective_events(analysis_id,event,note,snapshot,actor) values(a.analysis_id,'Acción corregida',action_name,to_jsonb(a),auth.uid());
end; $$;
create or replace function public.save_corrective_task(action bigint,task bigint,task_name text,task_description text,task_progress integer) returns bigint language plpgsql security definer set search_path=public as $$
declare a corrective_actions; t corrective_tasks; result_id bigint;
begin
 select * into strict a from corrective_actions where id=action;
 perform 1 from cause_analyses where id=a.analysis_id for update;
 if not can_edit_analysis(a.analysis_id) then raise exception 'No puedes modificar tareas de este análisis'; end if;
 if task is null then
  insert into corrective_tasks(action_id,name,description,progress) values(action,trim(task_name),trim(task_description),task_progress) returning id into result_id;
 else
  select * into strict t from corrective_tasks where id=task and action_id=action for update;
  if not can_edit_corrective_task(t.id) then raise exception 'No se puede editar una tarea en revisión o aprobada'; end if;
  update corrective_tasks set name=trim(task_name),description=trim(task_description),progress=task_progress,updated_at=now() where id=t.id returning id into result_id;
 end if;
 insert into corrective_events(analysis_id,task_id,event,snapshot,actor) values(a.analysis_id,result_id,'Tarea guardada',jsonb_build_object('name',task_name,'description',task_description,'progress',task_progress),auth.uid());
 return result_id;
end; $$;
create or replace function public.notify_corrective_task(task bigint) returns void language plpgsql security definer set search_path=public as $$
declare t corrective_tasks; a corrective_actions;
begin
 select * into strict a from corrective_actions where id=(select action_id from corrective_tasks where id=task);
 perform 1 from cause_analyses where id=a.analysis_id for update;
 select * into strict t from corrective_tasks where id=task for update;
 if not can_edit_corrective_task(task) or t.progress<>100 then raise exception 'Guarda el avance en 100%% antes de notificar'; end if;
 update corrective_tasks set review_status='En revisión',notified_at=now(),reviewed_by=null,reviewed_at=null,updated_at=now() where id=task;
 insert into corrective_events(analysis_id,task_id,event,snapshot,actor) values(a.analysis_id,task,'Notificado a GCG',to_jsonb(t),auth.uid());
end; $$;

-- No usar una medición anterior a terminar las correcciones como prueba de eficacia.
create or replace function public.refresh_analysis_followup(analysis bigint) returns void language plpgsql security definer set search_path=public as $$
declare c cause_analyses; original indicator_reports; following indicator_reports; next_status text;
begin
 select * into strict c from cause_analyses where id=analysis for update;
 if c.approved_at is null or c.efficacy_decided_by is not null then return; end if;
 select * into strict original from indicator_reports where id=c.report_id;
 select * into following from indicator_reports r where r.indicator_id=original.indicator_id and indicator_period_date(r.period)>indicator_period_date(original.period) and r.created_at>=c.approved_at order by indicator_period_date(r.period),r.created_at,r.id limit 1;
 if not found then return; end if;
 next_status=case when following.status='En meta' then 'Eficaz' else 'Pendiente de verificación' end;
 update cause_analyses set followup_report_id=following.id,status=next_status,updated_at=now() where id=c.id;
 if c.followup_report_id is distinct from following.id or c.status is distinct from next_status then
  insert into corrective_events(analysis_id,event,snapshot) values(c.id,'Medición posterior evaluada',jsonb_build_object('report_id',following.id,'period',following.period,'status',following.status));
 end if;
end; $$;
create or replace function public.review_corrective_task(task bigint,approve boolean,review_comment text) returns void language plpgsql security definer set search_path=public as $$
declare t corrective_tasks; a corrective_actions;
begin
 if auth.uid() is null or not is_gcg() then raise exception 'Solo GCG puede verificar tareas'; end if;
 select * into strict a from corrective_actions where id=(select action_id from corrective_tasks where id=task);
 perform 1 from cause_analyses where id=a.analysis_id for update;
 select * into strict t from corrective_tasks where id=task for update;
 if t.review_status<>'En revisión' or t.progress<>100 then raise exception 'La tarea no está disponible para revisión'; end if;
 if approve is null then raise exception 'Indica una decisión'; end if;
 if not approve and coalesce(length(trim(review_comment)),0)=0 then raise exception 'Describe qué debe subsanarse'; end if;
 update corrective_tasks set review_status=case when approve then 'Aprobado' else 'Observado' end,review_note=nullif(trim(review_comment),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=task;
 insert into corrective_events(analysis_id,task_id,event,note,snapshot,actor) values(a.analysis_id,task,case when approve then 'Tarea aprobada' else 'Tarea observada' end,review_comment,to_jsonb(t),auth.uid());
 if approve and not exists(select 1 from corrective_actions ca where ca.analysis_id=a.analysis_id and not exists(select 1 from corrective_tasks ct where ct.action_id=ca.id)) and not exists(select 1 from corrective_tasks ct join corrective_actions ca on ca.id=ct.action_id where ca.analysis_id=a.analysis_id and ct.review_status<>'Aprobado') then
  update cause_analyses set approved_at=now(),updated_at=now() where id=a.analysis_id;
  perform refresh_analysis_followup(a.analysis_id);
 end if;
end; $$;
create or replace function public.decide_cause_efficacy(analysis bigint,same_cause boolean,decision_reason text) returns void language plpgsql security definer set search_path=public as $$
declare c cause_analyses; next_analysis cause_analyses;
begin
 if auth.uid() is null or not is_gcg() then raise exception 'Solo GCG puede decidir la eficacia'; end if;
 select * into strict c from cause_analyses where id=analysis for update;
 if c.status<>'Pendiente de verificación' or c.followup_report_id is null then raise exception 'Falta la medición posterior fuera de meta'; end if;
 select * into next_analysis from cause_analyses where report_id=c.followup_report_id;
 if not found then raise exception 'Falta registrar el nuevo análisis de causa'; end if;
 if same_cause is null or coalesce(length(trim(decision_reason)),0)=0 then raise exception 'Compara las causas y justifica la decisión'; end if;
 update cause_analyses set status=case when same_cause then 'No eficaz' else 'Eficaz' end,efficacy_decided_by=auth.uid(),updated_at=now() where id=analysis;
 insert into corrective_events(analysis_id,event,note,snapshot,actor) values(analysis,case when same_cause then 'No eficaz: causa similar' else 'Eficaz: causa diferente' end,decision_reason,jsonb_build_object('new_analysis_id',next_analysis.id,'previous_cause',c.cause,'new_cause',next_analysis.cause),auth.uid());
end; $$;
create or replace function public.update_corrective_followups() returns trigger language plpgsql security definer set search_path=public as $$
declare analysis_id bigint;
begin
 for analysis_id in select c.id from cause_analyses c join indicator_reports r on r.id=c.report_id where r.indicator_id=new.indicator_id and c.approved_at is not null and c.efficacy_decided_by is null order by c.id loop
  perform refresh_analysis_followup(analysis_id);
 end loop;
 return new;
end; $$;
drop trigger if exists update_corrective_followups on public.indicator_reports;
create trigger update_corrective_followups after insert or update on public.indicator_reports for each row execute function public.update_corrective_followups();

insert into storage.buckets(id,name,public,file_size_limit) values('corrective-evidence','corrective-evidence',false,20971520) on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit;
create or replace function public.corrective_path_task(path text) returns bigint language sql immutable as $$
 select case when split_part(path,'/',1) ~ '^[0-9]{1,18}$' then split_part(path,'/',1)::bigint else null end;
$$;
drop policy if exists "Upload corrective evidence" on storage.objects;
drop policy if exists "Read corrective evidence files" on storage.objects;
drop policy if exists "Clean failed own evidence uploads" on storage.objects;
create policy "Upload corrective evidence" on storage.objects for insert to authenticated with check(bucket_id='corrective-evidence' and can_edit_corrective_task(corrective_path_task(name)));
create policy "Read corrective evidence files" on storage.objects for select to authenticated using(bucket_id='corrective-evidence' and exists(select 1 from corrective_tasks t join corrective_actions a on a.id=t.action_id where t.id=corrective_path_task(storage.objects.name) and can_read_analysis(a.analysis_id)));
create policy "Clean failed own evidence uploads" on storage.objects for delete to authenticated using(bucket_id='corrective-evidence' and owner_id=auth.uid()::text and can_edit_corrective_task(corrective_path_task(name)) and not exists(select 1 from corrective_evidence e where e.storage_path=name));
create or replace function public.register_corrective_evidence(task bigint,path text,original_name text,bytes bigint) returns void language plpgsql security definer set search_path=public as $$
declare a corrective_actions;
begin
 select * into strict a from corrective_actions where id=(select action_id from corrective_tasks where id=task);
 perform 1 from cause_analyses where id=a.analysis_id for update;
 perform 1 from corrective_tasks where id=task for update;
 if not can_edit_corrective_task(task) or corrective_path_task(path) is distinct from task then raise exception 'No puedes adjuntar esta evidencia'; end if;
 if not exists(select 1 from storage.objects where bucket_id='corrective-evidence' and name=path and owner_id=auth.uid()::text) then raise exception 'El archivo no fue subido por tu cuenta'; end if;
 insert into corrective_evidence(task_id,storage_path,file_name,file_size,uploaded_by) values(task,path,original_name,bytes,auth.uid());
 insert into corrective_events(analysis_id,task_id,event,note,actor) values(a.analysis_id,task,'Evidencia adjuntada',original_name,auth.uid());
end; $$;
revoke all on function public.can_read_analysis(bigint),public.can_edit_analysis(bigint),public.can_edit_corrective_task(bigint),public.save_cause_analysis(bigint,text),public.add_corrective_action(bigint,text,text),public.save_corrective_task(bigint,bigint,text,text,integer),public.notify_corrective_task(bigint),public.refresh_analysis_followup(bigint),public.review_corrective_task(bigint,boolean,text),public.decide_cause_efficacy(bigint,boolean,text),public.update_corrective_followups(),public.corrective_path_task(text),public.register_corrective_evidence(bigint,text,text,bigint) from public,anon,authenticated;
grant execute on function public.can_read_analysis(bigint),public.can_edit_analysis(bigint),public.can_edit_corrective_task(bigint),public.save_cause_analysis(bigint,text),public.add_corrective_action(bigint,text,text),public.save_corrective_task(bigint,bigint,text,text,integer),public.notify_corrective_task(bigint),public.review_corrective_task(bigint,boolean,text),public.decide_cause_efficacy(bigint,boolean,text),public.corrective_path_task(text),public.register_corrective_evidence(bigint,text,text,bigint) to authenticated;
revoke all on function public.update_corrective_action(bigint,text,text) from public,anon,authenticated;
grant execute on function public.update_corrective_action(bigint,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
