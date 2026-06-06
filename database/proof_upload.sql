-- =============================================================================
-- Provd — proof upload pipeline
--
-- Adds:
--   1. 'awaiting_votes' status to public.dares (post-submission state)
--   2. proof-submissions storage bucket + access policies
--   3. submit_proof(p_dare_id, p_media_url, p_media_type) RPC
--
-- Apply after database/proof_submissions.sql.
--   psql "$SUPABASE_DB_URL" -f database/proof_upload.sql
-- =============================================================================

-- ---------- dares.status: add 'awaiting_votes' -------------------------------

alter table public.dares drop constraint if exists dares_status_check;
alter table public.dares
  add constraint dares_status_check
    check (status in (
      'pending','active','completed','missed','expired',
      'rejected','swapped','awaiting_votes'
    ));

-- ---------- storage bucket ---------------------------------------------------

insert into storage.buckets (id, name, public)
values ('proof-submissions', 'proof-submissions', true)
on conflict (id) do nothing;

-- Authenticated users can upload to the bucket. Tighter path-prefix checks
-- (e.g. only the dare's recipient can write to {dare_id}/) can be layered
-- on later — for now the submit_proof RPC enforces ownership at write-time.
drop policy if exists "proof_submissions_storage_insert" on storage.objects;
create policy "proof_submissions_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proof-submissions');

-- Anyone can read uploaded proof. Bucket is public so voters can view media
-- via the public URL stored on the proof_submissions row.
drop policy if exists "proof_submissions_storage_read" on storage.objects;
create policy "proof_submissions_storage_read"
  on storage.objects for select
  to public
  using (bucket_id = 'proof-submissions');

-- ---------- submit_proof RPC -------------------------------------------------
-- Atomically inserts the proof_submissions row and flips the dare to
-- 'awaiting_votes'. Verifies the caller is the dare's target_user_id and
-- that the dare is in a state that can accept proof.

create or replace function public.submit_proof(
  p_dare_id    uuid,
  p_media_url  text,
  p_media_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_dare          public.dares%rowtype;
  v_submission_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_media_type not in ('photo', 'video') then
    raise exception 'invalid_media_type';
  end if;
  if p_media_url is null or length(p_media_url) = 0 then
    raise exception 'invalid_media_url';
  end if;

  select * into v_dare from public.dares where id = p_dare_id for update;
  if not found then raise exception 'dare_not_found'; end if;
  if v_dare.target_user_id is distinct from v_uid then
    raise exception 'not_recipient';
  end if;
  if v_dare.status not in ('pending','active') then
    raise exception 'dare_not_open';
  end if;

  insert into public.proof_submissions (
    dare_id, submitted_by, media_url, media_type
  ) values (
    p_dare_id, v_uid, p_media_url, p_media_type
  )
  returning id into v_submission_id;

  update public.dares set status = 'awaiting_votes' where id = p_dare_id;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'dare_id',       p_dare_id,
    'status',        'awaiting_votes'
  );
end;
$$;

grant execute on function public.submit_proof(uuid, text, text) to authenticated;
