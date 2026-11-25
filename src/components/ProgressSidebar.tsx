import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookCheck, Layers, Plus, RotateCw, Trash2, X } from 'lucide-react';
import type { Subject, UserProgress } from '../shared/types';

interface ProgressSidebarProps {
  progress: UserProgress;
  activeSubject: Subject;
  onAddFlashcard: (card: {
    front: string;
    back: string;
    topic: string;
    subject: Subject;
  }) => Promise<void>;
  onDeleteFlashcard: (cardId: string) => Promise<void>;
  onPracticeTopic?: (topic: string) => void;
  onClose: () => void;
}

type SidebarSection = 'all' | 'topics' | 'cards';

export const ProgressSidebar: React.FC<ProgressSidebarProps> = ({
  progress,
  activeSubject,
  onAddFlashcard,
  onDeleteFlashcard,
  onPracticeTopic,
  onClose,
}) => {
  const [section, setSection] = useState<SidebarSection>('all');
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [topic, setTopic] = useState('');

  const mastered = progress.topics.filter((t) => t.status === 'mastered');
  const review = progress.topics.filter((t) => t.status === 'review');

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    try {
      await onAddFlashcard({
        front: front.trim(),
        back: back.trim(),
        topic: topic.trim() || activeSubject,
        subject: activeSubject,
      });
      setFront('');
      setBack('');
      setTopic('');
      setShowAddForm(false);
    } catch {
      // Handled by parent error state
    }
  };

  return (
    <aside
      aria-label="Learning progress dashboard"
      className="w-full lg:w-80 xl:w-96 bg-white/95 border border-blue-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden shrink-0"
    >
      <div className="px-4 py-3 border-b border-blue-200/80 bg-gradient-to-r from-[#eff6ff] via-[#f0f9ff] to-[#eef2ff] flex items-center justify-between gap-2 shrink-0">
        <h2 className="font-display text-sm font-semibold text-[#0f294d]">
          My Progress
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close progress sidebar"
          className="p-1 text-blue-700 hover:text-blue-950 rounded-md hover:bg-blue-100/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-blue-100 bg-white shrink-0">
        <div
          role="tablist"
          aria-label="Progress sections"
          className="grid grid-cols-3 gap-1 p-1 bg-blue-100/80 rounded-lg"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'topics', label: `Topics (${progress.topics.length})` },
              { id: 'cards', label: `Cards (${progress.flashcards.length})` },
            ] as const
          ).map(({ id, label }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(id)}
                className={`relative px-2 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'text-white'
                    : 'text-blue-900/75 hover:text-blue-950'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="progress-section-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] shadow-sm"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-white to-[#f6faff]">
        {(section === 'all' || section === 'topics') && (
          <>
            {/* Topics Mastered */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-teal-950 flex items-center gap-1.5">
                  <BookCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Topics Mastered</span>
                </h3>
                <span className="text-xs text-teal-700 font-semibold tabular-nums">
                  {mastered.length}
                </span>
              </div>

              {mastered.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Finish a quick quiz or solve problems to build mastery.
                </p>
              ) : (
                <ul className="space-y-2">
                  {mastered.map((t) => (
                    <motion.li
                      key={t.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 rounded-lg bg-teal-50/90 border border-teal-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-teal-950 truncate">
                          {t.topic}
                        </p>
                        <p className="text-[11px] text-teal-800/80">{t.subject}</p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums shrink-0">
                        {t.masteryScore}%
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </section>

            {/* Topics That Need Review */}
            <section className="space-y-2.5 pt-4 border-t border-blue-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                  <span>Needs Review</span>
                </h3>
                <span className="text-xs text-amber-700 font-semibold tabular-nums">
                  {review.length}
                </span>
              </div>

              {review.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Any tricky topics from your chat or quizzes will show up here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {review.map((t) => (
                    <motion.li
                      key={t.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 rounded-lg bg-amber-50/85 border border-amber-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-950 truncate">
                          {t.topic}
                        </p>
                        <p className="text-[11px] text-amber-800/80">{t.subject}</p>
                      </div>
                      {onPracticeTopic && (
                        <button
                          type="button"
                          onClick={() => onPracticeTopic(t.topic)}
                          className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
                        >
                          Practice
                        </button>
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Saved Study Flashcards */}
        {(section === 'all' || section === 'cards') && (
          <section
            className={`space-y-3 ${
              section === 'all' ? 'pt-4 border-t border-blue-100' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#0f294d] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Flashcards</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddForm ? 'Cancel' : 'Add Card'}</span>
              </button>
            </div>

            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  onSubmit={handleCreateCard}
                  className="p-3 rounded-lg bg-sky-50/80 border border-sky-200 space-y-2"
                >
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Topic (optional)"
                    aria-label="Flashcard topic"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    placeholder="Front (question or term)"
                    aria-label="Flashcard front"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:outline-none focus:border-blue-500"
                  />
                  <textarea
                    rows={2}
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    placeholder="Back (key idea or rule)"
                    aria-label="Flashcard back"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-md resize-none focus:outline-none focus:border-blue-500"
                  />
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] rounded-md"
                  >
                    Save Flashcard
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            {progress.flashcards.length === 0 ? (
              <p className="text-xs text-slate-500">
                Save cards from tutor tips or add your own above.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {progress.flashcards.map((card) => {
                  const flipped = Boolean(flippedIds[card.id]);
                  return (
                    <motion.li
                      key={card.id}
                      whileHover={{ y: -1 }}
                      className={`rounded-lg border p-3 space-y-2 transition-colors ${
                        flipped
                          ? 'border-sky-300 bg-sky-50/80'
                          : 'border-blue-200 bg-[#f4f9ff]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">
                          {card.topic} · {card.subject}
                        </span>
                        <button
                          type="button"
                          onClick={() => void onDeleteFlashcard(card.id)}
                          aria-label={`Delete flashcard ${card.front}`}
                          className="p-1 text-slate-400 hover:text-red-700 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFlip(card.id)}
                        className="w-full text-left text-xs text-slate-900 leading-relaxed"
                      >
                        <motion.div
                          key={flipped ? 'back' : 'front'}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16 }}
                        >
                          <span
                            className={`block font-semibold mb-0.5 ${
                              flipped ? 'text-teal-700' : 'text-blue-700'
                            }`}
                          >
                            {flipped ? 'Answer' : 'Question (click to flip)'}
                          </span>
                          <span>{flipped ? card.back : card.front}</span>
                        </motion.div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </aside>
  );
};
