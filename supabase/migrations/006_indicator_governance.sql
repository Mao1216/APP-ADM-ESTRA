-- Ejecutar después de 005. Conserva los datos y migra gerente general a GCG.
begin;
update public.role_assignments set role = 'gcg' where role = 'gerente_general';
update public.profiles set role = 'gcg' where role = 'gerente_general';
update public.organization_people set role = 'gcg' where role = 'gerente_general';
alter table public.role_assignments drop constraint role_assignments_role_check;
alter table public.role_assignments add constraint role_assignments_role_check check (role in ('gcg','gerente_responsable','super_admin'));
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('gcg','gerente_responsable','super_admin'));
alter table public.organization_people drop constraint organization_people_role_check;
alter table public.organization_people add constraint organization_people_role_check check (role in ('gcg','gerente_responsable','super_admin'));

create or replace function public.is_gcg() returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from role_assignments where email = lower(auth.jwt()->>'email') and role in ('gcg','super_admin'));
$$;
create or replace function public.person_matches(person text) returns boolean language sql stable security definer set search_path = public as $$
 select person = lower(auth.jwt()->>'email') or exists(select 1 from organization_people where id::text = person and lower(email) = lower(auth.jwt()->>'email') and active);
$$;
alter table public.indicators add column if not exists reporter_email text;
create or replace function public.can_manage_reporting(indicator bigint) returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from indicators i join objectives o on o.id = i.objective_id where i.id = indicator and (person_matches(i.owner_email) or person_matches(o.owner_email)));
$$;
create or replace function public.can_report(indicator bigint) returns boolean language sql stable security definer set search_path = public as $$
 select can_manage_reporting(indicator) or exists(select 1 from indicators where id = indicator and person_matches(reporter_email));
$$;

drop policy if exists "Authenticated users manage objectives" on public.objectives;
drop policy if exists "Read objectives" on public.objectives;
drop policy if exists "GCG creates objectives" on public.objectives;
drop policy if exists "GCG updates objectives" on public.objectives;
create policy "Read objectives" on public.objectives for select to authenticated using (true);
create policy "GCG creates objectives" on public.objectives for insert to authenticated with check (is_gcg());
create policy "GCG updates objectives" on public.objectives for update to authenticated using (is_gcg()) with check (is_gcg());
drop policy if exists "Authenticated users manage indicators" on public.indicators;
drop policy if exists "Read indicators" on public.indicators;
drop policy if exists "GCG creates indicators" on public.indicators;
drop policy if exists "GCG updates indicators" on public.indicators;
create policy "Read indicators" on public.indicators for select to authenticated using (true);
create policy "GCG creates indicators" on public.indicators for insert to authenticated with check (is_gcg() and approval_status = 'Aprobado');
create policy "GCG updates indicators" on public.indicators for update to authenticated using (is_gcg()) with check (is_gcg());
-- La meta nunca se cambia mediante una escritura directa, incluso desde GCG.
create or replace function public.guard_indicator_target() returns trigger language plpgsql set search_path = public as $$
begin
 if current_user in ('authenticated','anon') and (new.target is distinct from old.target or new.comparator is distinct from old.comparator) then
   raise exception 'El cambio de meta requiere una solicitud aprobada por GCG';
 end if;
 return new;
end; $$;
drop trigger if exists guard_indicator_target on public.indicators;
create trigger guard_indicator_target before update on public.indicators for each row execute function public.guard_indicator_target();
drop policy if exists "Authenticated users manage indicator_reports" on public.indicator_reports;
drop policy if exists "Read reports" on public.indicator_reports;
drop policy if exists "Assigned users report" on public.indicator_reports;
create policy "Read reports" on public.indicator_reports for select to authenticated using (true);
alter table public.indicator_reports add column if not exists measurement_target numeric;
alter table public.indicator_reports add column if not exists measurement_comparator text;
-- Para datos anteriores no hay meta histórica verificable: queda nula.
create policy "Assigned users report" on public.indicator_reports for insert to authenticated with check (can_report(indicator_id) and created_by = auth.uid() and exists(select 1 from indicators where id = indicator_id and approval_status = 'Aprobado'));
drop policy if exists "Authenticated users manage indicator target history" on public.indicator_target_history;
drop policy if exists "Read target history" on public.indicator_target_history;
create policy "Read target history" on public.indicator_target_history for select to authenticated using (true);

