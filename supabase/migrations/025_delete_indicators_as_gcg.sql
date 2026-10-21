-- GCG puede eliminar un indicador junto con sus mediciones y dependencias.
-- El procedimiento conserva la integridad referencial al retirar primero
-- los análisis y acciones correctivas relacionados.
begin;

create or replace function public.delete_indicator(indicator bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not is_gcg() then
    raise exception 'Solo GCG puede eliminar indicadores';
  end if;

  if not exists (select 1 from indicators where id = indicator) then
    raise exception 'No se encontró el indicador';
  end if;

  -- Si una medición eliminada era seguimiento de otro análisis, se conserva
  -- ese análisis sin la referencia al seguimiento ya inexistente.
  update cause_analyses
  set followup_report_id = null,
      efficacy_decided_by = null,
      updated_at = now()
  where followup_report_id in (
    select id from indicator_reports where indicator_id = indicator
  );

  delete from corrective_evidence
  where task_id in (
    select task.id
    from corrective_tasks task
    join corrective_actions action on action.id = task.action_id
    join cause_analyses analysis on analysis.id = action.analysis_id
    where analysis.report_id in (
      select id from indicator_reports where indicator_id = indicator
    )
  );

  delete from corrective_events
  where analysis_id in (
    select id from cause_analyses
    where report_id in (
      select id from indicator_reports where indicator_id = indicator
    )
  );

  delete from corrective_tasks
  where action_id in (
    select action.id
    from corrective_actions action
    join cause_analyses analysis on analysis.id = action.analysis_id
    where analysis.report_id in (
      select id from indicator_reports where indicator_id = indicator
    )
  );

  delete from corrective_actions
  where analysis_id in (
    select id from cause_analyses
    where report_id in (
      select id from indicator_reports where indicator_id = indicator
    )
  );

  delete from cause_analyses
  where report_id in (
    select id from indicator_reports where indicator_id = indicator
  );

  delete from indicator_change_audit where indicator_id = indicator;
  delete from indicator_change_requests where indicator_id = indicator;
  delete from indicators where id = indicator;
end;
$$;

revoke all on function public.delete_indicator(bigint) from public, anon;
grant execute on function public.delete_indicator(bigint) to authenticated;

-- Los indicadores creados antes de retirar la vista de aprobación se mantienen
-- reportables. El campo se conserva solo como compatibilidad interna.
update public.indicators
set approval_status = 'Aprobado'
where approval_status is distinct from 'Aprobado';

notify pgrst, 'reload schema';
commit;
