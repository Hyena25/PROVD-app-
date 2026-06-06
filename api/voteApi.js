import { supabase } from '../lib/supabase';

const VOTE_ERROR_MESSAGES = {
  not_authenticated: 'You need to be signed in.',
  submission_not_found: 'That proof no longer exists.',
  voting_closed: 'Voting has already closed.',
  voting_expired: 'The voting window has ended.',
  sender_cannot_vote: "You sent this dare — you can't vote on it.",
  submitter_cannot_vote: "You can't vote on your own proof.",
  not_in_group: "You're not in this dare's group.",
  not_authorized_to_view: "You can't view this proof.",
  already_voted: "You've already voted on this proof.",
  invalid_vote: 'Invalid vote.',
};

function mapVoteError(err) {
  const raw = err?.message ?? '';
  for (const key of Object.keys(VOTE_ERROR_MESSAGES)) {
    if (raw.includes(key)) {
      const wrapped = new Error(VOTE_ERROR_MESSAGES[key]);
      wrapped.code = key;
      return wrapped;
    }
  }
  return err;
}

export async function getSubmissionForVoter(submissionId) {
  const { data, error } = await supabase.rpc('get_submission_for_voter', {
    p_submission_id: submissionId,
  });
  if (error) throw mapVoteError(error);
  return data;
}

export async function castVote(submissionId, vote) {
  const { data, error } = await supabase.rpc('cast_vote', {
    p_submission_id: submissionId,
    p_vote: vote,
  });
  if (error) throw mapVoteError(error);
  return data;
}

export async function listPendingVotesForUser() {
  const { data, error } = await supabase.rpc('list_pending_votes_for_user');
  if (error) throw mapVoteError(error);
  return Array.isArray(data) ? data : [];
}