create table if not exists public.indicator_change_requests (
 id bigint generated always as identity primary key,
 indicator_id bigint not null references public.indicators(id),
 report_id bigint references public.indicator_reports(id),
 kind text not null check (kind in ('target','report','definition')),
 proposed jsonb not null,
 previous jsonb not null default '{}',
 reason text not null check (length(trim(reason)) > 0),
 status text not null default 'Pendiente' check (status in ('Pendiente','Aprobado','Rechazado')),
 requested_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check ((kind = 'report') = (report_id is not null))
);
alter table public.indicator_change_requests enable row level security;
drop policy if exists "Read own requests or GCG" on public.indicator_change_requests;
drop policy if exists "Request authorized changes" on public.indicator_change_requests;
create policy "Read own requests or GCG" on public.indicator_change_requests for select to authenticated using (is_gcg() or requested_by = auth.uid());
create policy "Request authorized changes" on public.indicator_change_requests for insert to authenticated with check (requested_by = auth.uid() and status = 'Pendiente' and reviewed_by is null and reviewed_at is null and (is_gcg() or can_report(indicator_id)));

create or replace function public.prepare_indicator_change() returns trigger language plpgsql security definer set search_path = public as $$
declare i indicators; r indicator_reports;
begin
 select * into strict i from indicators where id = new.indicator_id;
 if new.kind = 'target' then
   if new.proposed - array['target','comparator'] <> '{}'::jsonb or new.proposed->>'target' is null or new.proposed->>'comparator' is null or new.proposed->>'comparator' not in ('>','>=','=','<=','<') then raise exception 'Propuesta de meta inválida'; end if;
   perform (new.proposed->>'target')::numeric;
   new.previous = jsonb_build_object('target',i.target,'comparator',i.comparator);
 elsif new.kind = 'report' then
   select * into strict r from indicator_reports where id = new.report_id and indicator_id = new.indicator_id;
   if new.proposed - array['result','measurement_target','measurement_comparator'] <> '{}'::jsonb or new.proposed->>'result' is null then raise exception 'Resultado inválido'; end if;
   perform (new.proposed->>'result')::numeric;
   if r.measurement_target is null then
     if new.proposed->>'measurement_target' is null or new.proposed->>'measurement_comparator' is null or new.proposed->>'measurement_comparator' not in ('>','>=','=','<=','<') then raise exception 'Indica la meta histórica para que GCG la verifique'; end if;
     perform (new.proposed->>'measurement_target')::numeric;
   elsif new.proposed ? 'measurement_target' or new.proposed ? 'measurement_comparator' then
     raise exception 'La meta histórica registrada no se puede cambiar';
   end if;
   new.previous = jsonb_build_object('result',r.result);
 else
   if new.proposed - 'name' <> '{}'::jsonb or coalesce(length(trim(new.proposed->>'name')),0) = 0 then raise exception 'Nombre inválido'; end if;
   new.previous = jsonb_build_object('name',i.name);
 end if;
 return new;
end; $$;
drop trigger if exists prepare_indicator_change on public.indicator_change_requests;
create trigger prepare_indicator_change before insert on public.indicator_change_requests for each row execute function public.prepare_indicator_change();

create or replace function public.measurement_status(result numeric, target numeric, comparator text) returns text language sql immutable as $$
 select case when case comparator when '>' then result > target when '>=' then result >= target when '<' then result < target when '<=' then result <= target when '=' then result = target else false end then 'En meta' else 'Fuera de meta' end;
$$;
-- El estado se calcula en servidor; la medición no se puede editar directamente.
create or replace function public.indicator_period_date(period text) returns date language plpgsql immutable set search_path = public as $$
declare parts text[]; month_number integer;
begin
 parts = regexp_split_to_array(lower(trim(replace(period,',',' '))), '\s+');
 month_number = array_position(array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],replace(parts[1],'setiembre','septiembre'));
 if month_number is null or parts[2] is null or parts[2] !~ '^\d{4}$' or array_length(parts,1) <> 2 then raise exception 'Periodo inválido. Usa Mes,Año'; end if;
 return make_date(parts[2]::integer,month_number,1);
