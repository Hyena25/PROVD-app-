-- =============================================================================
-- Provd database schema
--
-- Apply via the Supabase SQL editor, or:
--   psql "$SUPABASE_DB_URL" -f database/schema.sql
-- =============================================================================

create extension if not exists "uuid-ossp";

-- =============================================================================
-- Tables
-- =============================================================================

create table if not exists public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  username                text unique not null,
  display_name            text,
  avatar_url              text,
  total_points            integer not null default 0,
  current_streak          integer not null default 0,
  weekly_swaps_remaining  integer not null default 1,
  arena_verified          boolean not null default false,
  warning_count           integer not null default 0,
  created_at              timestamptz not null default now()
);

create table if not exists public.friend_groups (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  id         uuid primary key default uuid_generate_v4(),
  group_id   uuid not null references public.friend_groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

-- =============================================================================
-- Row-Level Security
--
-- Policy: a user can only read or write rows that belong to them.
--   - users:         row.id           = auth.uid()
--   - friend_groups: row.created_by   = auth.uid()
--   - group_members: row.user_id      = auth.uid()
-- =============================================================================

alter table public.users         enable row level security;
alter table public.friend_groups enable row level security;
alter table public.group_members enable row level security;

-- ---------- users ------------------------------------------------------------

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users_delete_own"
  on public.users for delete
  using (auth.uid() = id);

-- ---------- friend_groups ----------------------------------------------------

create policy "friend_groups_select_own"
  on public.friend_groups for select
  using (auth.uid() = created_by);

create policy "friend_groups_insert_own"
  on public.friend_groups for insert
  with check (auth.uid() = created_by);

create policy "friend_groups_update_own"
  on public.friend_groups for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "friend_groups_delete_own"
  on public.friend_groups for delete
  using (auth.uid() = created_by);

-- ---------- group_members ----------------------------------------------------

create policy "group_members_select_own"
  on public.group_members for select
  using (auth.uid() = user_id);

create policy "group_members_insert_own"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "group_members_update_own"
  on public.group_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "group_members_delete_own"
  on public.group_members for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- RPCs
-- =============================================================================

-- Lets the signup screen pre-check username availability without exposing the
-- users table to anonymous SELECTs. SECURITY DEFINER bypasses RLS; the function
-- returns only a boolean, so no row data leaks.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.users where username = p_username
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- =============================================================================
-- Dares
-- =============================================================================

create table if not exists public.dares (
  id                 uuid primary key default uuid_generate_v4(),
  created_by         uuid not null references public.users(id) on delete cascade,
  target_user_id     uuid references public.users(id) on delete cascade,
  group_id           uuid references public.friend_groups(id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  description        text,
  category           text not null check (category in ('fitness','food','social','creative','mental','wildcard')),
  difficulty         text not null check (difficulty in ('easy','medium','hard','insane')),
  points_value       integer not null check (points_value in (10,25,50,100)),
  time_window_hours  integer not null check (time_window_hours in (6,12,18,24)),
  status             text not null default 'pending' check (status in ('pending','active','completed','missed','expired','rejected')),
  is_arena           boolean not null default false,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz
);

-- BEFORE INSERT trigger: server-authoritative points and time window derived
-- from difficulty (CLAUDE.md: "Points are always calculated server-side, never
-- client-side"). Whatever the client sends for points_value or
-- time_window_hours is overwritten here so the difficulty tier is the only
-- knob that drives point totals.
create or replace function public.dares_apply_difficulty_defaults()
returns trigger
language plpgsql
as $$
begin
  case new.difficulty
    when 'easy'   then new.points_value := 10;  new.time_window_hours := 24;
    when 'medium' then new.points_value := 25;  new.time_window_hours := 18;
    when 'hard'   then new.points_value := 50;  new.time_window_hours := 12;
    when 'insane' then new.points_value := 100; new.time_window_hours := 6;
  end case;

  if new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now())
                      + (new.time_window_hours || ' hours')::interval;
  end if;

  return new;
end;
$$;

drop trigger if exists dares_set_difficulty_defaults on public.dares;
create trigger dares_set_difficulty_defaults
  before insert on public.dares
  for each row execute function public.dares_apply_difficulty_defaults();

-- RLS: a user sees the dares they sent and the dares targeted at them.
-- Group-wide visibility (so any member can see any dare in the group) can be
-- layered on later via a SECURITY DEFINER view or extra policy.
alter table public.dares enable row level security;

create policy "dares_select_own_or_target"
  on public.dares for select
  using (auth.uid() = created_by or auth.uid() = target_user_id);

create policy "dares_insert_own"
  on public.dares for insert
  with check (auth.uid() = created_by);

-- =============================================================================
-- Dare Library
-- =============================================================================

create table if not exists public.dare_library (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null check (char_length(title) between 1 and 200),
  description           text,
  category              text not null check (category in ('fitness','food','social','creative','mental','wildcard')),
  suggested_difficulty  text check (suggested_difficulty in ('easy','medium','hard','insane')),
  use_count             integer not null default 0,
  created_at            timestamptz not null default now()
);

-- RLS: any signed-in user can read the library; writes are admin-only
-- (no INSERT/UPDATE/DELETE policies => only the service role can write).
alter table public.dare_library enable row level security;

drop policy if exists "dare_library_select_all" on public.dare_library;
create policy "dare_library_select_all"
  on public.dare_library for select
  to authenticated
  using (true);

-- Seed: 5 dares per category × 6 categories = 30. Idempotent — only inserts
-- if the library is empty so re-running this file won't duplicate rows.
do $$
begin
  if not exists (select 1 from public.dare_library limit 1) then
    insert into public.dare_library (title, description, category, suggested_difficulty) values
      -- fitness
      ('Run a mile in under 8 minutes', 'Track your time and post a screenshot of your run.', 'fitness', 'medium'),
      ('Hold a plank for 3 minutes straight', 'Set a timer and capture the whole stretch on video.', 'fitness', 'hard'),
      ('Do 50 push-ups without stopping', 'Form counts. No knee push-ups.', 'fitness', 'medium'),
      ('Take a sunrise hike — be at the trailhead before 7 AM', 'Photo proof of the sunrise from the trail.', 'fitness', 'easy'),
      ('Bike or skate somewhere you''d normally drive', 'Show the route on a maps app.', 'fitness', 'easy'),
      -- food
      ('Eat a meal from a cuisine you''ve never tried', 'Bonus points if you can''t pronounce it.', 'food', 'easy'),
      ('Cook a dish using only ingredients that start with the same letter', 'Send a photo of the plated result.', 'food', 'hard'),
      ('Order the spiciest thing on a menu and finish it', 'Capture the moment of regret.', 'food', 'hard'),
      ('Eat an entire meal with chopsticks — even soup', 'Record a clip of you struggling with the soup.', 'food', 'medium'),
      ('Try the weirdest item in your local corner store', 'Show the wrapper and your face after the first bite.', 'food', 'easy'),
      -- social
      ('Give 5 strangers a sincere compliment in 24 hours', 'Note where you were and what you said.', 'social', 'easy'),
      ('Strike up a 10-minute conversation with the person next to you on transit', 'Screenshot if you exchange numbers.', 'social', 'medium'),
      ('Reconnect with a friend you haven''t spoken to in over a year', 'Screenshot of the conversation, redacted as needed.', 'social', 'easy'),
      ('Ask out someone you''ve been too shy to talk to', 'We just want to know how it went.', 'social', 'hard'),
      ('Sing happy birthday loudly to a stranger at a restaurant', 'Capture the audio. Bonus if the staff joins in.', 'social', 'hard'),
      -- creative
      ('Write and recite a haiku about your day to someone', 'Three lines, 5/7/5. Record the recital.', 'creative', 'easy'),
      ('Draw a self-portrait without lifting your pen', 'Single continuous line. No erasing.', 'creative', 'easy'),
      ('Compose a 30-second jingle about your favorite snack', 'Hum it, sing it, GarageBand it — your call.', 'creative', 'medium'),
      ('Photograph 10 things in your day that are the same color', 'Pick the color and share the gallery.', 'creative', 'easy'),
      ('Build a tiny sculpture from items only in your junk drawer', 'One photo from three angles.', 'creative', 'medium'),
      -- mental
      ('Meditate for 20 minutes without your phone in the room', 'Log the start and end times.', 'mental', 'easy'),
      ('Memorize a poem of at least 8 lines and recite it to a friend', 'Record the recital from memory.', 'mental', 'medium'),
      ('Solve a Rubik''s cube in under 5 minutes', 'Time-lapse video required.', 'mental', 'hard'),
      ('Spend a full morning in silence — no talking, no texting', 'Note the start time and how it went after.', 'mental', 'medium'),
      ('Read a 300+ page book in a single day', 'Photo of the cover at start and a one-paragraph summary at the end.', 'mental', 'insane'),
      -- wildcard
      ('Wear a full Halloween costume in public for an afternoon', 'At least 3 hours and one outdoor location.', 'wildcard', 'hard'),
      ('Spend a full day saying yes to every reasonable request', 'Log the most surprising yes.', 'wildcard', 'medium'),
      ('Walk a route home you''ve never taken before', 'Share the maps screenshot of the path.', 'wildcard', 'easy'),
      ('Sing one full song at karaoke in front of strangers', 'Audio or video, with their reactions if possible.', 'wildcard', 'hard'),
      ('Live one day as if you were eight years old again', 'Pick the snacks, the activities, the bedtime.', 'wildcard', 'medium');
  end if;
end $$;
