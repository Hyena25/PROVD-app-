// ---------------------------------------------------------------------------
// MOCK SUPABASE CLIENT — testing only
// ---------------------------------------------------------------------------
// This is a drop-in stand-in for the real supabase-js client used while the
// third-party backend (Supabase) is paused for local testing. It implements
// just enough of the supabase-js surface that the app calls (auth, table
// queries, rpc, storage, edge functions) and returns canned data so you can
// sign up / log in with ANY email + password and browse the whole app.
//
// Nothing here touches the network. The real client lives untouched in
// lib/supabase.js — flip USE_MOCK_BACKEND there (or the env var) to switch
// back to the real backend.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'mock.supabase.session';
const PROFILE_KEY = 'mock.supabase.profile';

const DEFAULT_PROFILE = {
  username: 'tester',
  display_name: 'Test User',
  total_points: 1240,
  current_streak: 5,
  arena_verified: false,
};

function futureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function pastIso(daysAgo) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
}

// --- Seeded data -----------------------------------------------------------

const MOCK_ACTIVE_DARE = {
  id: 'dare-1',
  title: 'Do 30 push-ups on camera',
  difficulty: 'medium',
  points_value: 25,
  expires_at: futureIso(11),
  status: 'active',
};

const MOCK_COMPLETED_DARES = [
  { id: 'dare-past-1', title: 'Cold shower for 60 seconds', completed_at: pastIso(2) },
  { id: 'dare-past-2', title: 'Text an old friend hello', completed_at: pastIso(6) },
  { id: 'dare-past-3', title: 'Run a mile before noon', completed_at: pastIso(11) },
];

const MOCK_LIBRARY = [
  { id: 'lib-1', title: 'Hold a plank for 2 minutes', description: 'No breaks. Film the whole thing.', category: 'fitness', suggested_difficulty: 'medium', use_count: 142 },
  { id: 'lib-2', title: 'Eat a spoonful of hot sauce', description: 'On camera, no water for 30s after.', category: 'food', suggested_difficulty: 'hard', use_count: 98 },
  { id: 'lib-3', title: 'Compliment 3 strangers', description: 'Genuine compliments only.', category: 'social', suggested_difficulty: 'easy', use_count: 211 },
  { id: 'lib-4', title: 'Draw your friend from memory', description: 'You have 5 minutes.', category: 'creative', suggested_difficulty: 'easy', use_count: 64 },
  { id: 'lib-5', title: 'Meditate for 10 minutes', description: 'No phone, eyes closed.', category: 'mental', suggested_difficulty: 'medium', use_count: 53 },
  { id: 'lib-6', title: 'Wear your shirt inside out all day', description: 'Proof: a selfie at 3 different places.', category: 'wildcard', suggested_difficulty: 'easy', use_count: 77 },
];

function mockGroupMembers(meId) {
  return [
    { user_id: meId, username: 'tester', display_name: 'Test User', monthly_points: 320, current_streak: 5 },
    { user_id: 'friend-1', username: 'maya', display_name: 'Maya', monthly_points: 410, current_streak: 9 },
    { user_id: 'friend-2', username: 'devon', display_name: 'Devon', monthly_points: 180, current_streak: 2 },
  ];
}

function mockGroupOverview(meId) {
  return {
    id: 'group-1',
    name: 'Test Squad',
    invite_code: 'TEST01',
    // get_group_overview sorts members "order by u.total_points desc,
    // u.username asc" — the group screen renders rank straight from the array
    // index, so the mock has to honour the same ordering or the leaderboard
    // shows a lower-scoring member ranked above a higher-scoring one.
    members: mockGroupMembers(meId).sort(
      (a, b) =>
        b.monthly_points - a.monthly_points ||
        a.username.localeCompare(b.username)
    ),
  };
}

function mockDareForRecipient(id) {
  return {
    id: id ?? 'dare-1',
    title: 'Do 30 push-ups on camera',
    description: 'Full range of motion, count them out loud.',
    category: 'fitness',
    difficulty: 'medium',
    points_value: 25,
    expires_at: futureIso(11),
    created_at: pastIso(0),
    status: 'active',
    sender: { username: 'maya', display_name: 'Maya' },
    viewer_swaps_remaining: 2,
  };
}

