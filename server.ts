import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import {
  detectStudentStruggle,
  gradePracticeQuiz,
  LEARNING_MODES,
  SKILL_LEVELS,
  SUBJECTS,
  validateAuthInput,
} from './src/shared/tutorLogic.ts';
import type {
  AuthProvider,
  ChatMessage,
  LearningMode,
  SkillLevel,
  Subject,
  TutorAttachment,
  UserProfile,
} from './src/shared/types.ts';
import { generateTutorTurn } from './server/geminiTutor.ts';
import {
  addFlashcard,
  appendSessionMessage,
  createBearerToken,
  createTutorSession,
  getSession,
  getUserById,
  getUserProgress,
  joinSessionParticipant,
  listUserSessions,
  removeFlashcard,
  setParticipantOnline,
  updateSessionMeta,
  updateSessionMode,
  updateSessionScratchpad,
  upsertTopicProgress,
  upsertUser,
  verifyBearerToken,
} from './server/store.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface AuthedRequest extends express.Request {
  user?: UserProfile;
}

function extractBearerUser(req: express.Request): UserProfile | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const userId = verifyBearerToken(token);
  if (!userId) return null;
  return getUserById(userId);
}

function requireAuth(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.user = user;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err);
  });

  // Track room WebSocket clients by sessionId
  const rooms = new Map<string, Set<{ ws: WebSocket; userId: string }>>();

  function broadcastToSession(
    sessionId: string,
    event: string,
    payload: unknown,
    excludeUserId?: string
  ): void {
    const clients = rooms.get(sessionId);
    if (!clients) return;
    const message = JSON.stringify({ event, payload });
    for (const client of clients) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch {
          // Ignore send errors on closing sockets
        }
      }
    }
  }

  wss.on('connection', (ws, req) => {
    ws.on('error', (err) => {
      console.error('WebSocket client error:', err.message);
    });

    let token = '';
    let sessionId = '';
    try {
      const url = new URL(
        req.url || '/',
        `http://${req.headers.host || 'localhost'}`
      );
      token = url.searchParams.get('token') || '';
      sessionId = url.searchParams.get('sessionId') || '';
    } catch {
      ws.close(1008, 'Malformed WebSocket URL');
      return;
    }

    const userId = verifyBearerToken(token);
    const user = userId ? getUserById(userId) : null;
    const session = sessionId ? getSession(sessionId) : null;

    if (!user || !session) {
      ws.close(1008, 'Invalid session or authentication token');
      return;
    }

    joinSessionParticipant(sessionId, user, true);

    if (!rooms.has(sessionId)) {
      rooms.set(sessionId, new Set());
    }
    const clientRecord = { ws, userId: user.id };
    rooms.get(sessionId)!.add(clientRecord);

    const freshSession = getSession(sessionId);
    if (freshSession) {
      try {
        ws.send(
          JSON.stringify({
            event: 'session:sync',
            payload: freshSession,
          })
        );
      } catch {
        // Ignore send errors if socket closed immediately
      }
      broadcastToSession(sessionId, 'presence:update', {
        participants: freshSession.participants,
      });
    }

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as {
          event?: string;
          payload?: Record<string, unknown>;
        };
        if (
          data.event === 'scratchpad:edit' &&
          typeof data.payload?.scratchpad === 'string'
        ) {
          const updated = updateSessionScratchpad(
            sessionId,
            data.payload.scratchpad
          );
          if (updated) {
            broadcastToSession(
              sessionId,
              'scratchpad:update',
              { scratchpad: updated.scratchpad, updatedBy: user.name },
              user.id
            );
          }
        }
      } catch {
        // Ignore malformed client WS messages
      }
    });

    ws.on('close', () => {
      const set = rooms.get(sessionId);
      if (set) {
        set.delete(clientRecord);
        const stillConnected = Array.from(set).some(
          (c) => c.userId === user.id
        );
        if (!stillConnected) {
          const updated = setParticipantOnline(sessionId, user.id, false);
          if (updated) {
            broadcastToSession(sessionId, 'presence:update', {
              participants: updated.participants,
            });
          }
        }
        if (set.size === 0) {
          rooms.delete(sessionId);
        }
      }
    });
  });

  // --- Auth Routes ---
  app.post('/api/auth/login', (req, res) => {
    const { provider, name, email } = (req.body ?? {}) as {
      provider?: AuthProvider;
      name?: string;
      email?: string;
    };

    if (
      provider !== 'google' &&
      provider !== 'microsoft' &&
      provider !== 'guest'
    ) {
      res.status(400).json({ error: 'Unsupported sign-in provider.' });
      return;
    }

    const validation = validateAuthInput({ provider, name, email });
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const user = upsertUser({
      provider,
      name: validation.normalizedName,
      email: validation.normalizedEmail,
    });
    const token = createBearerToken(user.id);
    const progress = getUserProgress(user.id);

    res.json({ token, user, progress });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    res.json({
      user,
      progress: getUserProgress(user.id),
      sessions: listUserSessions(user.id),
    });
  });

  // --- Progress & Flashcards Routes ---
  app.get('/api/progress', requireAuth, (req: AuthedRequest, res) => {
    res.json(getUserProgress(req.user!.id));
  });

  app.post('/api/progress/flashcards', requireAuth, (req: AuthedRequest, res) => {
    const { front, back, topic, subject } = (req.body ?? {}) as {
      front?: string;
      back?: string;
      topic?: string;
      subject?: Subject;
    };
    if (!front?.trim() || !back?.trim()) {
      res.status(400).json({ error: 'Flashcard front and back are required.' });
      return;
    }
    const validSubject = SUBJECTS.includes(subject as Subject)
      ? (subject as Subject)
      : 'Math';
    const result = addFlashcard(req.user!.id, {
      front,
      back,
      topic: topic || validSubject,
      subject: validSubject,
    });
    res.json(result);
  });

  app.delete(
    '/api/progress/flashcards/:cardId',
    requireAuth,
    (req: AuthedRequest, res) => {
      const cardId = String(req.params.cardId);
      const progress = removeFlashcard(req.user!.id, cardId);
      res.json({ progress });
    }
  );

  // --- Session Management Routes ---
  app.get('/api/sessions', requireAuth, (req: AuthedRequest, res) => {
    res.json({ sessions: listUserSessions(req.user!.id) });
  });

  app.post('/api/sessions', requireAuth, (req: AuthedRequest, res) => {
    const { subject, level, title } = (req.body ?? {}) as {
      subject?: Subject;
      level?: SkillLevel;
      title?: string;
    };

    if (!subject || !SUBJECTS.includes(subject)) {
      res.status(400).json({ error: 'Please select a valid subject.' });
      return;
    }
    if (!level || !SKILL_LEVELS.includes(level)) {
      res.status(400).json({ error: 'Please select a valid grade or skill level.' });
      return;
    }

    const session = createTutorSession({
      user: req.user!,
      subject,
      level,
      title,
    });
    res.json({ session });
  });

  app.post(
    '/api/sessions/:sessionId/join',
    requireAuth,
    (req: AuthedRequest, res) => {
      const sessionId = String(req.params.sessionId);
      const session = joinSessionParticipant(sessionId, req.user!, true);
      if (!session) {
        res.status(404).json({ error: 'Tutoring session not found.' });
        return;
      }
      broadcastToSession(sessionId, 'presence:update', {
        participants: session.participants,
      });
      res.json({ session });
    }
  );

  app.patch(
    '/api/sessions/:sessionId/mode',
    requireAuth,
    (req: AuthedRequest, res) => {
      const sessionId = String(req.params.sessionId);
      const { mode } = (req.body ?? {}) as { mode?: LearningMode };
      if (!mode || !LEARNING_MODES.some((m) => m.id === mode)) {
        res.status(400).json({ error: 'Invalid learning mode.' });
        return;
      }
      const existing = getSession(sessionId);
      if (!existing) {
        res.status(404).json({ error: 'Session not found.' });
        return;
      }
      const isMember =
        existing.hostId === req.user!.id ||
        existing.participants.some((p) => p.id === req.user!.id);
      if (!isMember) {
        res.status(403).json({ error: 'Join this session before updating it.' });
        return;
      }

      const updated = updateSessionMode(sessionId, mode);
      broadcastToSession(sessionId, 'mode:update', { mode });
      res.json({ session: updated });
    }
  );

  app.patch(
    '/api/sessions/:sessionId/scratchpad',
    requireAuth,
    (req: AuthedRequest, res) => {
      const sessionId = String(req.params.sessionId);
      const { scratchpad } = (req.body ?? {}) as { scratchpad?: string };
      if (typeof scratchpad !== 'string') {
        res.status(400).json({ error: 'Scratchpad text is required.' });
        return;
      }
      const existing = getSession(sessionId);
      if (!existing) {
        res.status(404).json({ error: 'Session not found.' });
        return;
      }
      const isMember =
        existing.hostId === req.user!.id ||
        existing.participants.some((p) => p.id === req.user!.id);
      if (!isMember) {
        res.status(403).json({ error: 'Join this session before editing.' });
        return;
      }

      const updated = updateSessionScratchpad(sessionId, scratchpad);
      broadcastToSession(
        sessionId,
        'scratchpad:update',
        { scratchpad: updated?.scratchpad ?? '', updatedBy: req.user!.name },
        req.user!.id
      );
      res.json({ session: updated });
    }
  );

  // --- Tutor Chat & Multimodal Turn ---
  app.post(
    '/api/sessions/:sessionId/message',
    requireAuth,
    async (req: AuthedRequest, res) => {
      const sessionId = String(req.params.sessionId);
      const session = getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found.' });
        return;
      }
      const isMember =
        session.hostId === req.user!.id ||
        session.participants.some((p) => p.id === req.user!.id);
      if (!isMember) {
        res.status(403).json({ error: 'Join this session before sending messages.' });
        return;
      }

      let studentMsg: ChatMessage | undefined;
      try {
        const rawBody = (req.body ?? {}) as {
          content?: unknown;
          mode?: LearningMode;
          attachment?: TutorAttachment;
        };

        const activeMode =
          rawBody.mode && LEARNING_MODES.some((m) => m.id === rawBody.mode)
            ? rawBody.mode
            : session.mode;
        if (activeMode !== session.mode) {
          updateSessionMode(sessionId, activeMode);
          broadcastToSession(sessionId, 'mode:update', { mode: activeMode });
        }

        const attachment =
          rawBody.attachment &&
          typeof rawBody.attachment === 'object' &&
          typeof rawBody.attachment.mimeType === 'string' &&
          (typeof rawBody.attachment.dataUrl === 'string' ||
            typeof rawBody.attachment.textPreview === 'string')
            ? rawBody.attachment
            : undefined;

        const cleanContent =
          typeof rawBody.content === 'string' ? rawBody.content.trim() : '';
        if (!cleanContent && !attachment) {
          res
            .status(400)
            .json({ error: 'Please write a question or attach study material.' });
          return;
        }

        const effectivePrompt =
          cleanContent ||
          (activeMode === 'quiz'
            ? 'Please generate a 3 to 5 question practice quiz based on my attached material and current topic.'
            : activeMode === 'explainer'
              ? 'Please explain the key concept shown in my attached material using a clear analogy and diagram.'
              : 'Please look at my attached study material and guide me on the first step.');

        const persistedAttachment: TutorAttachment | undefined = attachment
          ? {
              id: attachment.id,
              name: attachment.name,
              mimeType: attachment.mimeType,
              source: attachment.source,
              textPreview: attachment.textPreview?.slice(0, 1200),
              dataUrl:
                attachment.dataUrl &&
                attachment.mimeType.startsWith('image/') &&
                attachment.dataUrl.length <= 220_000
                  ? attachment.dataUrl
                  : undefined,
            }
          : undefined;

        studentMsg = {
          id: `msg_${crypto.randomBytes(6).toString('hex')}`,
          senderId: req.user!.id,
          senderName: req.user!.name,
          role: 'student',
          content: effectivePrompt,
          mode: activeMode,
          timestamp: Date.now(),
          attachment: persistedAttachment,
        };

        appendSessionMessage(sessionId, studentMsg);
        broadcastToSession(sessionId, 'message:new', { message: studentMsg });

        const struggled = detectStudentStruggle(effectivePrompt);
        const nextStuckCount = struggled ? session.stuckCount + 1 : 0;

        const modelOut = await generateTutorTurn({
          subject: session.subject,
          level: session.level,
          mode: activeMode,
          stuckCount: nextStuckCount,
          currentConcept: session.currentConcept,
          scratchpad: session.scratchpad,
          history: session.messages,
          userPrompt: effectivePrompt,
          attachment,
        });

        updateSessionMeta(sessionId, {
          stuckCount: nextStuckCount,
          currentConcept: modelOut.conceptTag || session.currentConcept,
        });

        let updatedProgress = getUserProgress(req.user!.id);
        if (
          modelOut.conceptTag &&
          (modelOut.progressSignal === 'mastered' ||
            modelOut.progressSignal === 'needs_review')
        ) {
          updatedProgress = upsertTopicProgress(req.user!.id, {
            topic: modelOut.conceptTag,
            subject: session.subject,
            status:
              modelOut.progressSignal === 'mastered' ? 'mastered' : 'review',
            masteryScore: modelOut.progressSignal === 'mastered' ? 90 : 45,
          });
        }

        const tutorMsg: ChatMessage = {
          id: `msg_${crypto.randomBytes(6).toString('hex')}`,
          senderId: 'tutor',
          senderName: 'Abundant Knowledge',
          role: 'tutor',
          content: modelOut.reply,
          mode: activeMode,
          timestamp: Date.now(),
          conceptTag: modelOut.conceptTag,
          guidingQuestion: modelOut.guidingQuestion,
          quickReplies:
            modelOut.quickReplies && modelOut.quickReplies.length > 0
              ? modelOut.quickReplies
              : undefined,
          diagram: activeMode === 'explainer' ? modelOut.diagram : undefined,
          quiz: activeMode === 'quiz' ? modelOut.quiz : undefined,
          suggestedFlashcard: modelOut.suggestedFlashcard,
        };

        appendSessionMessage(sessionId, tutorMsg);
        broadcastToSession(sessionId, 'message:new', { message: tutorMsg });

        res.json({
          studentMessage: studentMsg,
          tutorMessage: tutorMsg,
          progress: updatedProgress,
        });
      } catch (err) {
        console.error('Tutor message error:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach the tutoring service right now.';
        if (!res.headersSent) {
          res.status(502).json({ error: message, studentMessage: studentMsg });
        }
      }
    }
  );

  // --- Submit Practice Quiz Answers ---
  app.post(
    '/api/sessions/:sessionId/quiz/:messageId/submit',
    requireAuth,
    (req: AuthedRequest, res) => {
      const sessionId = String(req.params.sessionId);
      const messageId = String(req.params.messageId);
      const session = getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found.' });
        return;
      }

      const targetMsg = session.messages.find((m) => m.id === messageId);
      if (!targetMsg || !targetMsg.quiz || targetMsg.quiz.length === 0) {
        res.status(404).json({ error: 'Quiz message not found.' });
        return;
      }

      const { answers } = (req.body ?? {}) as {
        answers?: Record<string, number>;
      };
      const cleanAnswers = answers ?? {};
      const report = gradePracticeQuiz(targetMsg.quiz, cleanAnswers);

      targetMsg.quizSubmission = {
        answers: cleanAnswers,
        score: report.score,
        total: report.total,
        submittedAt: Date.now(),
        submittedBy: req.user!.name,
      };

      let progress = getUserProgress(req.user!.id);
      for (const topic of report.topicsMastered) {
        progress = upsertTopicProgress(req.user!.id, {
          topic,
          subject: session.subject,
          status: 'mastered',
          masteryScore: Math.max(80, report.percentage),
        });
      }
      for (const topic of report.conceptsToReview) {
        progress = upsertTopicProgress(req.user!.id, {
          topic,
          subject: session.subject,
          status: 'review',
          masteryScore: Math.min(60, report.percentage),
        });
      }

      const feedbackMsg: ChatMessage = {
        id: `msg_${crypto.randomBytes(6).toString('hex')}`,
        senderId: 'tutor',
        senderName: 'Abundant Knowledge',
        role: 'tutor',
        mode: 'quiz',
        timestamp: Date.now(),
        content: report.feedbackSummary,
        conceptTag: targetMsg.conceptTag,
        guidingQuestion:
          report.conceptsToReview.length > 0
            ? `Want to go over "${report.conceptsToReview[0]}" step by step?`
            : 'Ready for another topic or a harder challenge?',
        quickReplies:
          report.conceptsToReview.length > 0
            ? [
                `Walk me through ${report.conceptsToReview[0]}`,
                'Show me an easier example',
                'Try another quiz',
              ]
            : ['Try a harder quiz', 'Pick a new topic', 'Summarize what I learned'],
      };
      appendSessionMessage(sessionId, feedbackMsg);

      broadcastToSession(sessionId, 'quiz:submitted', {
        messageId,
        quizSubmission: targetMsg.quizSubmission,
        feedbackMessage: feedbackMsg,
      });

      res.json({
        report,
        quizSubmission: targetMsg.quizSubmission,
        feedbackMessage: feedbackMsg,
        progress,
      });
    }
  );

  // --- Vite / Static Frontend Serving ---
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Global JSON error middleware so malformed payloads or route errors don't crash the server
  app.use(
    (
      err: Error & { status?: number; type?: string },
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      console.error('Express error:', err.message);
      const status = typeof err.status === 'number' ? err.status : 500;
      if (req.path.startsWith('/api/')) {
        res.status(status).json({
          error:
            err.type === 'entity.too.large'
              ? 'Attached file is too large. Please upload a smaller image or document.'
              : err.message || 'Server request failed.',
        });
        return;
      }
      res.status(status).send('Unexpected server error.');
    }
  );

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Abundant Knowledge running on http://localhost:${PORT}`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
