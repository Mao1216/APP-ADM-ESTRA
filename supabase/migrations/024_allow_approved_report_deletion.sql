-- Una solicitud aprobada de eliminación conserva su historial sin impedir
-- eliminar la medición a la que estaba vinculada.
begin;

alter table public.indicator_change_requests
  drop constraint if exists indicator_change_requests_report_check;

alter table public.indicator_change_requests
  add constraint indicator_change_requests_report_check
  check (
    (kind not in ('report', 'delete_report') and report_id is null)
    or (kind in ('report', 'delete_report') and report_id is not null)
    or (kind in ('report', 'delete_report') and status in ('Aprobado', 'Rechazado') and report_id is null)
  );

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
      -- Se desvincula primero el historial para liberar la llave foránea.
      -- Las otras solicitudes pendientes para esta medición se cierran porque
      -- ya no tendrían un reporte válido al cual aplicar su cambio.
      update indicator_change_requests as request
      set report_id = null,
          status = case
            when request.id = q.id then 'Aprobado'
            when request.status = 'Pendiente' then 'Rechazado'
            else request.status
          end,
          reviewed_by = case when request.status = 'Pendiente' then auth.uid() else request.reviewed_by end,
          reviewed_at = case when request.status = 'Pendiente' then now() else request.reviewed_at end,
          review_comment = case
            when request.id = q.id then nullif(trim(review_indicator_change.review_comment), '')
            when request.status = 'Pendiente' then coalesce(request.review_comment, 'Solicitud cerrada porque se aprobó eliminar su medición asociada.')
            else request.review_comment
          end
      where request.report_id = q.report_id;

      delete from indicator_reports where id = q.report_id;
      return;
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
