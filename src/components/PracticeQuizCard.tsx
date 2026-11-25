import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import type { QuizQuestion, QuizSubmission } from '../shared/types';

interface PracticeQuizCardProps {
  messageId: string;
  questions: QuizQuestion[];
  submission?: QuizSubmission;
  onSubmitQuiz: (
    messageId: string,
    answers: Record<string, number>
  ) => Promise<void>;
  isSubmitting: boolean;
}

export const PracticeQuizCard: React.FC<PracticeQuizCardProps> = ({
  messageId,
  questions,
  submission,
  onSubmitQuiz,
  isSubmitting,
}) => {
  const [selected, setSelected] = useState<Record<string, number>>(
    submission?.answers ?? {}
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAllReview, setShowAllReview] = useState(false);

  const safeQuestions = Array.isArray(questions) ? questions : [];
  const answersMap = submission ? submission.answers : selected;
  const answeredCount = safeQuestions.filter(
    (q) => typeof answersMap[q.id] === 'number'
  ).length;
  const allAnswered =
    safeQuestions.length > 0 && answeredCount === safeQuestions.length;
  const safeIdx = Math.min(currentIdx, Math.max(0, safeQuestions.length - 1));
  const isLast = safeIdx === safeQuestions.length - 1;
  const isGraded = Boolean(submission);

  const handleSelect = (questionId: string, optionIdx: number) => {
    if (submission) return;
    setSelected((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered || submission || isSubmitting) return;
    await onSubmitQuiz(messageId, selected);
  };

  const renderQuestionCard = (q: QuizQuestion, qIndex: number) => {
    const chosen = answersMap[q.id];
    const isCorrect = isGraded && chosen === q.correctIndex;

    return (
      <div className="p-3.5 rounded-lg bg-white border border-blue-200/90 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[#0f294d] leading-snug">
            <span className="font-mono text-xs text-blue-600 mr-1.5 tabular-nums">
              Q{qIndex + 1}.
            </span>
            {q.question}
          </p>
          <span className="text-xs text-blue-700/80 whitespace-nowrap shrink-0">
            {q.concept}
          </span>
        </div>

        <div className="space-y-1.5">
          {(Array.isArray(q.options) ? q.options : []).map((opt, optIdx) => {
            const isPicked = chosen === optIdx;
            const isRightOpt = q.correctIndex === optIdx;

            let rowClass =
              'border-blue-100 bg-[#f8fbff] hover:bg-blue-50 text-slate-800';
            if (isGraded) {
              if (isRightOpt) {
                rowClass =
                  'border-teal-500 bg-teal-50 text-teal-950 font-medium';
              } else if (isPicked && !isRightOpt) {
                rowClass = 'border-amber-400 bg-amber-50 text-amber-950';
              }
            } else if (isPicked) {
              rowClass =
                'border-blue-600 bg-blue-100/80 text-blue-950 font-semibold';
            }

            return (
              <motion.button
                key={optIdx}
                type="button"
                whileTap={isGraded ? undefined : { scale: 0.99 }}
                disabled={isGraded}
                onClick={() => handleSelect(q.id, optIdx)}
                aria-pressed={isPicked}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs sm:text-sm transition-colors flex items-center justify-between gap-2 ${rowClass}`}
              >
                <span>{opt}</span>
                {isGraded && isRightOpt && (
                  <span className="inline-flex items-center gap-1 text-xs text-teal-700 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Correct</span>
                  </span>
                )}
                {isGraded && isPicked && !isRightOpt && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-800 shrink-0">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Review</span>
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {isGraded && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-slate-700 pt-1 border-t border-blue-100 leading-relaxed"
          >
            {isCorrect ? 'Well reasoned — ' : 'Here is why: '}
            {q.explanation}
          </motion.p>
        )}
      </div>
    );
  };

  if (safeQuestions.length === 0) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50/70 border border-sky-200 space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-[#0f294d]">
            Quick Quiz
          </span>
          <span className="text-xs text-blue-800/80 tabular-nums">
            {showAllReview
              ? `${safeQuestions.length} questions`
              : `Question ${safeIdx + 1} of ${safeQuestions.length}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {submission && (
            <>
              <span className="text-xs font-semibold text-teal-700 tabular-nums">
                Score: {submission.score}/{submission.total}
              </span>
              <button
                type="button"
                onClick={() => setShowAllReview((prev) => !prev)}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                {showAllReview ? 'One by One' : 'View All'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Step selector dots / numbers */}
      {!showAllReview && safeQuestions.length > 1 && (
        <div className="flex items-center gap-1.5" role="group" aria-label="Quiz question steps">
          {safeQuestions.map((q, idx) => {
            const isCurrent = idx === safeIdx;
            const isDone = typeof answersMap[q.id] === 'number';
            const wasRight = isGraded && answersMap[q.id] === q.correctIndex;
            let stepStyle =
              'bg-white border-blue-200 text-slate-600 hover:border-blue-400';
            if (isGraded) {
              stepStyle = wasRight
                ? 'bg-teal-100 border-teal-400 text-teal-900'
                : 'bg-amber-100 border-amber-400 text-amber-900';
            } else if (isCurrent) {
              stepStyle =
                'bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] border-blue-700 text-white shadow-xs';
            } else if (isDone) {
              stepStyle = 'bg-blue-100 border-blue-300 text-blue-900';
            }

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                aria-label={`Question ${idx + 1}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`h-7 min-w-[28px] px-2 rounded-md border text-xs font-semibold tabular-nums transition-colors ${stepStyle} ${
                  isCurrent && isGraded ? 'ring-2 ring-blue-500/40' : ''
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
          <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
            {answeredCount}/{safeQuestions.length} answered
          </span>
        </div>
      )}

      {/* One question at a time (or all when View All toggled after grading) */}
      {showAllReview ? (
        <div className="space-y-3">
          {safeQuestions.map((q, idx) => (
            <React.Fragment key={q.id || idx}>
              {renderQuestionCard(q, idx)}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <motion.div
          key={safeQuestions[safeIdx]?.id ?? safeIdx}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16 }}
        >
          {renderQuestionCard(safeQuestions[safeIdx], safeIdx)}
        </motion.div>
      )}

      {/* Navigation & Submit Footer */}
      {!showAllReview && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={safeIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 inline-flex items-center gap-1 disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {!isLast && (
              <button
                type="button"
                onClick={() =>
                  setCurrentIdx((i) => Math.min(safeQuestions.length - 1, i + 1))
                }
                className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-950 inline-flex items-center gap-1 transition-colors"
              >
                <span>Next Question</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {!submission && (isLast || allAnswered) && (
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={!allAnswered || isSubmitting}
                className="min-h-[38px] px-4 py-1.5 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? 'Checking...' : 'Check My Answers'}
              </motion.button>
            )}
          </div>
        </div>
      )}
    </form>
  );
};

