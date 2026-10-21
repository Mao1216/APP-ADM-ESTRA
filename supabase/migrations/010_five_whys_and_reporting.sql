-- Cinco porqués y registro seguro de mediciones.
begin;

alter table public.cause_analyses
  add column if not exists five_whys jsonb not null default '[]'::jsonb;

alter table public.cause_analyses drop constraint if exists cause_analyses_five_whys_array;
alter table public.cause_analyses
  add constraint cause_analyses_five_whys_array
  check (jsonb_typeof(five_whys) = 'array');

create or replace function public.save_five_whys(measurement bigint, answers jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.indicator_reports;
  c public.cause_analyses;
  answer_count integer;
  result_id bigint;
begin
  select * into strict r from public.indicator_reports where id = measurement for update;
  if auth.uid() is null or not public.can_manage_reporting(r.indicator_id) then
    raise exception 'Solo el gerente responsable puede registrar los 5 porqués';
  end if;
  if r.status <> 'Fuera de meta' then
    raise exception 'Los 5 porqués requieren una medición fuera de meta';
  end if;
  if jsonb_typeof(answers) <> 'array' then
    raise exception 'Las respuestas de los 5 porqués no son válidas';
  end if;
  select count(*) into answer_count from jsonb_array_elements_text(answers) answer where length(trim(answer)) > 0;
  if jsonb_array_length(answers) <> 5 or answer_count <> 5 then
    raise exception 'Completa las cinco respuestas antes de guardar';
  end if;
  select * into c from public.cause_analyses where report_id = r.id for update;
  if found then
    if not public.can_edit_analysis(c.id)
       or exists (
         select 1 from public.corrective_tasks t
         join public.corrective_actions a on a.id = t.action_id
         where a.analysis_id = c.id and t.review_status in ('En revisión', 'Aprobado')
       ) then
      raise exception 'El análisis ya fue enviado a revisión';
    end if;
    update public.cause_analyses set five_whys = answers, cause = trim(answers ->> 4), updated_at = now()
    where id = c.id returning id into result_id;
  else
    insert into public.cause_analyses (
      report_id, cause, deviation_description, complementary_data, five_whys, created_by
    ) values (
      r.id, trim(answers ->> 4),
      coalesce(nullif(trim(r.observations), ''), 'El resultado del periodo ' || r.period || ' se encuentra fuera de meta.'),
      '', answers, auth.uid()
    ) returning id into result_id;
  end if;
  insert into public.corrective_events (analysis_id, event, note, actor)
  values (result_id, '5 porqués guardados', trim(answers ->> 4), auth.uid());
  return result_id;
end;
$$;
revoke all on function public.save_five_whys(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_five_whys(bigint, jsonb) to authenticated;

create or replace function public.register_indicator_measurement(
  indicator bigint, report_period text, report_result numeric, report_observations text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.indicators;
  result_id bigint;
begin
  if auth.uid() is null then raise exception 'Tu sesión venció. Vuelve a iniciar sesión'; end if;
  select * into strict i from public.indicators where id = indicator for update;
  if not public.can_report(i.id) then raise exception 'Tu cuenta no está asignada para reportar este indicador'; end if;
  if i.approval_status <> 'Aprobado' then raise exception 'El indicador debe estar aprobado antes de registrar resultados'; end if;
  if coalesce(length(trim(report_period)), 0) = 0 then raise exception 'Selecciona el periodo del reporte'; end if;
  if report_result is null then raise exception 'Ingresa el resultado obtenido'; end if;
  insert into public.indicator_reports (
    indicator_id, period, result, status, registered_date, observations, created_by
  ) values (
    i.id, trim(report_period), report_result, 'Sin reporte', current_date,
    nullif(trim(report_observations), ''), auth.uid()
  ) returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.register_indicator_measurement(bigint, text, numeric, text) from public, anon, authenticated;
grant execute on function public.register_indicator_measurement(bigint, text, numeric, text) to authenticated;
notify pgrst, 'reload schema';
commit;