// Submissions that can be voted on, keyed by id. Seeded so the vote screen has
// real-looking content; cast votes are remembered in `mockCastVotes` below so a
// reload reflects "you voted".
const MOCK_SUBMISSIONS = {
  'sub-1': {
    submission: {
      id: 'sub-1',
      media_type: 'photo',
      media_url: 'https://picsum.photos/seed/provd-pushups/800/800',
      submitted_at: pastIso(0),
      status: 'pending',
    },
    dare: { id: 'dare-1', title: 'Do 30 push-ups on camera' },
    submitter: { username: 'devon', display_name: 'Devon' },
    baseVotes: { approved: 2, rejected: 1 },
    minutesLeft: 42,
  },
  'sub-2': {
    submission: {
      id: 'sub-2',
      media_type: 'video',
      media_url:
        'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
      submitted_at: pastIso(0),
      status: 'pending',
    },
    dare: { id: 'dare-2', title: 'Eat a spoonful of hot sauce' },
    submitter: { username: 'maya', display_name: 'Maya' },
    baseVotes: { approved: 1, rejected: 0 },
    minutesLeft: 12,
  },
};

// In-memory record of how the tester voted, per submission id.
const mockCastVotes = {};

const MOCK_PENDING_VOTES = [
  {
    submission_id: 'sub-1',
    dare_id: 'dare-1',
    dare_title: 'Do 30 push-ups on camera',
    media_type: 'photo',
    submitter_username: 'devon',
    submitted_at: pastIso(0),
    voting_deadline: futureIso(42 / 60),
  },
  {
    submission_id: 'sub-2',
    dare_id: 'dare-2',
    dare_title: 'Eat a spoonful of hot sauce',
    media_type: 'video',
    submitter_username: 'maya',
    submitted_at: pastIso(0),
    voting_deadline: futureIso(12 / 60),
  },
];

function mockSubmissionForVoter(submissionId) {
  const entry = MOCK_SUBMISSIONS[submissionId] ?? MOCK_SUBMISSIONS['sub-1'];
  const myVote = mockCastVotes[entry.submission.id] ?? null;
  return {
    submission: { ...entry.submission },
    dare: { ...entry.dare },
    submitter: { ...entry.submitter },
    viewer: {
      voting_closed: false,
      is_sender: false,
      is_submitter: false,
      has_voted: myVote != null,
      my_vote: myVote,
    },
    votes: {
      approved: entry.baseVotes.approved + (myVote === 'approved' ? 1 : 0),
      rejected: entry.baseVotes.rejected + (myVote === 'rejected' ? 1 : 0),
    },
    voting_deadline: futureIso(entry.minutesLeft / 60),
  };
}

// --- Arena (stranger dares) ------------------------------------------------

const MOCK_ARENA_DARES = [
  {
    id: 'arena-1',
    title: 'Do your best robot dance in a public place',
    description: 'At least 20 seconds, with strangers visible in frame.',
    category: 'wildcard',
    difficulty: 'medium',
    points_value: 25,
    time_window_hours: 18,
    expires_at: futureIso(14),
    sender: { username: 'stranger_jay' },
  },
  {
    id: 'arena-2',
    title: 'Order a "secret menu" item with total confidence',
    description: "Even if it doesn't exist. Capture the barista's reaction.",
    category: 'social',
    difficulty: 'easy',
    points_value: 10,
    time_window_hours: 24,
    expires_at: futureIso(20),
    sender: { username: 'wanderlust_kim' },
  },
  {
    id: 'arena-3',
    title: 'Hold a plank until your timer hits 4 minutes',
    description: 'One continuous take. No resting on your knees.',
    category: 'fitness',
    difficulty: 'hard',
    points_value: 50,
    time_window_hours: 12,
    expires_at: futureIso(7),
    sender: { username: 'iron_will' },
  },
  {
    id: 'arena-4',
    title: 'Freestyle rap about the last thing you ate',
    description: 'At least 8 bars. Bonus points for a beat.',
    category: 'creative',
    difficulty: 'medium',
    points_value: 25,
    time_window_hours: 18,
    expires_at: futureIso(15),
    sender: { username: 'mc_leftover' },
  },
];

const MOCK_GENERATED_DARES = [
  { title: 'Run a mile before breakfast', description: 'No walking breaks.', category: 'fitness', suggested_difficulty: 'medium' },
  { title: 'Cook a meal blindfolded', description: 'Film it. Safety first.', category: 'creative', suggested_difficulty: 'hard' },
  { title: 'Call a relative you haven’t spoken to in a year', description: 'At least 5 minutes.', category: 'social', suggested_difficulty: 'easy' },
];

