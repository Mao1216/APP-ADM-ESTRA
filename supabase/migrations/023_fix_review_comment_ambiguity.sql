-- Evita la ambigüedad entre la columna review_comment y el parámetro
-- recibido al aprobar o rechazar una solicitud de cambio.
begin;

create or replace function public.review_indicator_change(request_id bigint, approve boolean, review_comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q indicator_change_requests;
  i indicators;
  r indicator_reports;
begin
  if not is_gcg() then
    raise exception 'Solo GCG puede revisar solicitudes';
  end if;

  if not approve and coalesce(length(trim(review_indicator_change.review_comment)), 0) = 0 then
    raise exception 'Ingresa un comentario al rechazar la solicitud';
  end if;

  select * into strict q
  from indicator_change_requests
  where id = request_id
  for update;

  if q.status <> 'Pendiente' then
    raise exception 'La solicitud ya fue revisada';
  end if;

  if approve then
    select * into strict i from indicators where id = q.indicator_id for update;

    if q.kind = 'target' then
      if q.previous <> jsonb_build_object('target', i.target, 'comparator', i.comparator) then
        raise exception 'La meta cambió desde la solicitud. Envía otra solicitud.';
      end if;
      insert into indicator_target_history(indicator_id, target, comparator, changed_by)
      values (i.id, i.target, i.comparator, auth.uid());
      update indicators
      set target = (q.proposed->>'target')::numeric,
          comparator = q.proposed->>'comparator',
          updated_at = now()
      where id = i.id;
    elsif q.kind = 'report' then
      select * into strict r from indicator_reports where id = q.report_id for update;
      if q.previous->>'result' <> r.result::text then
        raise exception 'La medición cambió desde la solicitud';
      end if;
      update indicator_reports
      set result = (q.proposed->>'result')::numeric,
          measurement_target = coalesce(r.measurement_target, (q.proposed->>'measurement_target')::numeric),
          measurement_comparator = coalesce(r.measurement_comparator, q.proposed->>'measurement_comparator'),
          updated_at = now()
      where id = r.id;
    elsif q.kind = 'delete_report' then
      delete from indicator_reports where id = q.report_id;
    else
      if q.previous <> jsonb_build_object('name', i.name) then
        raise exception 'El nombre cambió desde la solicitud';
      end if;
      update indicators
      set name = q.proposed->>'name',
          updated_at = now()
      where id = i.id;
    end if;
  end if;

  update indicator_change_requests as request
  set status = case when approve then 'Aprobado' else 'Rechazado' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_comment = nullif(trim(review_indicator_change.review_comment), '')
  where request.id = q.id;
end;
$$;

revoke all on function public.review_indicator_change(bigint, boolean, text) from public;
grant execute on function public.review_indicator_change(bigint, boolean, text) to authenticated;

commit;
