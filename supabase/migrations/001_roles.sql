-- BIOMET: asignación de roles por correo corporativo.
-- Ejecutar este archivo una vez desde Supabase > SQL Editor.

create table if not exists public.role_assignments (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('gerente_responsable', 'gcg', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('gerente_responsable', 'gcg', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.role_assignments enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Users can read their assigned role" on public.role_assignments;
create policy "Users can read their assigned role"
  on public.role_assignments for select to authenticated
  using (lower(auth.jwt() ->> 'email') = email);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role text;
begin
  select role into assigned_role
  from public.role_assignments
  where email = lower(new.email);

  if assigned_role is null then
    raise exception 'El correo % no tiene un rol asignado en BIOMET', new.email;
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email), assigned_role)
  on conflict (id) do update set email = excluded.email, role = excluded.role, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.role_assignments (email, role) values
  ('jcardenas@biomont.com.pe', 'gcg'),
  ('molin@biomont.com.pe', 'gerente_responsable'),
  ('fleonv@biomont.com.pe', 'gcg'),
  ('curbina@biomont.com.pe', 'gcg'),
  ('sig@biomont.com.pe', 'super_admin')
on conflict (email) do update set role = excluded.role, updated_at = now();
