import { supabase } from '../lib/supabase';

const KNOWN_CATEGORIES = new Set([
  'fitness',
  'food',
  'social',
  'creative',
  'mental',
  'wildcard',
]);
const KNOWN_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'insane']);
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 200;

function normalizeDare(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title =
    typeof raw.title === 'string' ? raw.title.trim().slice(0, TITLE_MAX) : '';
  const description =
    typeof raw.description === 'string'
      ? raw.description.trim().slice(0, DESCRIPTION_MAX)
      : '';
  if (!title) return null;

  const category = KNOWN_CATEGORIES.has(raw.category) ? raw.category : null;
  const suggested_difficulty = KNOWN_DIFFICULTIES.has(raw.suggested_difficulty)
    ? raw.suggested_difficulty
    : null;

  return { title, description, category, suggested_difficulty };
}

export async function generateDares({ description }) {
  const { data, error } = await supabase.functions.invoke('generate-dares', {
    body: { description },
  });

  if (error) {
    throw new Error(
      error?.message ?? 'Could not reach the dare generator. Please try again.'
    );
  }
  if (data?.error) throw new Error(data.error);
  if (!Array.isArray(data?.dares) || data.dares.length === 0) {
    throw new Error('Dare generator returned no dares.');
  }

  const normalized = data.dares.map(normalizeDare).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error('Dare generator returned no usable dares.');
  }
  return normalized;
}
