import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuthProvider,
  ChatMessage,
  Flashcard,
  LearningMode,
  Participant,
  SkillLevel,
  Subject,
  TopicProgress,
  TutorSession,
  UserProfile,
  UserProgress,
} from '../src/shared/types.ts';

interface StoreData {
  users: Record<string, UserProfile>;
  progress: Record<string, UserProgress>;
  sessions: Record<string, TutorSession>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SECRET_PATH = path.join(DATA_DIR, 'secret.key');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function resolveTokenSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    ensureDataDir();
    if (fs.existsSync(SECRET_PATH)) {
      const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_PATH, generated, 'utf8');
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const TOKEN_SECRET = resolveTokenSecret();

function loadStore(): StoreData {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    return { users: {}, progress: {}, sessions: {} };
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      users: parsed.users ?? {},
      progress: parsed.progress ?? {},
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return { users: {}, progress: {}, sessions: {} };
  }
}

const store: StoreData = loadStore();

let saveQueued = false;
function persistStore(): void {
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    try {
      ensureDataDir();
      const tmpPath = `${STORE_PATH}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(store), 'utf8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  });
}

export function createBearerToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyBearerToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { sub?: string; exp?: number };
    if (!decoded.sub || typeof decoded.exp !== 'number') return null;
    if (Date.now() > decoded.exp) return null;
    return decoded.sub;
  } catch {
    return null;
  }
}

export function upsertUser(params: {
  provider: AuthProvider;
  name: string;
  email?: string;
}): UserProfile {
  const deterministicId =
    params.provider === 'guest'
      ? `guest_${crypto.randomBytes(6).toString('hex')}`
      : `${params.provider}_${crypto
          .createHash('sha256')
          .update((params.email ?? params.name).toLowerCase())
          .digest('hex')
          .slice(0, 16)}`;

  const existing = store.users[deterministicId];
  const user: UserProfile = existing
    ? {
        ...existing,
        name: params.name,
        email: params.email ?? existing.email,
      }
    : {
        id: deterministicId,
        name: params.name,
        email: params.email,
        provider: params.provider,
        createdAt: Date.now(),
      };

  store.users[user.id] = user;

  if (!store.progress[user.id]) {
    store.progress[user.id] = {
      topics: [
        {
          id: `topic_seed_${user.id.slice(0, 8)}`,
          topic: 'Breaking Problems Into Steps',
          subject: 'Math',
          status: 'mastered',
          masteryScore: 85,
          updatedAt: Date.now(),
        },
      ],
      flashcards: [],
    };
  }

  persistStore();
  return user;
}

export function getUserById(userId: string): UserProfile | null {
  return store.users[userId] ?? null;
}

export function getUserProgress(userId: string): UserProgress {
  if (!store.progress[userId]) {
    store.progress[userId] = { topics: [], flashcards: [] };
  }
  return store.progress[userId];
}

export function upsertTopicProgress(
  userId: string,
  entry: {
    topic: string;
    subject: Subject;
    status: 'mastered' | 'review';
    masteryScore: number;
  }
): UserProgress {
  const progress = getUserProgress(userId);
  const normalized = entry.topic.trim();
  const existingIdx = progress.topics.findIndex(
    (t) =>
      t.topic.toLowerCase() === normalized.toLowerCase() &&
      t.subject === entry.subject
  );

  const updatedItem: TopicProgress = {
    id:
      existingIdx >= 0
        ? progress.topics[existingIdx].id
        : `topic_${crypto.randomBytes(5).toString('hex')}`,
    topic: normalized,
    subject: entry.subject,
    status: entry.status,
    masteryScore: Math.max(0, Math.min(100, Math.round(entry.masteryScore))),
    updatedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    progress.topics[existingIdx] = updatedItem;
  } else {
    progress.topics.unshift(updatedItem);
  }

  persistStore();
  return progress;
}

export function addFlashcard(
  userId: string,
  card: { front: string; back: string; topic: string; subject: Subject }
): { progress: UserProgress; flashcard: Flashcard } {
  const progress = getUserProgress(userId);
  const flashcard: Flashcard = {
    id: `card_${crypto.randomBytes(5).toString('hex')}`,
    front: card.front.trim().slice(0, 280),
    back: card.back.trim().slice(0, 600),
    topic: card.topic.trim().slice(0, 100),
    subject: card.subject,
    createdAt: Date.now(),
  };
  progress.flashcards.unshift(flashcard);
  persistStore();
  return { progress, flashcard };
}

export function removeFlashcard(userId: string, cardId: string): UserProgress {
  const progress = getUserProgress(userId);
  progress.flashcards = progress.flashcards.filter((c) => c.id !== cardId);
  persistStore();
  return progress;
}

function generateNumericSessionCode(): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!store.sessions[code]) {
      return code;
    }
  }
  let fallback = String(crypto.randomInt(10000000, 100000000));
  while (store.sessions[fallback]) {
    fallback = String(crypto.randomInt(10000000, 100000000));
  }
  return fallback;
}

export function createTutorSession(params: {
  user: UserProfile;
  subject: Subject;
  level: SkillLevel;
  title?: string;
}): TutorSession {
  const sessionId = generateNumericSessionCode();
  const now = Date.now();
  const welcomeMessage: ChatMessage = {
    id: `msg_${crypto.randomBytes(6).toString('hex')}`,
    senderId: 'tutor',
    senderName: 'Abundant Knowledge',
    role: 'tutor',
    mode: 'socratic',
    timestamp: now,
    content: `Hi ${params.user.name}! Today we're working on ${params.subject} (${params.level}).`,
    guidingQuestion: 'How would you like to get started?',
    quickReplies: [
      `Help me with a ${params.subject} problem`,
      'Explain a topic from scratch',
      'Check what I wrote in Notes',
      'Give me a quick quiz',
    ],
  };

  const session: TutorSession = {
    id: sessionId,
    title: params.title?.trim() || `${params.subject} Study Session`,
    subject: params.subject,
    level: params.level,
    mode: 'socratic',
    scratchpad: '',
    hostId: params.user.id,
    participants: [
      {
        id: params.user.id,
        name: params.user.name,
        provider: params.user.provider,
        role: 'host',
        joinedAt: now,
        online: true,
      },
    ],
    messages: [welcomeMessage],
    stuckCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  store.sessions[sessionId] = session;
  persistStore();
  return session;
}

export function getSession(sessionId: string): TutorSession | null {
  return store.sessions[sessionId] ?? null;
}

export function listUserSessions(userId: string): TutorSession[] {
  return Object.values(store.sessions)
    .filter(
      (s) =>
        s.hostId === userId || s.participants.some((p) => p.id === userId)
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12);
}

export function joinSessionParticipant(
  sessionId: string,
  user: UserProfile,
  online = true
): TutorSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;

  const existing = session.participants.find((p) => p.id === user.id);
  if (existing) {
    existing.online = online;
    existing.name = user.name;
  } else {
    const participant: Participant = {
      id: user.id,
      name: user.name,
      provider: user.provider,
      role: session.hostId === user.id ? 'host' : 'peer',
      joinedAt: Date.now(),
      online,
    };
    session.participants.push(participant);
  }
  session.updatedAt = Date.now();
  persistStore();
  return session;
}

