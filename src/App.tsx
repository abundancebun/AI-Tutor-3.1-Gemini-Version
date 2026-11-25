import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProgressSidebar } from './components/ProgressSidebar';
import { SessionSetupView } from './components/SessionSetupView';
import { ShareSessionModal } from './components/ShareSessionModal';
import { SignInView } from './components/SignInView';
import { StudyMaterialPane } from './components/StudyMaterialPane';
import { TopBar } from './components/TopBar';
import { TutorChatPane } from './components/TutorChatPane';
import type {
  AuthProvider,
  ChatMessage,
  LearningMode,
  Participant,
  QuizSubmission,
  SkillLevel,
  Subject,
  TutorAttachment,
  TutorSession,
  UserProfile,
  UserProgress,
} from './shared/types';

import { sanitizeSessionCode } from './shared/tutorLogic';

function readUrlParams(): { sessionId: string | null; autostart: boolean } {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawSession = params.get('session');
    const sessionId = rawSession ? sanitizeSessionCode(rawSession) : null;
    const autostart = params.get('autostart') === '1';
    return { sessionId, autostart };
  } catch {
    return { sessionId: null, autostart: false };
  }
}

function replaceUrlSafely(url: string): void {
  try {
    window.history.replaceState(null, '', url);
  } catch {
    // Ignore history restrictions inside sandboxed iframes
  }
}

