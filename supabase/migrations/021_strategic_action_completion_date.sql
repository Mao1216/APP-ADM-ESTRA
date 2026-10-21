alter table public.strategic_actions
  add column if not exists completed_at timestamptz;