export function setParticipantOnline(
  sessionId: string,
  userId: string,
  online: boolean
): TutorSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;
  const existing = session.participants.find((p) => p.id === userId);
  if (existing) {
    existing.online = online;
    persistStore();
  }
  return session;
}

export function updateSessionScratchpad(
  sessionId: string,
  scratchpad: string
): TutorSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;
  session.scratchpad = scratchpad.slice(0, 20000);
  session.updatedAt = Date.now();
  persistStore();
  return session;
}

export function updateSessionMode(
  sessionId: string,
  mode: LearningMode
): TutorSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;
  session.mode = mode;
  session.updatedAt = Date.now();
  persistStore();
  return session;
}

export function appendSessionMessage(
  sessionId: string,
  message: ChatMessage
): TutorSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;
  if (!session.messages.some((m) => m.id === message.id)) {
    session.messages.push(message);
  }
  session.updatedAt = Date.now();
  persistStore();
  return session;
}

export function updateSessionMeta(
  sessionId: string,
  updates: { stuckCount?: number; currentConcept?: string }
): TutorSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;
  if (typeof updates.stuckCount === 'number') {
    session.stuckCount = updates.stuckCount;
  }
  if (typeof updates.currentConcept === 'string' && updates.currentConcept) {
    session.currentConcept = updates.currentConcept;
  }
  session.updatedAt = Date.now();
  persistStore();
  return session;
}
