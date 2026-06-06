import { supabase } from '../lib/supabase';

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;
const MAX_INVITE_CODE_RETRIES = 5;
const PG_UNIQUE_VIOLATION = '23505';

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function insertGroupWithUniqueCode(name, creatorId) {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_RETRIES; attempt++) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from('friend_groups')
      .insert({
        name,
        created_by: creatorId,
        invite_code: inviteCode,
      })
      .select('id, name, invite_code, created_at')
      .single();

    if (!error) return data;
    if (error.code !== PG_UNIQUE_VIOLATION) throw error;
  }
  throw new Error('Could not generate a unique invite code. Please try again.');
}

export async function createGroup({ name, creatorId }) {
  const group = await insertGroupWithUniqueCode(name, creatorId);

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: creatorId });
  if (memberError) throw memberError;

  return group;
}

const JOIN_ERROR_MESSAGES = {
  group_not_found: 'No group with that invite code.',
  already_member: 'You are already a member of this group.',
  group_full: 'This group is full (15 members).',
  not_authenticated: 'You must be signed in to join a group.',
};

function mapJoinError(error) {
  const raw = error?.message ?? '';
  for (const key of Object.keys(JOIN_ERROR_MESSAGES)) {
    if (raw.includes(key)) {
      const wrapped = new Error(JOIN_ERROR_MESSAGES[key]);
      wrapped.code = key;
      return wrapped;
    }
  }
  return error;
}

export async function lookupGroupByInviteCode(code) {
  const { data, error } = await supabase.rpc('lookup_group_by_invite_code', {
    p_code: code,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function joinGroupByInviteCode(code) {
  const { data, error } = await supabase.rpc('join_group_by_invite_code', {
    p_code: code,
  });
  if (error) throw mapJoinError(error);
  return data?.[0] ?? null;
}

export async function listMyGroups() {
  const { data, error } = await supabase.rpc('get_my_groups');
  if (error) throw error;
  return data ?? [];
}
