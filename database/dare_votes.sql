-- =============================================================================
-- Provd — dare voting + resolution
--
-- Adds:
--   1. public.dare_votes table + RLS
--   2. resolve_submission(submission_id, resolution) — internal helper that
--      flips the proof_submissions/dares rows AND applies points + streak
--      changes server-side (CLAUDE.md: points are calculated server-side).
--   3. cast_vote(submission_id, vote) — inserts a vote, then auto-resolves if
--      simple majority of eligible voters has been reached.
--   4. get_submission_for_voter(submission_id) — fetch payload for the screen,
--      lazily finalising voting if the 1-hour window has expired.
--   5. list_pending_votes_for_user() — returns submissions awaiting the
--      current user's vote (for the home feed).
--
-- Apply after database/proof_upload.sql.
--   psql "$SUPABASE_DB_URL" -f database/dare_votes.sql
-- =============================================================================

create table if not exists public.dare_votes (
  id            uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.proof_submissions(id) on delete cascade,
  voter_id      uuid not null references public.users(id) on delete cascade,
  vote          text not null check (vote in ('approved','rejected')),
  voted_at      timestamptz not null default now(),
  unique (submission_id, voter_id)
);

alter table public.dare_votes enable row level security;

drop policy if exists "dare_votes_select_own" on public.dare_votes;
create policy "dare_votes_select_own"
  on public.dare_votes for select
  using (auth.uid() = voter_id);

drop policy if exists "dare_votes_insert_own" on public.dare_votes;
create policy "dare_votes_insert_own"
  on public.dare_votes for insert
  with check (auth.uid() = voter_id);

-- =============================================================================
-- resolve_submission — internal helper
-- =============================================================================
-- Flips the proof_submissions row to approved/rejected, the parent dare to
-- completed/missed, and applies points + streak changes to the recipient.
-- No-op if the submission is no longer pending. Idempotent under concurrent
-- callers thanks to FOR UPDATE locks.

