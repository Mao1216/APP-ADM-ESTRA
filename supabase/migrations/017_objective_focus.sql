-- BIOMET: foco estratégico del objetivo.
alter table public.objectives add column if not exists focus text;
alter table public.objectives drop constraint if exists objectives_focus_check;
alter table public.objectives add constraint objectives_focus_check
  check (focus is null or focus in ('Financiero', 'Cliente', 'Procesos', 'Personas/Aprendizaje'));
