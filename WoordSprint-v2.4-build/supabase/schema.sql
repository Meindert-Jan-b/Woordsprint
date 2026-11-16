-- Run this ONCE in Supabase > SQL Editor.
-- Only the backend (service_role / secret key) may access this row.
create table if not exists public.woordsprint_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.woordsprint_state enable row level security;
revoke all on public.woordsprint_state from anon, authenticated;
grant select, insert, update on public.woordsprint_state to service_role;
-- No RLS policies intentionally: service_role bypasses RLS; public clients get nothing.

create or replace function public.woordsprint_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_woordsprint_updated_at on public.woordsprint_state;
create trigger trg_woordsprint_updated_at
before update on public.woordsprint_state
for each row execute function public.woordsprint_updated_at();