create or replace function public.resolve_submission(
  p_submission_id uuid,
  p_resolution    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub  public.proof_submissions%rowtype;
  v_dare public.dares%rowtype;
begin
  if p_resolution not in ('approved','rejected') then return; end if;

  select * into v_sub from public.proof_submissions
    where id = p_submission_id for update;
  if not found or v_sub.status <> 'pending' then return; end if;

  select * into v_dare from public.dares
    where id = v_sub.dare_id for update;
  if not found then return; end if;

  update public.proof_submissions set status = p_resolution where id = p_submission_id;

  if p_resolution = 'approved' then
    update public.dares set status = 'completed' where id = v_sub.dare_id;
    update public.users
      set total_points   = total_points + v_dare.points_value,
          current_streak = current_streak + 1
      where id = v_sub.submitted_by;
  else
    update public.dares set status = 'missed' where id = v_sub.dare_id;
    update public.users
      set current_streak = 0
      where id = v_sub.submitted_by;
  end if;
end;
$$;

-- =============================================================================
-- cast_vote
-- =============================================================================

create or replace function public.cast_vote(
  p_submission_id uuid,
  p_vote          text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_sub             public.proof_submissions%rowtype;
  v_dare            public.dares%rowtype;
  v_voting_deadline timestamptz;
  v_approved        int;
  v_rejected        int;
  v_eligible_count  int;
  v_resolution      text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_vote not in ('approved','rejected') then raise exception 'invalid_vote'; end if;

  select * into v_sub from public.proof_submissions
    where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if v_sub.status <> 'pending' then raise exception 'voting_closed'; end if;

  v_voting_deadline := v_sub.submitted_at + interval '1 hour';
  if now() > v_voting_deadline then
    raise exception 'voting_expired';
  end if;

  select * into v_dare from public.dares where id = v_sub.dare_id;
  if not found then raise exception 'dare_not_found'; end if;

  if v_dare.created_by  = v_uid then raise exception 'sender_cannot_vote'; end if;
  if v_sub.submitted_by = v_uid then raise exception 'submitter_cannot_vote'; end if;

  if v_dare.group_id is null or not exists (
    select 1 from public.group_members
    where group_id = v_dare.group_id and user_id = v_uid
  ) then
    raise exception 'not_in_group';
  end if;

  begin
    insert into public.dare_votes (submission_id, voter_id, vote)
    values (p_submission_id, v_uid, p_vote);
  exception when unique_violation then
    raise exception 'already_voted';
  end;

  select
    count(*) filter (where vote = 'approved'),
    count(*) filter (where vote = 'rejected')
  into v_approved, v_rejected
  from public.dare_votes where submission_id = p_submission_id;

  -- Eligible voter pool = group members minus sender and submitter.
  select count(*) into v_eligible_count
  from public.group_members
  where group_id = v_dare.group_id
    and user_id <> v_dare.created_by
    and user_id <> v_sub.submitted_by;

  -- Simple majority of the eligible pool decides the outcome immediately.
  if v_approved * 2 > v_eligible_count then
    v_resolution := 'approved';
  elsif v_rejected * 2 > v_eligible_count then
    v_resolution := 'rejected';
  end if;

  if v_resolution is not null then
    perform public.resolve_submission(p_submission_id, v_resolution);
  end if;

  return jsonb_build_object(
    'submission_id', p_submission_id,
    'my_vote',       p_vote,
    'votes',         jsonb_build_object('approved', v_approved, 'rejected', v_rejected),
    'eligible',      v_eligible_count,
    'resolution',    v_resolution
  );
end;
$$;

grant execute on function public.cast_vote(uuid, text) to authenticated;

-- =============================================================================
-- get_submission_for_voter
-- =============================================================================
-- Lazily finalises an expired pending submission before returning data, so a
-- viewer who opens the screen after the 1-hour window sees the resolved state.

create or replace function public.get_submission_for_voter(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_sub             public.proof_submissions%rowtype;
  v_dare            public.dares%rowtype;
  v_submitter       public.users%rowtype;
  v_voting_deadline timestamptz;
  v_approved        int;
  v_rejected        int;
  v_my_vote         text;
  v_is_sender       boolean;
  v_is_submitter    boolean;
  v_in_group        boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_sub from public.proof_submissions where id = p_submission_id;
  if not found then raise exception 'submission_not_found'; end if;

  select * into v_dare from public.dares where id = v_sub.dare_id;
  if not found then raise exception 'dare_not_found'; end if;

  v_voting_deadline := v_sub.submitted_at + interval '1 hour';
  v_is_sender       := (v_dare.created_by  = v_uid);
  v_is_submitter    := (v_sub.submitted_by = v_uid);
  v_in_group        := (v_dare.group_id is not null and exists (
    select 1 from public.group_members
    where group_id = v_dare.group_id and user_id = v_uid
  ));

  if not v_is_sender and not v_is_submitter and not v_in_group then
    raise exception 'not_authorized_to_view';
  end if;

  -- Lazy auto-close if the 1-hour window has passed.
  if v_sub.status = 'pending' and now() > v_voting_deadline then
    select
      count(*) filter (where vote = 'approved'),
      count(*) filter (where vote = 'rejected')
    into v_approved, v_rejected
    from public.dare_votes where submission_id = p_submission_id;

    if coalesce(v_approved, 0) > coalesce(v_rejected, 0) then
      perform public.resolve_submission(p_submission_id, 'approved');
    else
      perform public.resolve_submission(p_submission_id, 'rejected');
    end if;

    -- Re-read after resolution.
    select * into v_sub from public.proof_submissions where id = p_submission_id;
  end if;

  select
    count(*) filter (where vote = 'approved'),
    count(*) filter (where vote = 'rejected')
  into v_approved, v_rejected
  from public.dare_votes where submission_id = p_submission_id;

  select vote into v_my_vote
  from public.dare_votes
  where submission_id = p_submission_id and voter_id = v_uid;

  select * into v_submitter from public.users where id = v_sub.submitted_by;

  return jsonb_build_object(
    'submission', jsonb_build_object(
      'id',           v_sub.id,
      'media_url',    v_sub.media_url,
      'media_type',   v_sub.media_type,
      'status',       v_sub.status,
      'submitted_at', v_sub.submitted_at
    ),
    'dare', jsonb_build_object(
      'id',           v_dare.id,
      'title',        v_dare.title,
      'description',  v_dare.description,
      'category',     v_dare.category,
      'difficulty',   v_dare.difficulty,
      'points_value', v_dare.points_value,
      'group_id',     v_dare.group_id
    ),
    'submitter', jsonb_build_object(
      'id',           v_submitter.id,
      'username',     v_submitter.username,
      'display_name', v_submitter.display_name
    ),
    'sender_id',       v_dare.created_by,
    'votes',           jsonb_build_object('approved', v_approved, 'rejected', v_rejected),
    'voting_deadline', v_voting_deadline,
    'viewer', jsonb_build_object(
      'is_sender',     v_is_sender,
      'is_submitter',  v_is_submitter,
      'has_voted',     v_my_vote is not null,
      'my_vote',       v_my_vote,
      'voting_closed', v_sub.status <> 'pending' or now() > v_voting_deadline
    )
  );
end;
$$;

grant execute on function public.get_submission_for_voter(uuid) to authenticated;

-- =============================================================================
-- list_pending_votes_for_user
-- =============================================================================

create or replace function public.list_pending_votes_for_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  return coalesce((
    select jsonb_agg(item order by item->>'submitted_at' desc)
    from (
      select jsonb_build_object(
        'submission_id',      ps.id,
        'dare_id',            d.id,
        'dare_title',         d.title,
        'media_type',         ps.media_type,
        'submitter_username', u.username,
        'submitted_at',       ps.submitted_at,
        'voting_deadline',    ps.submitted_at + interval '1 hour'
      ) as item
      from public.proof_submissions ps
      join public.dares          d  on d.id  = ps.dare_id
      join public.users          u  on u.id  = ps.submitted_by
      join public.group_members  gm on gm.group_id = d.group_id and gm.user_id = v_uid
      where ps.status = 'pending'
        and ps.submitted_at + interval '1 hour' > now()
        and d.created_by  <> v_uid
        and ps.submitted_by <> v_uid
        and not exists (
          select 1 from public.dare_votes
          where submission_id = ps.id and voter_id = v_uid
        )
    ) sub
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.list_pending_votes_for_user() to authenticated;