end; $$;
create or replace function public.prepare_measurement() returns trigger language plpgsql security definer set search_path = public as $$
declare i indicators;
begin
 select * into strict i from indicators where id = new.indicator_id for update;
 if tg_op = 'INSERT' and exists(select 1 from indicator_reports where indicator_id = new.indicator_id and indicator_period_date(period) = indicator_period_date(new.period)) then raise exception 'Este periodo ya fue registrado. Solicita una corrección a GCG.'; end if;
 perform indicator_period_date(new.period);
 if tg_op = 'INSERT' then
   new.measurement_target = i.target;
   new.measurement_comparator = i.comparator;
 else
   new.measurement_target = coalesce(old.measurement_target,new.measurement_target);
   new.measurement_comparator = coalesce(old.measurement_comparator,new.measurement_comparator);
 end if;
 new.status = measurement_status(new.result,coalesce(new.measurement_target,i.target),coalesce(new.measurement_comparator,i.comparator));
 return new;
end; $$;
drop trigger if exists prepare_measurement on public.indicator_reports;
create trigger prepare_measurement before insert or update on public.indicator_reports for each row execute function public.prepare_measurement();
create or replace function public.refresh_measurement_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
 update indicators set status = (select status from indicator_reports where indicator_id = new.indicator_id order by public.indicator_period_date(period) desc,created_at desc,id desc limit 1), updated_at = now() where id = new.indicator_id;
 return new;
end; $$;
drop trigger if exists refresh_measurement_status on public.indicator_reports;
create trigger refresh_measurement_status after insert or update on public.indicator_reports for each row execute function public.refresh_measurement_status();

create or replace function public.assign_indicator_reporter(indicator bigint, reporter text) returns void language plpgsql security definer set search_path = public as $$
begin
 if not can_manage_reporting(indicator) and not is_gcg() then raise exception 'Solo el gerente asignado puede delegar el reporte'; end if;
 if reporter is not null and not exists(select 1 from organization_people where id::text = reporter and email is not null and active) and not exists(select 1 from profiles where email = reporter) then raise exception 'El responsable debe tener correo y acceso a BIOMET'; end if;
 update indicators set reporter_email = reporter where id = indicator;
end; $$;

create or replace function public.review_indicator_change(request_id bigint, approve boolean) returns void language plpgsql security definer set search_path = public as $$
declare q indicator_change_requests; i indicators; r indicator_reports;
begin
 if not is_gcg() then raise exception 'Solo GCG puede revisar solicitudes'; end if;
 select * into strict q from indicator_change_requests where id = request_id for update;
 if q.status <> 'Pendiente' then raise exception 'La solicitud ya fue revisada'; end if;
 if approve then
   select * into strict i from indicators where id = q.indicator_id for update;
   if q.kind = 'target' then
     if q.previous <> jsonb_build_object('target',i.target,'comparator',i.comparator) then raise exception 'La meta cambió desde la solicitud. Envía otra solicitud.'; end if;
     insert into indicator_target_history(indicator_id,target,comparator,changed_by) values(i.id,i.target,i.comparator,auth.uid());
     update indicators set target = (q.proposed->>'target')::numeric, comparator = q.proposed->>'comparator', updated_at = now() where id = i.id;
   elsif q.kind = 'report' then
     select * into strict r from indicator_reports where id = q.report_id for update;
     if q.previous <> jsonb_build_object('result',r.result) then raise exception 'La medición cambió desde la solicitud'; end if;
     update indicator_reports set result = (q.proposed->>'result')::numeric,
       measurement_target = coalesce(r.measurement_target,(q.proposed->>'measurement_target')::numeric),
       measurement_comparator = coalesce(r.measurement_comparator,q.proposed->>'measurement_comparator'),
       updated_at = now() where id = r.id;
   else
     if q.previous <> jsonb_build_object('name',i.name) then raise exception 'La definición cambió desde la solicitud'; end if;
     update indicators set name = q.proposed->>'name', updated_at = now() where id = i.id;
   end if;
 end if;
 update indicator_change_requests set status = case when approve then 'Aprobado' else 'Rechazado' end, reviewed_by = auth.uid(), reviewed_at = now() where id = q.id;
end; $$;
revoke all on function public.review_indicator_change(bigint,boolean), public.assign_indicator_reporter(bigint,text) from public;
grant execute on function public.review_indicator_change(bigint,boolean), public.assign_indicator_reporter(bigint,text) to authenticated;
commit;
