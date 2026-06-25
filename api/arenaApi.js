import { supabase } from '../lib/supabase';

export async function verifyAge(dob) {
  const { data, error } = await supabase.rpc('verify_age', { p_dob: dob });
  if (error) throw error;
  return data === true;
}

// Open dares from strangers, available to claim. Arena is gated behind
// arena_verified (CLAUDE.md: "Arena mode requires age verification flag").
export async function listArenaDares() {
  const { data, error } = await supabase.rpc('list_arena_dares');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function acceptArenaDare(dareId) {
  const { data, error } = await supabase.rpc('accept_arena_dare', {
    p_dare_id: dareId,
  });
  if (error) throw error;
  return data;
}
