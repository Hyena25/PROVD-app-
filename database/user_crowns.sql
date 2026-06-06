-- =============================================================================
-- Provd — user_crowns
--
-- Apply after database/schema.sql.
--   psql "$SUPABASE_DB_URL" -f database/user_crowns.sql
-- =============================================================================

create table if not exists public.user_crowns (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  label         text not null,
  period_start  date,
  period_end    date,
  awarded_at    timestamptz not null default now(),
  unique (user_id, period_start)
);

-- RLS: users can read their own crowns. Awarding is done server-side via the
-- service role, which bypasses RLS, so no INSERT/UPDATE/DELETE policy is needed.
alter table public.user_crowns enable row level security;

create policy "user_crowns_select_own"
  on public.user_crowns for select
  using (auth.uid() = user_id);
