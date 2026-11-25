import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Compass,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import { getDefaultQuickReplies, LEARNING_MODES } from '../shared/tutorLogic';
import type {
  LearningMode,
  Subject,
  TutorAttachment,
  TutorSession,
} from '../shared/types';
import { ConceptDiagramView } from './ConceptDiagramView';
import { PracticeQuizCard } from './PracticeQuizCard';

interface TutorChatPaneProps {
  session: TutorSession;
  currentUserId: string;
  stagedAttachment: TutorAttachment | null;
  onClearAttachment: () => void;
  liveFeedActive: boolean;
  onBackToSetup: () => void;
  onChangeMode: (mode: LearningMode) => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onSubmitQuiz: (
    messageId: string,
    answers: Record<string, number>
  ) => Promise<void>;
  onSaveFlashcard: (card: {
    front: string;
    back: string;
    topic: string;
    subject: Subject;
  }) => Promise<void>;
  isSending: boolean;
  isSubmittingQuiz: boolean;
  errorMessage: string | null;
}

const THINKING_STEPS: Record<LearningMode, string[]> = {
  socratic: [
    'Reading what you shared...',
    'Finding the key idea...',
    'Shaping a helpful next step...',
  ],
  explainer: [
    'Breaking the idea down...',
    'Picking a clear example...',
    'Sketching a visual chart...',
  ],
  quiz: [
    'Reviewing your topic and notes...',
    'Writing practice questions...',
    'Checking answer choices...',
  ],
};

