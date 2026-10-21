-- Reclasificación solicitada para los objetivos de prueba.
update public.objectives
set focus = 'Personas/Aprendizaje',
    updated_at = now()
where code in ('OBJ-26002', 'OBJ-26003', 'OBJ-26004');
