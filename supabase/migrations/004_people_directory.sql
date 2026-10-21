-- Directorio provisional para asignar responsables e interesados.
create table if not exists public.organization_people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  email text unique,
  role text not null check (role in ('gerente_responsable', 'gcg', 'super_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_people enable row level security;
drop policy if exists "Authenticated users can read organization people" on public.organization_people;
create policy "Authenticated users can read organization people"
  on public.organization_people for select to authenticated using (true);

insert into public.organization_people (full_name, role) values
  ('Claudia Urbina', 'gerente_responsable'),
  ('Fabrizio Leon', 'gerente_responsable'),
  ('Erika Tucuman', 'gerente_responsable'),
  ('Hernan', 'gerente_responsable'),
  ('Jhon Cardenas', 'gerente_responsable'),
  ('Alexandra Durand', 'gerente_responsable'),
  ('Nicolas Luque', 'gerente_responsable'),
  ('Felipe Villantoy', 'gerente_responsable')
on conflict (full_name) do update set role = excluded.role, active = true, updated_at = now();
