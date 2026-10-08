-- Subscriber list for Vision REAL (only needed if you use Supabase instead of Buttondown).
-- Run once in the Supabase SQL editor. Only the server (secret key) can read or write; the public anon key cannot.
create table if not exists public.subscribers (
  email       text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source      text,
  created_at  timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table public.subscribers enable row level security;
-- No policies on purpose: with RLS on and no policy, anon and authenticated roles see nothing.
-- The service-role (secret) key used by api/subscribe.ts bypasses RLS.
