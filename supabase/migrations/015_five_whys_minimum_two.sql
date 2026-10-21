begin;
create or replace function public.save_five_whys(measurement bigint,answers jsonb) returns bigint language plpgsql security definer set search_path=public as $$
declare r indicator_reports; c cause_analyses; result_id bigint; answer_count integer; root_cause text;
begin
 select * into strict r from indicator_reports where id=measurement for update;
 if auth.uid() is null or not can_manage_reporting(r.indicator_id) or (is_gcg() and not is_super_admin()) then raise exception 'Solo el gerente responsable puede registrar los porqués'; end if;
 if r.status<>'Fuera de meta' then raise exception 'Los porqués requieren una medición fuera de meta'; end if;
 if jsonb_typeof(answers) is distinct from 'array' then raise exception 'Las respuestas no son válidas'; end if;
 answer_count:=jsonb_array_length(answers);
 if answer_count<2 or answer_count>5 or exists(select 1 from jsonb_array_elements(answers) answer where jsonb_typeof(answer)<>'string' or length(trim(answer #>> '{}'))=0) then raise exception 'Completa entre dos y cinco porqués'; end if;
 root_cause:=trim(answers->>(answer_count-1));
 select * into c from cause_analyses where report_id=r.id for update;
 if found then
  if not can_edit_analysis(c.id) then raise exception 'No puedes editar este análisis'; end if;
  update cause_analyses set five_whys=answers,cause=root_cause,updated_at=now() where id=c.id returning id into result_id;
 else
  insert into cause_analyses(report_id,cause,deviation_description,complementary_data,five_whys,created_by) values(r.id,root_cause,coalesce(nullif(trim(r.observations),''),'El resultado del periodo '||r.period||' se encuentra fuera de meta.'),'',answers,auth.uid()) returning id into result_id;
 end if;
 insert into corrective_events(analysis_id,event,note,actor) values(result_id,'Porqués guardados',root_cause,auth.uid());
 return result_id;
end $$;
notify pgrst,'reload schema';
commit;
