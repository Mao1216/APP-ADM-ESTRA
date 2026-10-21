-- Mensajes personalizados que GCG puede mostrar a una persona en su monitor.
begin;

create table if not exists public.dashboard_messages (
  recipient_email text primary key,
  message text not null check (length(trim(message)) between 1 and 600),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_messages enable row level security;

drop policy if exists "Recipients and GCG read dashboard messages" on public.dashboard_messages;
create policy "Recipients and GCG read dashboard messages"
  on public.dashboard_messages
  for select
  to authenticated
  using (
    lower(recipient_email) = lower(auth.jwt() ->> 'email')
    or is_gcg()
  );

drop policy if exists "GCG manages dashboard messages" on public.dashboard_messages;
create policy "GCG manages dashboard messages"
  on public.dashboard_messages
  for all
  to authenticated
  using (is_gcg())
  with check (is_gcg());

notify pgrst, 'reload schema';
commit;
