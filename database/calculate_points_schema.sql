-- =============================================================================
-- Provd — calculate-points schema support
--
-- Adds the schema the calculate-points Edge Function reads and writes:
--   1. group_members.monthly_points column (per-month tally per (group, user))
--   2. double_points_card_uses table — one row per (user, month); a row with
--      used_at IS NULL means the card is active but unused for that month.
--
-- Apply after database/dare_votes.sql.
--   psql "$SUPABASE_DB_URL" -f database/calculate_points_schema.sql
-- =============================================================================

alter table public.group_members
  add column if not exists monthly_points integer not null default 0;

create table if not exists public.double_points_card_uses (
  user_id      uuid not null references public.users(id) on delete cascade,
  month        date not null,
  activated_at timestamptz not null default now(),
  used_at      timestamptz,
  primary key (user_id, month)
);

alter table public.double_points_card_uses enable row level security;

drop policy if exists "double_points_select_own" on public.double_points_card_uses;
create policy "double_points_select_own"
  on public.double_points_card_uses for select
  using (auth.uid() = user_id);

drop policy if exists "double_points_insert_own" on public.double_points_card_uses;
create policy "double_points_insert_own"
  on public.double_points_card_uses for insert
  with check (auth.uid() = user_id);

-- No UPDATE policy: only the server (via service role) marks a card used.
