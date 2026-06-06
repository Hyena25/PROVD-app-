-- =============================================================================
-- Provd — proof_submissions + dare-recipient flow
--
-- Adds:
--   1. 'swapped' status to public.dares (so weekly-swap has a landing state)
--   2. public.proof_submissions table + RLS
--   3. RPCs that power the recipient screen:
--        - get_dare_for_recipient(p_dare_id)
--        - accept_dare(p_dare_id)
--        - use_weekly_swap(p_dare_id)
--
-- Apply after database/schema.sql.
--   psql "$SUPABASE_DB_URL" -f database/proof_submissions.sql
-- =============================================================================

-- ---------- dares.status: add 'swapped' --------------------------------------

alter table public.dares drop constraint if exists dares_status_check;
alter table public.dares
  add constraint dares_status_check
    check (status in ('pending','active','completed','missed','expired','rejected','swapped'));

-- ---------- proof_submissions ------------------------------------------------

create table if not exists public.proof_submissions (
  id            uuid primary key default uuid_generate_v4(),
  dare_id       uuid not null references public.dares(id) on delete cascade,
  submitted_by  uuid not null references public.users(id) on delete cascade,
  media_url     text not null,
  media_type    text not null check (media_type in ('photo','video')),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at  timestamptz not null default now()
);

alter table public.proof_submissions enable row level security;

drop policy if exists "proof_submissions_select_own" on public.proof_submissions;
create policy "proof_submissions_select_own"
  on public.proof_submissions for select
  using (auth.uid() = submitted_by);

drop policy if exists "proof_submissions_insert_own" on public.proof_submissions;
create policy "proof_submissions_insert_own"
  on public.proof_submissions for insert
  with check (auth.uid() = submitted_by);

-- =============================================================================
-- RPCs for the recipient screen
-- =============================================================================

-- ---------- get_dare_for_recipient -------------------------------------------
-- Verifies the caller is the dare's target_user_id and returns dare details
-- plus minimal sender info and the caller's current weekly_swaps_remaining.

create or replace function public.get_dare_for_recipient(p_dare_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_dare   public.dares%rowtype;
  v_sender public.users%rowtype;
  v_swaps  integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_dare from public.dares where id = p_dare_id;
  if not found then
    raise exception 'dare_not_found';
  end if;

  if v_dare.target_user_id is distinct from v_uid then
    raise exception 'not_recipient';
  end if;

  select * into v_sender from public.users where id = v_dare.created_by;
  select weekly_swaps_remaining into v_swaps from public.users where id = v_uid;

  return jsonb_build_object(
    'id',                v_dare.id,
    'title',             v_dare.title,
    'description',       v_dare.description,
    'category',          v_dare.category,
    'difficulty',        v_dare.difficulty,
    'points_value',      v_dare.points_value,
    'time_window_hours', v_dare.time_window_hours,
    'status',            v_dare.status,
    'is_arena',          v_dare.is_arena,
    'created_at',        v_dare.created_at,
    'expires_at',        v_dare.expires_at,
    'sender', jsonb_build_object(
      'id',           v_sender.id,
      'username',     v_sender.username,
      'display_name', v_sender.display_name
    ),
    'viewer_swaps_remaining', coalesce(v_swaps, 0)
  );
end;
$$;

grant execute on function public.get_dare_for_recipient(uuid) to authenticated;

-- ---------- accept_dare ------------------------------------------------------
-- Transitions a 'pending' dare to 'active' for the recipient.

create or replace function public.accept_dare(p_dare_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_dare public.dares%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_dare from public.dares where id = p_dare_id for update;
  if not found then raise exception 'dare_not_found'; end if;
  if v_dare.target_user_id is distinct from v_uid then raise exception 'not_recipient'; end if;
  if v_dare.status <> 'pending' then raise exception 'dare_not_pending'; end if;

  update public.dares set status = 'active' where id = p_dare_id;

  return jsonb_build_object('id', p_dare_id, 'status', 'active');
end;
$$;

grant execute on function public.accept_dare(uuid) to authenticated;

-- ---------- use_weekly_swap --------------------------------------------------
-- Atomically: marks the dare 'swapped' and decrements the recipient's
-- weekly_swaps_remaining. Both rows are locked for the duration of the txn.

create or replace function public.use_weekly_swap(p_dare_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_dare  public.dares%rowtype;
  v_swaps integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_dare from public.dares where id = p_dare_id for update;
  if not found then raise exception 'dare_not_found'; end if;
  if v_dare.target_user_id is distinct from v_uid then raise exception 'not_recipient'; end if;
  if v_dare.status <> 'pending' then raise exception 'dare_not_pending'; end if;

  select weekly_swaps_remaining into v_swaps from public.users where id = v_uid for update;
  if coalesce(v_swaps, 0) <= 0 then
    raise exception 'no_swaps_remaining';
  end if;

  update public.users
    set weekly_swaps_remaining = weekly_swaps_remaining - 1
    where id = v_uid;

  update public.dares set status = 'swapped' where id = p_dare_id;

  return jsonb_build_object(
    'id',              p_dare_id,
    'status',          'swapped',
    'swaps_remaining', v_swaps - 1
  );
end;
$$;

grant execute on function public.use_weekly_swap(uuid) to authenticated;