const TutorThinkingIndicator: React.FC<{ mode: LearningMode }> = ({ mode }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = THINKING_STEPS[mode];

  useEffect(() => {
    setStepIdx(0);
    const timer = window.setInterval(() => {
      setStepIdx((prev) => (prev + 1) % steps.length);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [mode, steps.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      role="status"
      aria-live="polite"
      className="flex items-start"
    >
      <div className="w-full max-w-sm bg-gradient-to-br from-[#eff6ff] via-[#e0f2fe] to-[#eef2ff] border border-blue-200 rounded-xl p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm"
            >
              <Compass className="w-4 h-4" />
            </motion.div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#13315c]">
                Abundant Knowledge is thinking
              </p>
              <motion.p
                key={steps[stepIdx]}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-blue-800"
              >
                {steps[stepIdx]}
              </motion.p>
            </div>
          </div>

          {/* Animated sound/thought wave bars */}
          <div className="flex items-end gap-1 h-5 shrink-0" aria-hidden="true">
            {[0, 1, 2, 3].map((bar) => (
              <motion.span
                key={bar}
                animate={{
                  scaleY: [0.35, 1, 0.45],
                  opacity: [0.55, 1, 0.55],
                }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: bar * 0.14,
                  ease: 'easeInOut',
                }}
                className="w-1 h-4 rounded-full bg-gradient-to-t from-blue-600 to-sky-400 origin-bottom"
              />
            ))}
          </div>
        </div>

        {/* Flowing blue progress sweep */}
        <div className="h-1.5 w-full rounded-full bg-blue-200/70 overflow-hidden">
          <motion.div
            animate={{ x: ['-45%', '115%'] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-400 via-blue-600 to-indigo-500"
          />
        </div>
      </div>
    </motion.div>
  );
};

function renderFormattedProse(text: unknown): React.ReactNode {
  if (typeof text !== 'string' || !text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="font-mono text-[0.9em] px-1 py-0.5 rounded bg-blue-100/80 text-blue-950"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const TutorChatPane: React.FC<TutorChatPaneProps> = ({
  session,
  currentUserId,
  stagedAttachment,
  onClearAttachment,
  liveFeedActive,
  onBackToSetup,
  onChangeMode,
  onSendMessage,
  onSubmitQuiz,
  onSaveFlashcard,
  isSending,
  isSubmittingQuiz,
  errorMessage,
}) => {
  const [draft, setDraft] = useState('');
  const [savedCardIds, setSavedCardIds] = useState<Record<string, boolean>>({});
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const messages = Array.isArray(session.messages) ? session.messages : [];
  const participants = Array.isArray(session.participants)
    ? session.participants
    : [];

  useEffect(() => {
    try {
      scrollEndRef.current?.scrollIntoView({ block: 'end' });
    } catch {
      // Ignore scroll edge cases
    }
  }, [messages.length, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!draft.trim() && !stagedAttachment) || isSending) return;
    const text = draft.trim();
    setDraft('');
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const handleSaveCard = async (
    msgId: string,
    card: { front: string; back: string; topic: string }
  ) => {
    try {
      await onSaveFlashcard({
        ...card,
        subject: session.subject,
      });
      setSavedCardIds((prev) => ({ ...prev, [msgId]: true }));
    } catch {
      // Error surfaced via parent handler
    }
  };

  const activeCount = participants.filter((p) => p.online).length;

  return (
    <section
      aria-label="Tutor conversation"
      className="flex flex-col h-full bg-white/95 border border-blue-200 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Mode Switcher & Session Context Header */}
      <div className="px-4 py-3 border-b border-blue-200/80 bg-gradient-to-r from-[#eff6ff] via-[#f0f9ff] to-[#eef2ff] space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <motion.button
              type="button"
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={onBackToSetup}
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Subject</span>
            </motion.button>
            <span aria-hidden="true" className="text-blue-200">|</span>
            <span className="font-semibold text-[#0f294d] whitespace-nowrap">
              {session.subject}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{session.level}</span>
            <span className="text-blue-800/75 whitespace-nowrap tabular-nums">
              ({activeCount} {activeCount === 1 ? 'person' : 'people'} here)
            </span>
          </div>
          {session.currentConcept && (
            <span className="text-xs text-teal-800 font-semibold">
              Topic: {session.currentConcept}
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="Learning mode"
          className="grid grid-cols-3 gap-1 p-1 bg-blue-100/80 rounded-lg"
        >
          {LEARNING_MODES.map((m) => {
            const active = session.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => void onChangeMode(m.id)}
                aria-pressed={active}
                title={m.shortDesc}
                className={`relative px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
                  active
                    ? 'text-white'
                    : 'text-blue-900/75 hover:text-blue-950'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tutor-mode-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] shadow-sm"
                  />
                )}
                <span className="relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5 space-y-5 bg-gradient-to-b from-white to-[#f6faff]">
        {messages.map((msg, msgIdx) => {
            const isStudent = msg.role === 'student';
            const isSelf = msg.senderId === currentUserId;
            const cardSaved = Boolean(savedCardIds[msg.id]);
            const hasActiveQuiz =
              Boolean(msg.quiz && msg.quiz.length > 0 && !msg.quizSubmission);
            const isLatestTutor =
              !isStudent && msgIdx === messages.length - 1;
            const replyOptions =
              !isStudent && isLatestTutor && !isSending && !hasActiveQuiz
                ? msg.quickReplies && msg.quickReplies.length > 0
                  ? msg.quickReplies
                  : getDefaultQuickReplies(msg.mode, session.subject)
                : [];

            return (
              <motion.article
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col ${
                  isStudent ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 px-1">
                  <span className="font-semibold text-[#13315c]">
                    {isStudent
                      ? isSelf
                        ? `${msg.senderName} (You)`
                        : msg.senderName
                      : 'Abundant Knowledge'}
                  </span>
                  {msg.conceptTag && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-teal-700 font-medium">{msg.conceptTag}</span>
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    isStudent
                      ? 'bg-gradient-to-br from-[#1d4ed8] to-[#0284c7] text-white shadow-sm'
                      : 'bg-[#eff6ff] border border-blue-200/90 text-slate-900 shadow-xs'
                  }`}
                >
                  {msg.attachment && (
                    <div className="mb-2.5 pb-2.5 border-b border-white/20">
                      {msg.attachment.dataUrl &&
                      msg.attachment.mimeType?.startsWith('image/') ? (
                        <img
                          src={msg.attachment.dataUrl}
                          alt={msg.attachment.name}
                          className="max-h-44 rounded-lg object-contain bg-white/95"
                        />
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs opacity-95">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{msg.attachment.name}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">
                    {renderFormattedProse(msg.content)}
                  </p>

                  {!isStudent && !hasActiveQuiz && msg.guidingQuestion && (
                    <div
                      data-testid="guiding-question-box"
                      className="mt-3 p-3 rounded-lg bg-white/95 border border-sky-200 shadow-xs"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1">
                        Your turn
                      </p>
                      <p className="text-sm font-medium text-[#0f294d] leading-snug">
                        {renderFormattedProse(msg.guidingQuestion)}
                      </p>
                    </div>
                  )}

                  {msg.diagram && <ConceptDiagramView diagram={msg.diagram} />}

                  {msg.quiz && msg.quiz.length > 0 && (
                    <PracticeQuizCard
                      messageId={msg.id}
                      questions={msg.quiz}
                      submission={msg.quizSubmission}
                      onSubmitQuiz={onSubmitQuiz}
                      isSubmitting={isSubmittingQuiz}
                    />
                  )}

                  {!isStudent && msg.suggestedFlashcard && (
                    <div className="mt-3 pt-2.5 border-t border-blue-200/70 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-700 truncate">
                        Flashcard: {msg.suggestedFlashcard.front}
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        disabled={cardSaved}
                        onClick={() =>
                          void handleSaveCard(msg.id, msg.suggestedFlashcard!)
                        }
                        className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:text-teal-700 disabled:no-underline"
                      >
                        {cardSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            <span>Save Flashcard</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  )}
                </div>

                {replyOptions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="mt-2.5 max-w-[92%] sm:max-w-[85%] space-y-1.5"
                    aria-label="Quick response prompts"
                  >
                    <p className="text-[11px] font-medium text-blue-800/80 px-0.5">
                      Tap a quick reply or type your own below:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {replyOptions.map((option, optIdx) => (
                        <motion.button
                          key={`${option}-${optIdx}`}
                          type="button"
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.97 }}
                          disabled={isSending}
                          onClick={() => void onSendMessage(option)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-400 text-xs font-medium text-[#0f294d] text-left transition-colors shadow-xs disabled:opacity-50"
                        >
                          {option}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.article>
            );
          })}

        {isSending && <TutorThinkingIndicator mode={session.mode} />}
        <div ref={scrollEndRef} />
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div
          role="alert"
          className="mx-4 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 shrink-0"
        >
          {errorMessage}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 sm:p-4 border-t border-blue-200/80 bg-[#f4f9ff] space-y-2.5 shrink-0"
      >
        {(stagedAttachment || liveFeedActive) && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-sky-100/70 border border-sky-200 text-xs text-sky-950">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span className="truncate">
                {stagedAttachment
                  ? stagedAttachment.name
                  : 'Live camera frame will be included'}
              </span>
            </div>
            {stagedAttachment && (
              <button
                type="button"
                onClick={onClearAttachment}
                aria-label="Detach study material"
                className="p-0.5 text-sky-700 hover:text-sky-950"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <label htmlFor="tutor-chat-input" className="sr-only">
            Ask a question or share your next step
          </label>
          <textarea
            id="tutor-chat-input"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              session.mode === 'socratic'
                ? 'Type a question or share what you think the first step is...'
                : session.mode === 'explainer'
                  ? 'Ask what topic you want explained with a simple example...'
                  : 'Ask for a quick 3-to-5 question quiz on this topic...'
            }
            className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-blue-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            disabled={isSending || (!draft.trim() && !stagedAttachment)}
            aria-label="Send message"
            className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 disabled:opacity-50 shadow-sm"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Enter to send · Shift+Enter for new line</span>
          {session.mode === 'quiz' && (
            <button
              type="button"
              disabled={isSending}
              onClick={() =>
                void onSendMessage(
                  'Make a 4-question quick quiz about our current topic and notes.'
                )
              }
              className="text-blue-700 font-semibold hover:underline"
            >
              Make Quick Quiz
            </button>
          )}
        </div>
      </form>
    </section>
  );
};
