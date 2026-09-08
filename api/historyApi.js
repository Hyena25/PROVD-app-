import { supabase } from '../lib/supabase';

// A dare is "finished" once it can no longer change hands. Everything else
// (pending / active / awaiting a vote) still belongs on the home screen.
export const FINISHED_STATUSES = ['completed', 'missed', 'expired', 'rejected'];

/**
 * Outcome shown in history. The schema keeps four terminal statuses but a
 * player only cares about two questions: did they do it, and if not, why.
 */
export function outcomeFor(status) {
  if (status === 'completed') {
    return { key: 'completed', label: 'Completed', tone: 'success' };
  }
  if (status === 'rejected') {
    return { key: 'rejected', label: 'Rejected', tone: 'danger' };
  }
  if (status === 'expired') {
    return { key: 'expired', label: 'Ran out of time', tone: 'danger' };
  }
  if (status === 'missed') {
    return { key: 'missed', label: 'Missed', tone: 'danger' };
  }
  return { key: status ?? 'unknown', label: status ?? 'Unknown', tone: 'neutral' };
}

const SELECT =
  'id, title, status, difficulty, points_value, is_arena, created_at, expires_at, ' +
  'target_user_id, target:target_user_id (username, display_name), ' +
  'sender:created_by (username, display_name)';

function normalise(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    difficulty: row.difficulty,
    points_value: row.points_value,
    is_arena: row.is_arena,
    // No completed_at column on `dares` — expiry is when the dare resolved, and
    // created_at is the fallback for rows that never had a window.
    settled_at: row.expires_at ?? row.created_at,
    target: row.target ?? null,
    sender: row.sender ?? null,
  };
}

/** Finished dares that were aimed at the signed-in user. */
export async function listMyDareHistory({ limit = 50 } = {}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('You need to be signed in.');

  const { data, error } = await supabase
    .from('dares')
    .select(SELECT)
    .eq('target_user_id', user.id)
    .in('status', FINISHED_STATUSES)
    .order('expires_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(normalise);
}

/** Finished dares across one group — the shared activity feed. */
export async function listGroupDareHistory(groupId, { limit = 50 } = {}) {
  if (!groupId) return [];

  const { data, error } = await supabase
    .from('dares')
    .select(SELECT)
    .eq('group_id', groupId)
    .in('status', FINISHED_STATUSES)
    .order('expires_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(normalise);
}

/** Completed / total across a history list, for the profile's success rate. */
export function historyStats(rows) {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  return {
    total,
    completed,
    failed: total - completed,
    rate: total > 0 ? Math.round((completed / total) * 100) : null,
  };
}
