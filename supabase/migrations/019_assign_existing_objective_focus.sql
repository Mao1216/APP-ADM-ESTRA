-- Asignación inicial de focos para los objetivos existentes.
-- Los objetivos de prueba se clasifican provisionalmente como Procesos.
update public.objectives
set focus = case code
  when 'OBJ-26005' then 'Financiero'
  when 'OBJ-26001' then 'Procesos'
  when 'OBJ-26002' then 'Procesos'
  when 'OBJ-26003' then 'Procesos'
  when 'OBJ-26004' then 'Procesos'
  when 'OBJ-26006' then 'Procesos'
  when 'OBJ-26007' then 'Procesos'
  else focus
end,
updated_at = now()
where code in ('OBJ-26001', 'OBJ-26002', 'OBJ-26003', 'OBJ-26004', 'OBJ-26005', 'OBJ-26006', 'OBJ-26007');
