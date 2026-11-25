import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';

interface TopBarProps {
  hasSession: boolean;
  hasRecentSession: boolean;
  isProgressOpen: boolean;
  onNavigateWorkspace: () => void;
  onToggleProgress: () => void;
  onNewSession: () => void;
  onOpenShare: () => void;
  onSignOut: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  hasSession,
  hasRecentSession,
  isProgressOpen,
  onNavigateWorkspace,
  onToggleProgress,
  onNewSession,
  onOpenShare,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="w-full bg-gradient-to-r from-[#13315c] via-[#1a437a] to-[#174c86] text-white border-b border-blue-900/50 shadow-sm shrink-0 relative z-30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 md:gap-8">
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            onNewSession();
          }}
          className="font-display text-base sm:text-lg font-semibold tracking-tight text-white hover:text-sky-200 transition-colors whitespace-nowrap shrink-0"
        >
          Abundant Knowledge
        </a>

        <nav
          aria-label="Workspace navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-blue-100"
        >
          <button
            type="button"
            onClick={onNewSession}
            className={`hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              !hasSession ? 'text-white underline decoration-sky-300 decoration-2 underline-offset-4' : ''
            }`}
          >
            {hasSession ? 'All Topics' : 'Pick Subject'}
          </button>

          {hasSession ? (
            <button
              type="button"
              onClick={onNavigateWorkspace}
              className="text-white underline decoration-sky-300 decoration-2 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Study Room
            </button>
          ) : (
            hasRecentSession && (
              <button
                type="button"
                onClick={onNavigateWorkspace}
                className="hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Resume Last
              </button>
            )
          )}

          <button
            type="button"
            onClick={onToggleProgress}
            aria-expanded={isProgressOpen}
            className={`hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              isProgressOpen ? 'text-white underline decoration-sky-300 decoration-2 underline-offset-4' : ''
            }`}
          >
            Progress
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="hover:text-white hover:underline decoration-sky-300 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sign Out
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 text-blue-100 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {hasSession ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenShare}
              className="px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#0f294d] bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              Share Room
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onToggleProgress}
              className="px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#0f294d] bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              {isProgressOpen ? 'Hide Progress' : 'My Progress'}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            aria-label="Mobile navigation"
            className="md:hidden border-t border-blue-800/70 bg-[#143563] px-4 py-3 flex flex-col gap-1.5 text-sm font-medium text-blue-50"
          >
            <button
              type="button"
              onClick={() => {
                onNewSession();
                setMobileMenuOpen(false);
              }}
              className="text-left py-2 px-2.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {hasSession ? 'All Topics / Switch Subject' : 'Pick Subject'}
            </button>
            {(hasSession || hasRecentSession) && (
              <button
                type="button"
                onClick={() => {
                  onNavigateWorkspace();
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 px-2.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                {hasSession ? 'Study Room' : 'Resume Last Session'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onToggleProgress();
                setMobileMenuOpen(false);
              }}
              className="text-left py-2 px-2.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {isProgressOpen ? 'Hide Progress' : 'My Progress'}
            </button>
            <button
              type="button"
              onClick={() => {
                onSignOut();
                setMobileMenuOpen(false);
              }}
              className="text-left py-2 px-2.5 rounded-lg hover:bg-white/10 text-blue-200 transition-colors"
            >
              Sign Out
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};
