-- =============================================================================
-- Provd — friend_groups.invite_code
--
-- Adds a unique 6-character invite code column to friend_groups.
-- Apply after database/schema.sql.
--   psql "$SUPABASE_DB_URL" -f database/friend_groups_invite_code.sql
-- =============================================================================

alter table public.friend_groups
  add column if not exists invite_code text unique;