// --- Persisted session / profile -------------------------------------------

async function readJson(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore — testing only
  }
}

function makeSession(email) {
  const id = randomId('mock-user');
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor((Date.now() + 3_600_000) / 1000),
    user: {
      id,
      email: email ?? 'tester@provd.app',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

async function getStoredSession() {
  return readJson(SESSION_KEY);
}

async function getStoredProfile() {
  const stored = await readJson(PROFILE_KEY);
  return { ...DEFAULT_PROFILE, ...(stored ?? {}) };
}

// --- Auth -------------------------------------------------------------------

function makeAuth(listeners) {
  function emit(event, session) {
    for (const cb of listeners) {
      try {
        cb(event, session);
      } catch {
        // ignore
      }
    }
  }

  return {
    async signUp({ email }) {
      const session = makeSession(email);
      await writeJson(SESSION_KEY, session);
      emit('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    },

    async signInWithPassword({ email }) {
      // Any email + password works in mock mode.
      let session = await getStoredSession();
      if (!session) {
        session = makeSession(email);
        await writeJson(SESSION_KEY, session);
      } else if (email) {
        session = { ...session, user: { ...session.user, email } };
        await writeJson(SESSION_KEY, session);
      }
      emit('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    },

    async getSession() {
      const session = await getStoredSession();
      return { data: { session: session ?? null }, error: null };
    },

    async getUser() {
      const session = await getStoredSession();
      return { data: { user: session?.user ?? null }, error: null };
    },

    async signOut() {
      await AsyncStorage.removeItem(SESSION_KEY);
      emit('SIGNED_OUT', null);
      return { error: null };
    },

    onAuthStateChange(callback) {
      listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              const i = listeners.indexOf(callback);
              if (i >= 0) listeners.splice(i, 1);
            },
          },
        },
      };
    },
  };
}

// --- Table query builder ----------------------------------------------------

const ok = (data, count = null) => ({ data, error: null, count, status: 200, statusText: 'OK' });

class MockQuery {
  constructor(table) {
    this.table = table;
    this._op = 'select';
    this._filters = {};
    this._single = false;
    this._head = false;
    this._count = null;
    this._payload = null;
  }

  select(_columns, options) {
    if (options?.count) this._count = options.count;
    if (options?.head) this._head = true;
    return this;
  }

  insert(payload) {
    this._op = 'insert';
    this._payload = payload;
    return this;
  }

  update(payload) {
    this._op = 'update';
    this._payload = payload;
    return this;
  }

  delete() {
    this._op = 'delete';
    return this;
  }

  upsert(payload) {
    this._op = 'insert';
    this._payload = payload;
    return this;
  }

  eq(column, value) {
    this._filters[column] = value;
    return this;
  }

  in(column, values) {
    this._filters[column] = values;
    return this;
  }

  // No-op chainables — present so call sites don't blow up.
  neq() { return this; }
  gt() { return this; }
  gte() { return this; }
  lt() { return this; }
  lte() { return this; }
  like() { return this; }
  ilike() { return this; }
  is() { return this; }
  contains() { return this; }
  order() { return this; }
  limit() { return this; }
  range() { return this; }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._single = true;
    return this;
  }

  // Make the builder awaitable.
  then(resolve, reject) {
    return this._run().then(resolve, reject);
  }

  catch(onReject) {
    return this._run().catch(onReject);
  }

  finally(onFinally) {
    return this._run().finally(onFinally);
  }

  async _run() {
    if (this._op === 'insert') return this._runInsert();
    if (this._op === 'update' || this._op === 'delete') return ok(this._single ? null : []);
    return this._runSelect();
  }

  async _runInsert() {
    const row = Array.isArray(this._payload) ? this._payload[0] : this._payload;

    if (this.table === 'users') {
      // Sign-up profile creation — remember the chosen username.
      const profile = { ...DEFAULT_PROFILE, ...(row ?? {}) };
      await writeJson(PROFILE_KEY, profile);
      return ok(this._single ? null : []);
    }

    if (this.table === 'dares') {
      const created = {
        id: randomId('dare'),
        title: row?.title ?? 'New dare',
        points_value: 25,
        time_window_hours: 18,
        expires_at: futureIso(18),
        status: 'pending',
      };
      return ok(this._single ? created : [created]);
    }

    if (this.table === 'friend_groups') {
      const created = {
        id: randomId('group'),
        name: row?.name ?? 'New group',
        invite_code: row?.invite_code ?? 'TEST01',
        created_at: new Date().toISOString(),
      };
      return ok(this._single ? created : [created]);
    }

    // group_members and anything else — just succeed.
    return ok(this._single ? null : []);
  }

  async _runSelect() {
    switch (this.table) {
      case 'users': {
        const profile = await getStoredProfile();
        return ok(profile);
      }

      case 'user_crowns':
        return ok([]);

      case 'dare_library': {
        const category = this._filters.category;
        const items = category
          ? MOCK_LIBRARY.filter((d) => d.category === category)
          : MOCK_LIBRARY;
        return ok(items);
      }

      case 'dares': {
        if (this._head || this._count) {
          // e.g. total assigned count on the profile screen.
          return ok(null, 8);
        }
        if ('recipient_id' in this._filters && this._filters.status === 'completed') {
          return ok(MOCK_COMPLETED_DARES);
        }
        if ('target_user_id' in this._filters) {
          // Home screen active-dare lookup.
          return ok([MOCK_ACTIVE_DARE]);
        }
        return ok([]);
      }

      default:
        return ok(this._single ? null : []);
    }
  }
}

// --- RPC --------------------------------------------------------------------

async function handleRpc(fn, params) {
  switch (fn) {
    case 'is_username_available':
      return ok(true);

    case 'verify_age': {
      // Flip the profile to verified so Arena unlocks after verifying.
      const profile = await getStoredProfile();
      await writeJson(PROFILE_KEY, { ...profile, arena_verified: true });
      return ok(true);
    }

    case 'get_my_groups':
      return ok([{ id: 'group-1', name: 'Test Squad', member_count: 3 }]);

    case 'get_group_overview': {
      const session = await getStoredSession();
      const meId = session?.user?.id ?? 'mock-user';
      return ok(mockGroupOverview(meId));
    }

    case 'lookup_group_by_invite_code':
      return ok([{ id: 'group-1', name: 'Test Squad', member_count: 3, is_member: false }]);

    case 'join_group_by_invite_code':
      return ok([{ id: 'group-1', name: 'Test Squad', member_count: 4 }]);

    case 'get_dare_for_recipient':
      return ok(mockDareForRecipient(params?.p_dare_id));

    case 'accept_dare':
    case 'use_weekly_swap':
      return ok({ ok: true });

    case 'submit_proof':
      return ok({ submission_id: randomId('sub'), dare_id: params?.p_dare_id, status: 'awaiting_votes' });

    case 'get_submission_for_voter':
      return ok(mockSubmissionForVoter(params?.p_submission_id));

    case 'cast_vote': {
      if (params?.p_submission_id && params?.p_vote) {
        mockCastVotes[params.p_submission_id] = params.p_vote;
      }
      return ok({ ok: true, my_vote: params?.p_vote ?? null });
    }

    case 'list_pending_votes_for_user':
      return ok(MOCK_PENDING_VOTES.filter((v) => !mockCastVotes[v.submission_id]));

    case 'list_arena_dares':
      return ok(MOCK_ARENA_DARES);

    case 'accept_arena_dare':
      return ok({ ok: true, dare_id: params?.p_dare_id ?? null });

    default:
      return ok(null);
  }
}

// --- Storage ----------------------------------------------------------------

function makeStorage() {
  return {
    from(bucket) {
      return {
        getPublicUrl(path) {
          return {
            data: { publicUrl: `https://mock.storage/${bucket}/${path}` },
          };
        },
        async upload() {
          return { data: { path: 'mock-path' }, error: null };
        },
        async createSignedUrl(path) {
          return { data: { signedUrl: `https://mock.storage/${path}` }, error: null };
        },
      };
    },
  };
}

// --- Edge functions ---------------------------------------------------------

function makeFunctions() {
  return {
    async invoke(name) {
      if (name === 'generate-dares') {
        return { data: { dares: MOCK_GENERATED_DARES }, error: null };
      }
      return { data: null, error: null };
    },
  };
}

// --- Public factory ---------------------------------------------------------

export function createMockSupabase() {
  const listeners = [];
  return {
    __isMock: true,
    auth: makeAuth(listeners),
    from(table) {
      return new MockQuery(table);
    },
    rpc(fn, params) {
      return handleRpc(fn, params);
    },
    storage: makeStorage(),
    functions: makeFunctions(),
  };
}
