import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BookOpen, Clock, Users } from 'lucide-react';
import {
  sanitizeSessionCode,
  SKILL_LEVELS,
  SUBJECTS,
} from '../shared/tutorLogic';
import type {
  SkillLevel,
  Subject,
  TutorSession,
  UserProfile,
} from '../shared/types';

interface SessionSetupViewProps {
  user: UserProfile;
  recentSessions: TutorSession[];
  onCreateSession: (payload: {
    subject: Subject;
    level: SkillLevel;
    title?: string;
  }) => Promise<void>;
  onJoinSession: (sessionId: string) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

const SUBJECT_DESCRIPTIONS: Record<Subject, string> = {
  Math: 'Algebra, fractions, geometry, and calculus',
  Science: 'Biology, chemistry, physics, and labs',
  Writing: 'Essays, paragraphs, and clear writing',
  Coding: 'Python, JavaScript, bugs, and logic',
  Language: 'Grammar, reading, and translation',
  History: 'Events, timelines, and key ideas',
};

const SUBJECT_ACCENTS: Record<
  Subject,
  { idle: string; active: string; tag: string }
> = {
  Math: {
    idle: 'border-blue-200/80 bg-blue-50/45 hover:bg-blue-50/80 hover:border-blue-300',
    active: 'border-blue-600 bg-gradient-to-br from-blue-50 to-sky-100/80 ring-2 ring-blue-500/20',
    tag: 'text-blue-700',
  },
  Science: {
    idle: 'border-teal-200/80 bg-teal-50/45 hover:bg-teal-50/80 hover:border-teal-300',
    active: 'border-teal-600 bg-gradient-to-br from-teal-50 to-cyan-100/70 ring-2 ring-teal-500/20',
    tag: 'text-teal-700',
  },
  Writing: {
    idle: 'border-indigo-200/80 bg-indigo-50/45 hover:bg-indigo-50/80 hover:border-indigo-300',
    active: 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-blue-100/70 ring-2 ring-indigo-500/20',
    tag: 'text-indigo-700',
  },
  Coding: {
    idle: 'border-sky-200/80 bg-sky-50/45 hover:bg-sky-50/80 hover:border-sky-300',
    active: 'border-sky-600 bg-gradient-to-br from-sky-50 to-blue-100/80 ring-2 ring-sky-500/20',
    tag: 'text-sky-700',
  },
  Language: {
    idle: 'border-cyan-200/80 bg-cyan-50/45 hover:bg-cyan-50/80 hover:border-cyan-300',
    active: 'border-cyan-600 bg-gradient-to-br from-cyan-50 to-sky-100/70 ring-2 ring-cyan-500/20',
    tag: 'text-cyan-700',
  },
  History: {
    idle: 'border-amber-200/80 bg-amber-50/40 hover:bg-amber-50/75 hover:border-amber-300',
    active: 'border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50/70 ring-2 ring-amber-500/20',
    tag: 'text-amber-700',
  },
};

export const SessionSetupView: React.FC<SessionSetupViewProps> = ({
  user,
  recentSessions,
  onCreateSession,
  onJoinSession,
  isLoading,
  errorMessage,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject>('Math');
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>('High School');
  const [sessionTitle, setSessionTitle] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateSession({
      subject: selectedSubject,
      level: selectedLevel,
      title: sessionTitle.trim() || undefined,
    });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = sanitizeSessionCode(joinInput);
    if (!cleanId) {
      setJoinError('Enter a valid number code (digits only) or shareable session link.');
      return;
    }
    setJoinError(null);
    await onJoinSession(cleanId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-5xl mx-auto px-6 py-6 space-y-6"
    >
      <div className="space-y-1.5">
        <p className="text-sm text-blue-800/80 font-medium">
          Signed in as {user.name}
          {user.email ? ` · ${user.email}` : ' · Guest session'}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f294d]">
          Pick what to study
        </h1>
        <p className="text-sm sm:text-base text-slate-700 max-w-2xl">
          Choose your subject and grade level so your tutor explains things in a
          way that fits you.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleStart}
          className="lg:col-span-8 bg-white/95 border border-blue-200 rounded-xl shadow-sm overflow-hidden"
        >
          <div className="h-1.5 bg-gradient-to-r from-[#1d4ed8] via-sky-500 to-teal-500" />
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[#0f294d]">
                1. Pick a subject
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUBJECTS.map((subject, idx) => {
                  const active = selectedSubject === subject;
                  const palette = SUBJECT_ACCENTS[subject];
                  return (
                    <motion.button
                      key={subject}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: idx * 0.03 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => setSelectedSubject(subject)}
                      aria-pressed={active}
                      className={`text-left p-4 rounded-xl border transition-colors text-slate-900 ${
                        active ? palette.active : palette.idle
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-semibold text-sm">
                          {subject}
                        </span>
                        {active && (
                          <span className={`text-xs font-semibold ${palette.tag}`}>
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {SUBJECT_DESCRIPTIONS[subject]}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[#0f294d]">
                2. Pick your grade or level
              </label>
              <div className="flex flex-wrap gap-2.5">
                {SKILL_LEVELS.map((level) => {
                  const active = selectedLevel === level;
                  return (
                    <motion.button
                      key={level}
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedLevel(level)}
                      aria-pressed={active}
                      className={`min-h-[44px] flex-1 min-w-fit px-4 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'border-blue-700 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] text-white shadow-sm'
                          : 'border-blue-200 bg-[#f8fbff] hover:bg-blue-50 hover:border-blue-300 text-slate-700'
                      }`}
                    >
                      {level}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="session-topic-input"
                className="block text-sm font-semibold text-[#0f294d]"
              >
                3. What are you working on? (optional)
              </label>
              <input
                id="session-topic-input"
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g., Fractions, Essay outline, Python loops"
                className="w-full px-3.5 py-2.5 text-sm bg-[#f8fbff] border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
              />
            </div>

            <div className="pt-3 flex items-center justify-between gap-4 border-t border-blue-100">
              <span className="text-xs text-slate-600">
                {selectedSubject} · {selectedLevel} · Step-by-Step mode
              </span>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={isLoading}
                className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 disabled:opacity-60 shadow-sm"
              >
                <span>{isLoading ? 'Starting...' : 'Start Learning'}</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </form>

        <aside className="lg:col-span-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.08 }}
            className="bg-gradient-to-b from-sky-50/90 to-white border border-sky-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0f294d]">
              <Users className="w-4 h-4 text-sky-600" />
              <h2>Join a study room</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Got a number code or link from a friend, parent, or tutor? Enter it
              here to study together.
            </p>
            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label htmlFor="join-session-code" className="sr-only">
                  Room number code or link
                </label>
                <input
                  id="join-session-code"
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="Enter 6-digit code (e.g. 482910) or link"
                  className="w-full px-3 py-2 text-sm bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
                />
                {joinError && (
                  <p className="text-xs text-red-700 mt-1.5">{joinError}</p>
                )}
              </div>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
                className="w-full min-h-[40px] px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-950 text-sm font-medium rounded-lg transition-colors"
              >
                Join Room
              </motion.button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.14 }}
            className="bg-gradient-to-b from-blue-50/80 to-white border border-blue-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0f294d]">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2>Recent sessions</h2>
            </div>
            {recentSessions.length === 0 ? (
              <p className="text-xs text-slate-600">
                Your past sessions will show up here so you can jump back in anytime.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentSessions.slice(0, 5).map((sess) => (
                  <li key={sess.id}>
                    <motion.button
                      type="button"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onJoinSession(sess.id)}
                      className="w-full text-left p-3 rounded-lg border border-blue-200/80 bg-white hover:border-blue-400 hover:bg-blue-50/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#0f294d] truncate">
                          {sess.title}
                        </span>
                        <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {sess.subject} · {sess.level} ·{' '}
                        <span className="tabular-nums">
                          {sess.messages.length}
                        </span>{' '}
                        messages
                      </p>
                    </motion.button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </aside>
      </div>
    </motion.div>
  );
};
