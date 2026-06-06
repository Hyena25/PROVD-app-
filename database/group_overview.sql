-- =============================================================================
-- Provd — get_group_overview
--
-- Returns the group, its member list (sorted by monthly points desc), and
-- enough per-member data to render the member list + leaderboard.
--
-- Caller must be a member of the group; otherwise raises 'not_a_member'.
-- Apply after database/schema.sql.
--   psql "$SUPABASE_DB_URL" -f database/group_overview.sql
-- =============================================================================

create or replace function public.get_group_overview(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_group     public.friend_groups%rowtype;
  v_is_member boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_group from public.friend_groups where id = p_group_id;
  if not found then
    raise exception 'group_not_found';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = v_uid
  ) into v_is_member;

  if not v_is_member then
    raise exception 'not_a_member';
  end if;

  return jsonb_build_object(
    'id', v_group.id,
    'name', v_group.name,
    'created_by', v_group.created_by,
    'invite_code', v_group.invite_code,
    'members', (
      -- TODO: replace u.total_points with a per-month aggregation once
      -- monthly point tallies are tracked. The screen consumes this field
      -- as `monthly_points`, so swapping the source here propagates.
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'user_id',        u.id,
          'username',       u.username,
          'display_name',   u.display_name,
          'avatar_url',     u.avatar_url,
          'current_streak', u.current_streak,
          'monthly_points', u.total_points,
          'joined_at',      gm.joined_at
        )
        order by u.total_points desc, u.username asc
      ), '[]'::jsonb)
      from public.group_members gm
      join public.users u on u.id = gm.user_id
      where gm.group_id = p_group_id
    )
  );
end;
$$;

grant execute on function public.get_group_overview(uuid) to authenticated;