export default function App() {
  const initialParams = useRef(readUrlParams());

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress>({
    topics: [],
    flashcards: [],
  });
  const [recentSessions, setRecentSessions] = useState<TutorSession[]>([]);
  const [activeSession, setActiveSession] = useState<TutorSession | null>(null);

  const [invitedSessionId, setInvitedSessionId] = useState<string | null>(
    initialParams.current.sessionId
  );

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  const [stagedAttachment, setStagedAttachment] =
    useState<TutorAttachment | null>(null);
  const [liveFeedActive, setLiveFeedActive] = useState(false);
  const latestLiveFrameRef = useRef<TutorAttachment | null>(null);

  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'notes' | 'chat' | 'progress'>(
    'chat'
  );

  const wsRef = useRef<WebSocket | null>(null);
  const scratchpadTimerRef = useRef<number | null>(null);

  const apiFetch = useCallback(
    async <T,>(
      url: string,
      options: RequestInit = {},
      overrideToken?: string,
      timeoutMs = 30000
    ): Promise<T> => {
      const authToken = overrideToken ?? token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as T & {
          error?: string;
        };
        if (res.status === 401 && !overrideToken) {
          setToken(null);
          setUser(null);
          setActiveSession(null);
          setAuthError('Your session expired. Please sign in again to continue.');
          throw new Error('Your session expired. Please sign in again.');
        }
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        return data;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('The request took too long. Please try again.');
        }
        throw err;
      } finally {
        window.clearTimeout(timer);
      }
    },
    [token]
  );

  const joinExistingSession = useCallback(
    async (sessionId: string, overrideToken?: string) => {
      const data = await apiFetch<{ session: TutorSession }>(
        `/api/sessions/${encodeURIComponent(sessionId)}/join`,
        { method: 'POST' },
        overrideToken
      );
      setActiveSession(data.session);
      setInvitedSessionId(null);
      if (window.innerWidth >= 1024) setIsProgressOpen(true);
      replaceUrlSafely(`/?session=${data.session.id}`);
    },
    [apiFetch]
  );

  const handleAuthenticate = useCallback(
    async (payload: {
      provider: AuthProvider;
      name?: string;
      email?: string;
    }) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const data = await apiFetch<{
          token: string;
          user: UserProfile;
          progress: UserProgress;
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setToken(data.token);
        setUser(data.user);
        setProgress(data.progress);

        const meData = await apiFetch<{ sessions: TutorSession[] }>(
          '/api/auth/me',
          {},
          data.token
        );
        setRecentSessions(meData.sessions);

        if (invitedSessionId) {
          try {
            await joinExistingSession(invitedSessionId, data.token);
          } catch (err) {
            setSetupError(
              err instanceof Error
                ? err.message
                : 'Shared session could not be found.'
            );
            setInvitedSessionId(null);
          }
        } else if (initialParams.current.autostart) {
          const created = await apiFetch<{ session: TutorSession }>(
            '/api/sessions',
            {
              method: 'POST',
              body: JSON.stringify({
                subject: 'Math',
                level: 'High School',
              }),
            },
            data.token
          );
          setActiveSession(created.session);
          if (window.innerWidth >= 1024) setIsProgressOpen(true);
          replaceUrlSafely(`/?session=${created.session.id}`);
        }
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to sign in right now.'
        );
      } finally {
        setAuthLoading(false);
      }
    },
    [apiFetch, invitedSessionId, joinExistingSession]
  );

  // Support ?autostart=1 for instant entry into main workspace
  const autostartAttemptedRef = useRef(false);
  useEffect(() => {
    if (
      initialParams.current.autostart &&
      !autostartAttemptedRef.current &&
      !user
    ) {
      autostartAttemptedRef.current = true;
      void handleAuthenticate({ provider: 'guest', name: 'Guest Learner' });
    }
  }, [handleAuthenticate, user]);

  // Connect WebSocket for live shared tutoring workspace synchronization
  useEffect(() => {
    if (!token || !activeSession?.id) return;

    let closedByUser = false;
    let reconnectTimer: number | null = null;
    const sessionId = activeSession.id;

    const connect = () => {
      if (closedByUser) return;
      let ws: WebSocket;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(
          token
        )}&sessionId=${encodeURIComponent(sessionId)}`;
        ws = new WebSocket(wsUrl);
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // Ignore close error
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            event: string;
            payload: Record<string, unknown>;
          };
          if (parsed.event === 'session:sync') {
            setActiveSession(parsed.payload as unknown as TutorSession);
          } else if (parsed.event === 'presence:update') {
            const participants = Array.isArray(parsed.payload.participants)
              ? (parsed.payload.participants as Participant[])
              : [];
            setActiveSession((prev) =>
              prev && prev.id === sessionId ? { ...prev, participants } : prev
            );
          } else if (parsed.event === 'scratchpad:update') {
            const nextScratchpad = parsed.payload.scratchpad;
            if (typeof nextScratchpad === 'string') {
              setActiveSession((prev) =>
                prev && prev.id === sessionId
                  ? { ...prev, scratchpad: nextScratchpad }
                  : prev
              );
            }
          } else if (parsed.event === 'mode:update') {
            const nextMode = parsed.payload.mode as LearningMode;
            setActiveSession((prev) =>
              prev && prev.id === sessionId ? { ...prev, mode: nextMode } : prev
            );
          } else if (parsed.event === 'message:new') {
            const msg = parsed.payload.message as ChatMessage | undefined;
            if (!msg || !msg.id) return;
            setActiveSession((prev) => {
              if (!prev || prev.id !== sessionId) return prev;
              const existing = Array.isArray(prev.messages) ? prev.messages : [];
              if (existing.some((m) => m.id === msg.id)) return prev;
              return { ...prev, messages: [...existing, msg] };
            });
          } else if (parsed.event === 'quiz:submitted') {
            const messageId = parsed.payload.messageId as string;
            const quizSubmission = parsed.payload
              .quizSubmission as QuizSubmission;
            const feedbackMessage = parsed.payload
              .feedbackMessage as ChatMessage | undefined;
            setActiveSession((prev) => {
              if (!prev || prev.id !== sessionId) return prev;
              const existing = Array.isArray(prev.messages) ? prev.messages : [];
              const updatedMessages = existing.map((m) =>
                m.id === messageId ? { ...m, quizSubmission } : m
              );
              const withFeedback =
                feedbackMessage &&
                feedbackMessage.id &&
                !updatedMessages.some((m) => m.id === feedbackMessage.id)
                  ? [...updatedMessages, feedbackMessage]
                  : updatedMessages;
              return { ...prev, messages: withFeedback };
            });
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onclose = (ev) => {
        if (!closedByUser && ev.code !== 1008) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close error
        }
        wsRef.current = null;
      }
    };
  }, [token, activeSession?.id]);

  const handleCreateSession = async (payload: {
    subject: Subject;
    level: SkillLevel;
    title?: string;
  }) => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const data = await apiFetch<{ session: TutorSession }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setActiveSession(data.session);
      if (window.innerWidth >= 1024) setIsProgressOpen(true);
      setRecentSessions((prev) => [
        data.session,
        ...prev.filter((s) => s.id !== data.session.id),
      ]);
      replaceUrlSafely(`/?session=${data.session.id}`);
    } catch (err) {
      setSetupError(
        err instanceof Error ? err.message : 'Unable to create session.'
      );
    } finally {
      setSetupLoading(false);
    }
  };

  const handleJoinSessionFromSetup = async (sessionId: string) => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      await joinExistingSession(sessionId);
    } catch (err) {
      setSetupError(
        err instanceof Error ? err.message : 'Could not join that session.'
      );
    } finally {
      setSetupLoading(false);
    }
  };

  const handleScratchpadChange = (nextValue: string) => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    setActiveSession((prev) =>
      prev ? { ...prev, scratchpad: nextValue } : prev
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'scratchpad:edit',
          payload: { scratchpad: nextValue },
        })
      );
      return;
    }

    if (scratchpadTimerRef.current) {
      window.clearTimeout(scratchpadTimerRef.current);
    }
    scratchpadTimerRef.current = window.setTimeout(() => {
      void apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/scratchpad`, {
        method: 'PATCH',
        body: JSON.stringify({ scratchpad: nextValue }),
      }).catch(() => {});
    }, 350);
  };

  const handleChangeMode = async (mode: LearningMode) => {
    if (!activeSession) return;
    setActiveSession((prev) => (prev ? { ...prev, mode } : prev));
    try {
      await apiFetch(
        `/api/sessions/${encodeURIComponent(activeSession.id)}/mode`,
        {
          method: 'PATCH',
          body: JSON.stringify({ mode }),
        }
      );
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Could not switch learning mode.'
      );
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeSession) return;
    setChatSending(true);
    setChatError(null);

    const attachmentToSend =
      stagedAttachment ??
      (liveFeedActive ? latestLiveFrameRef.current : null) ??
      undefined;

    try {
      const data = await apiFetch<{
        studentMessage: ChatMessage;
        tutorMessage: ChatMessage;
        progress: UserProgress;
      }>(
        `/api/sessions/${encodeURIComponent(activeSession.id)}/message`,
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            mode: activeSession.mode,
            attachment: attachmentToSend,
          }),
        },
        undefined,
        45000
      );

      setActiveSession((prev) => {
        if (!prev) return prev;
        const msgs = Array.isArray(prev.messages) ? [...prev.messages] : [];
        if (data.studentMessage?.id && !msgs.some((m) => m.id === data.studentMessage.id)) {
          msgs.push(data.studentMessage);
        }
        if (data.tutorMessage?.id && !msgs.some((m) => m.id === data.tutorMessage.id)) {
          msgs.push(data.tutorMessage);
        }
        return {
          ...prev,
          currentConcept: data.tutorMessage?.conceptTag || prev.currentConcept,
          messages: msgs,
        };
      });
      if (data.progress) {
        setProgress(data.progress);
      }
      if (stagedAttachment) {
        setStagedAttachment(null);
      }
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Unable to send message.'
      );
    } finally {
      setChatSending(false);
    }
  };

  const handleSubmitQuiz = async (
    messageId: string,
    answers: Record<string, number>
  ) => {
    if (!activeSession) return;
    setQuizSubmitting(true);
    setChatError(null);
    try {
      const data = await apiFetch<{
        quizSubmission: QuizSubmission;
        feedbackMessage: ChatMessage;
        progress: UserProgress;
      }>(
        `/api/sessions/${encodeURIComponent(
          activeSession.id
        )}/quiz/${encodeURIComponent(messageId)}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers }),
        }
      );

      setActiveSession((prev) => {
        if (!prev) return prev;
        const existing = Array.isArray(prev.messages) ? prev.messages : [];
        const updatedMsgs = existing.map((m) =>
          m.id === messageId
            ? { ...m, quizSubmission: data.quizSubmission }
            : m
        );
        if (
          data.feedbackMessage?.id &&
          !updatedMsgs.some((m) => m.id === data.feedbackMessage.id)
        ) {
          updatedMsgs.push(data.feedbackMessage);
        }
        return { ...prev, messages: updatedMsgs };
      });
      if (data.progress) {
        setProgress(data.progress);
      }
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Could not grade quiz.'
      );
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleAddFlashcard = async (card: {
    front: string;
    back: string;
    topic: string;
    subject: Subject;
  }) => {
    try {
      const data = await apiFetch<{ progress: UserProgress }>(
        '/api/progress/flashcards',
        {
          method: 'POST',
          body: JSON.stringify(card),
        }
      );
      setProgress(data.progress);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Could not save flashcard.'
      );
      throw err;
    }
  };

  const handleDeleteFlashcard = async (cardId: string) => {
    try {
      const data = await apiFetch<{ progress: UserProgress }>(
        `/api/progress/flashcards/${encodeURIComponent(cardId)}`,
        { method: 'DELETE' }
      );
      setProgress(data.progress);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Could not delete flashcard.'
      );
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    setActiveSession(null);
    setRecentSessions([]);
    setStagedAttachment(null);
    setLiveFeedActive(false);
    replaceUrlSafely('/');
  };

  if (!user || !token) {
    return (
      <MotionConfig reducedMotion="user">
        <SignInView
          invitedSessionId={invitedSessionId}
          onAuthenticate={handleAuthenticate}
          isLoading={authLoading}
          errorMessage={authError}
        />
      </MotionConfig>
    );
  }

  const handleBackToSetup = () => {
    setActiveSession(null);
    setChatError(null);
    replaceUrlSafely('/');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen lg:h-screen flex flex-col text-slate-900">
        <TopBar
          hasSession={Boolean(activeSession)}
          hasRecentSession={recentSessions.length > 0}
          isProgressOpen={isProgressOpen}
          onNavigateWorkspace={() => {
            if (!activeSession && recentSessions.length > 0) {
              void handleJoinSessionFromSetup(recentSessions[0].id);
            } else {
              setMobilePane('chat');
            }
          }}
          onToggleProgress={() => {
            if (window.innerWidth < 1024 && activeSession) {
              setMobilePane((prev) => (prev === 'progress' ? 'chat' : 'progress'));
            } else {
              setIsProgressOpen((prev) => !prev);
            }
          }}
          onNewSession={handleBackToSetup}
          onOpenShare={() => setIsShareOpen(true)}
          onSignOut={handleSignOut}
        />

        <ErrorBoundary onReset={handleBackToSetup}>
          {!activeSession ? (
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 px-4 sm:px-6 py-4">
                <div className="flex-1 min-w-0">
                  <SessionSetupView
                    user={user}
                    recentSessions={recentSessions}
                    onCreateSession={handleCreateSession}
                    onJoinSession={handleJoinSessionFromSetup}
                    isLoading={setupLoading}
                    errorMessage={setupError}
                  />
                </div>
                {isProgressOpen && (
                  <div className="lg:pt-10">
                    <ProgressSidebar
                      progress={progress}
                      activeSubject="Math"
                      onAddFlashcard={handleAddFlashcard}
                      onDeleteFlashcard={handleDeleteFlashcard}
                      onClose={() => setIsProgressOpen(false)}
                    />
                  </div>
                )}
              </div>
            </main>
          ) : (
            <motion.main
              id="workspace"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-3 sm:gap-4"
            >
              {/* Mobile / Tablet single-tap pane switcher */}
              <div
                role="tablist"
                aria-label="Study room views"
                className="lg:hidden grid grid-cols-3 gap-1 p-1 bg-white/95 border border-blue-200 rounded-xl shadow-xs shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobilePane === 'notes'}
                  onClick={() => setMobilePane('notes')}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
                    mobilePane === 'notes'
                      ? 'bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] text-white shadow-xs'
                      : 'text-blue-900/75 hover:text-blue-950'
                  }`}
                >
                  Notes &amp; Camera
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobilePane === 'chat'}
                  onClick={() => setMobilePane('chat')}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
                    mobilePane === 'chat'
                      ? 'bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] text-white shadow-xs'
                      : 'text-blue-900/75 hover:text-blue-950'
                  }`}
                >
                  Tutor Chat
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobilePane === 'progress'}
                  onClick={() => setMobilePane('progress')}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
                    mobilePane === 'progress'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-blue-900/75 hover:text-blue-950'
                  }`}
                >
                  Progress ({progress.topics.length})
                </button>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  className={`${
                    mobilePane === 'notes' ? 'flex' : 'hidden'
                  } lg:block flex-col min-h-[460px] lg:min-h-0 h-full`}
                >
                  <StudyMaterialPane
                    subject={activeSession.subject}
                    scratchpad={activeSession.scratchpad}
                    onScratchpadChange={handleScratchpadChange}
                    stagedAttachment={stagedAttachment}
                    onStageAttachment={setStagedAttachment}
                    liveFeedActive={liveFeedActive}
                    onToggleLiveFeed={setLiveFeedActive}
                    onLiveFrameCapture={(frame) => {
                      latestLiveFrameRef.current = frame;
                    }}
                    onAskAboutNotes={() => {
                      setMobilePane('chat');
                      void handleSendMessage(
                        'Can we walk through what I wrote in my notes step by step?'
                      );
                    }}
                  />
                </div>
                <div
                  className={`${
                    mobilePane === 'chat' ? 'flex' : 'hidden'
                  } lg:block flex-col min-h-[520px] lg:min-h-0 h-full`}
                >
                  <TutorChatPane
                    session={activeSession}
                    currentUserId={user.id}
                    stagedAttachment={stagedAttachment}
                    onClearAttachment={() => setStagedAttachment(null)}
                    liveFeedActive={liveFeedActive}
                    onBackToSetup={handleBackToSetup}
                    onChangeMode={handleChangeMode}
                    onSendMessage={handleSendMessage}
                    onSubmitQuiz={handleSubmitQuiz}
                    onSaveFlashcard={handleAddFlashcard}
                    isSending={chatSending}
                    isSubmittingQuiz={quizSubmitting}
                    errorMessage={chatError}
                  />
                </div>
              </div>

              <div
                className={`${
                  mobilePane === 'progress' ? 'block' : 'hidden'
                } ${isProgressOpen ? 'lg:block' : 'lg:hidden'} min-h-[460px] lg:min-h-0 h-full shrink-0`}
              >
                <ProgressSidebar
                  progress={progress}
                  activeSubject={activeSession.subject}
                  onAddFlashcard={handleAddFlashcard}
                  onDeleteFlashcard={handleDeleteFlashcard}
                  onPracticeTopic={(topic) => {
                    setMobilePane('chat');
                    void handleSendMessage(
                      `Let's review "${topic}" together step by step.`
                    );
                  }}
                  onClose={() => {
                    setIsProgressOpen(false);
                    setMobilePane('chat');
                  }}
                />
              </div>
            </motion.main>
          )}
        </ErrorBoundary>

        <AnimatePresence>
          {isShareOpen && activeSession && (
            <ShareSessionModal
              session={activeSession}
              onClose={() => setIsShareOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
