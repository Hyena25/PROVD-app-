import { supabase } from '../lib/supabase';

// Difficulty metadata used by the create-dare UI. The server is authoritative
// for points_value and time_window_hours via the dares_set_difficulty_defaults
// trigger — these mirror values are for display only.
export const DIFFICULTY_TIERS = [
  { key: 'easy',   label: 'Easy',   points: 10,  hours: 24, color: '#16A34A' },
  { key: 'medium', label: 'Medium', points: 25,  hours: 18, color: '#EAB308' },
  { key: 'hard',   label: 'Hard',   points: 50,  hours: 12, color: '#EA580C' },
  { key: 'insane', label: 'Insane', points: 100, hours: 6,  color: '#7C3AED' },
];

export const CATEGORIES = [
  { key: 'fitness',  label: 'Fitness' },
  { key: 'food',     label: 'Food' },
  { key: 'social',   label: 'Social' },
  { key: 'creative', label: 'Creative' },
  { key: 'mental',   label: 'Mental' },
  { key: 'wildcard', label: 'Wild card' },
];

export async function createDare({
  title,
  description,
  category,
  difficulty,
  targetUserId,
  groupId,
  isArena = false,
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You must be signed in to create a dare.');

  // points_value and time_window_hours are intentionally omitted — the
  // BEFORE INSERT trigger on `dares` derives them from difficulty so the
  // client cannot influence point totals.
  const { data, error } = await supabase
    .from('dares')
    .insert({
      created_by: user.id,
      target_user_id: targetUserId ?? null,
      group_id: groupId ?? null,
      title,
      description: description?.trim() || null,
      category,
      difficulty,
      is_arena: isArena,
    })
    .select('id, title, points_value, time_window_hours, expires_at, status')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchDareLibrary({ category } = {}) {
  let query = supabase
    .from('dare_library')
    .select('id, title, description, category, suggested_difficulty, use_count')
    .order('use_count', { ascending: false })
    .order('title', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
