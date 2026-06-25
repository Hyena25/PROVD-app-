-- =============================================================================
-- Provd — Arena age verification
--
-- Apply after database/schema.sql.
--   psql "$SUPABASE_DB_URL" -f database/arena_verify.sql
-- =============================================================================

alter table public.users
  add column if not exists date_of_birth date;

-- Age verification RPC. SECURITY DEFINER because the gate must be enforced
-- server-side: the client only sees a boolean and cannot flip arena_verified
-- on its own. CLAUDE.md: "Arena mode requires age verification flag on user
-- profile."
create or replace function public.verify_age(p_dob date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_age integer;
begin
  if p_dob is null or p_dob > current_date then
    return false;
  end if;

  v_age := extract(year from age(current_date, p_dob))::int;

  if v_age < 18 then
    return false;
  end if;

  update public.users
     set arena_verified = true,
         date_of_birth  = p_dob
   where id = auth.uid();

  return true;
end;
$$;

grant execute on function public.verify_age(date) to authenticated;
