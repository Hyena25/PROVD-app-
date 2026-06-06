-- =============================================================================
-- Provd — get_my_groups
--
-- Lists every group the calling user is a member of, with member count.
-- Needed because friend_groups RLS only lets creators read their own row, so
-- members of groups they didn't create can't query friend_groups directly.
--
-- Apply after database/schema.sql and database/group_join.sql.
--   psql "$SUPABASE_DB_URL" -f database/my_groups.sql
-- =============================================================================

create or replace function public.get_my_groups()
returns table (
  id            uuid,
  name          text,
  member_count  integer,
  joined_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members gm2 where gm2.group_id = g.id) as member_count,
    gm.joined_at
  from public.group_members gm
  join public.friend_groups g on g.id = gm.group_id
  where gm.user_id = auth.uid()
  order by gm.joined_at desc;
$$;

grant execute on function public.get_my_groups() to authenticated;
