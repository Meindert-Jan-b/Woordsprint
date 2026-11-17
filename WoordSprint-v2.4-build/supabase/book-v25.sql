-- Run once in Supabase SQL Editor. Existing tables/accounts are untouched.
create table if not exists public.woordsprint_private_books (
  user_id text primary key,
  payload jsonb not null
);
alter table public.woordsprint_private_books enable row level security;
revoke all on public.woordsprint_private_books from anon, authenticated;
grant select, insert, update on public.woordsprint_private_books to service_role;
-- No public RLS policies. Only the server reads the book table; v2.6 uses a reserved shared catalog key.
