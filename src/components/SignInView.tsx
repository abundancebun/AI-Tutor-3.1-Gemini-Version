import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BookOpen, Compass, Users } from 'lucide-react';
import { validateAuthInput } from '../shared/tutorLogic';
import type { AuthProvider } from '../shared/types';

interface SignInViewProps {
  invitedSessionId: string | null;
  onAuthenticate: (payload: {
    provider: AuthProvider;
    name?: string;
    email?: string;
  }) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

export const SignInView: React.FC<SignInViewProps> = ({
  invitedSessionId,
  onAuthenticate,
  isLoading,
  errorMessage,
}) => {
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    const check = validateAuthInput({
      provider: activeProvider,
      name,
      email,
    });
    if (!check.valid) {
      setLocalError(check.error || 'Please check your name and email.');
      return;
    }
    setLocalError(null);
    await onAuthenticate({
      provider: activeProvider,
      name: check.normalizedName,
      email: check.normalizedEmail,
    });
  };

  const handleGuest = async () => {
    setLocalError(null);
    await onAuthenticate({ provider: 'guest', name: 'Guest Learner' });
  };

  const displayError = localError || errorMessage;

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">
      <header className="w-full bg-gradient-to-r from-[#13315c] via-[#1a437a] to-[#174c86] text-white border-b border-blue-900/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0">
            Abundant Knowledge
          </span>
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm text-blue-100"
          >
            <a
              href="#approach"
              className="hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#modes"
              className="hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Study Modes
            </a>
            <a
              href="#shared"
              className="hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Study Together
            </a>
          </nav>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleGuest}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-[#0f294d] bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 shadow-sm"
          >
            Continue as Guest
          </motion.button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 flex flex-col justify-between gap-7"
        >
          <div className="space-y-4">
            <p className="text-sm font-semibold text-blue-700">
              Step-by-step help · All subjects &amp; grades
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold leading-[1.15] tracking-tight text-[#0f294d] max-w-xl">
              Learn step by step.
            </h1>
            <p className="text-base text-slate-700 leading-relaxed max-w-lg">
              Share a math problem, science question, essay draft, or code bug.
              Abundant Knowledge walks you through each step with clear hints
              instead of just handing out the final answer.
            </p>
          </div>

          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative rounded-xl overflow-hidden border border-blue-200/90 bg-white shadow-sm aspect-[4/3] w-full"
          >
            {!imgFailed ? (
              <img
                src="/src/assets/images/study_desk_illustration_1795482599019.jpg"
                alt="Open notebook, navy fountain pen, and brass compass on a sunlit study desk"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-50 to-sky-100 flex flex-col items-center justify-center p-8 text-center">
                <BookOpen className="w-10 h-10 text-blue-700 mb-3" />
                <p className="text-sm font-medium text-slate-800">
                  Focused study desk
                </p>
              </div>
            )}
          </motion.div>

          <div
            id="approach"
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1"
          >
            <motion.div
              id="modes"
              whileHover={{ y: -2 }}
              className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200/80 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#13315c]">
                <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Step-by-Step Hints</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Simple questions and hints matched to your grade level.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              className="p-3.5 rounded-xl bg-teal-50/90 border border-teal-200/80 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Diagrams &amp; Quizzes</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Switch between clear examples, visual charts, and quick quizzes.
              </p>
            </motion.div>

            <motion.div
              id="shared"
              whileHover={{ y: -2 }}
              className="p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-200/80 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Study Together</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Share a link so a parent, friend, or tutor can join your room.
              </p>
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 flex items-center justify-center"
        >
          <div className="w-full max-w-md bg-white/95 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#1d4ed8] via-sky-500 to-teal-500" />
            <div className="p-8 space-y-6">
              {invitedSessionId && (
                <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-950">
                  You&apos;re invited to study room{' '}
                  <span className="font-mono font-semibold text-blue-800">{invitedSessionId}</span>.
                  Sign in or continue as guest to join.
                </div>
              )}

              <div className="space-y-1.5">
                <h2 className="font-display text-2xl font-semibold text-[#0f294d]">
                  Sign in to start
                </h2>
                <p className="text-sm text-slate-600">
                  Save your progress and flashcards, or jump right in as a guest.
                </p>
              </div>

              {displayError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
                >
                  {displayError}
                </div>
              )}

              {!activeProvider ? (
                <div className="space-y-3">
                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      setActiveProvider('google');
                      setLocalError(null);
                    }}
                    disabled={isLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-slate-800 flex items-center justify-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      setActiveProvider('microsoft');
                      setLocalError(null);
                    }}
                    disabled={isLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-slate-800 flex items-center justify-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    <span>Continue with Microsoft / Outlook</span>
                  </motion.button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-blue-100" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-3 text-slate-500">or</span>
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGuest}
                    disabled={isLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-sm"
                  >
                    <span>{isLoading ? 'Preparing workspace...' : 'Continue as Guest'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              ) : (
                <motion.form
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleProviderSubmit}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                    <span className="text-sm font-semibold text-[#13315c]">
                      {activeProvider === 'google'
                        ? 'Google Account Sign-In'
                        : 'Microsoft / Outlook Sign-In'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProvider(null);
                        setLocalError(null);
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Back
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="signin-name"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Full Name
                    </label>
                    <input
                      id="signin-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Maya Lin"
                      autoComplete="name"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#f8fbff] border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="signin-email"
                      className="block text-sm font-medium text-slate-700"
                    >
                      {activeProvider === 'google'
                        ? 'Google Email'
                        : 'Microsoft / Outlook Email'}
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        activeProvider === 'google'
                          ? 'student@gmail.com'
                          : 'student@outlook.com'
                      }
                      autoComplete="email"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#f8fbff] border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-60 shadow-sm"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In & Save Progress'}
                  </motion.button>
                </motion.form>
              )}

              <p className="text-xs text-slate-500 leading-relaxed">
                Guest sessions let you explore right away. Sign in with an account
                email anytime to revisit your saved progress and flashcards.
              </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
};
