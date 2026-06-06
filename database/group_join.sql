-- =============================================================================
-- Provd — group lookup + join RPCs
--
-- Enables the join-group screen to:
--   1. Look up a group by invite code (with member count and own-membership flag)
--   2. Atomically join the group, enforcing the 15-member cap and dedup
--
-- Apply after database/schema.sql and database/friend_groups_invite_code.sql.
--   psql "$SUPABASE_DB_URL" -f database/group_join.sql
-- =============================================================================

-- ---------- lookup_group_by_invite_code --------------------------------------
-- Returns 0 or 1 row. SECURITY DEFINER bypasses the strict RLS on friend_groups
-- and group_members, but only exposes id/name/member_count/is_member — no row
-- data leaks beyond what's appropriate for an invite-code preview.

create or replace function public.lookup_group_by_invite_code(p_code text)
returns table (
  id            uuid,
  name          text,
  member_count  integer,
  is_member     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members gm where gm.group_id = g.id) as member_count,
    exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = auth.uid()
    ) as is_member
  from public.friend_groups g
  where g.invite_code = upper(p_code)
  limit 1;
$$;

grant execute on function public.lookup_group_by_invite_code(text) to authenticated;

-- ---------- join_group_by_invite_code ----------------------------------------
-- Atomically:
--   - resolves the group by invite code
--   - rejects if the user is already a member          (raise 'already_member')
--   - rejects if the group has 15 or more members      (raise 'group_full')
--   - rejects if the code matches no group             (raise 'group_not_found')
--   - inserts the group_members row
-- Returns the joined group's id and name on success.

create or replace function public.join_group_by_invite_code(p_code text)
returns table (
  id   uuid,
  name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.friend_groups%rowtype;
  v_count integer;
  v_uid   uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_group
  from public.friend_groups
  where invite_code = upper(p_code)
  limit 1;

  if not found then
    raise exception 'group_not_found';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = v_group.id and user_id = v_uid
  ) then
    raise exception 'already_member';
  end if;

  select count(*)::int into v_count
  from public.group_members
  where group_id = v_group.id;

  if v_count >= 15 then
    raise exception 'group_full';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group.id, v_uid);

  return query select v_group.id, v_group.name;
end;
$$;

grant execute on function public.join_group_by_invite_code(text) to authenticated;
