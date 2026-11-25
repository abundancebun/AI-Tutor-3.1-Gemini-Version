import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Users, X } from 'lucide-react';
import type { TutorSession } from '../shared/types';

interface ShareSessionModalProps {
  session: TutorSession;
  onClose: () => void;
}

export const ShareSessionModal: React.FC<ShareSessionModalProps> = ({
  session,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const shareUrl = `${window.location.origin}/?session=${session.id}`;

  const copyText = async (text: string, onDone: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
    } catch {
      const input = document.getElementById(
        'share-session-url-input'
      ) as HTMLInputElement | null;
      if (input) {
        const prev = input.value;
        input.value = text;
        input.select();
        document.execCommand('copy');
        input.value = prev;
        onDone();
      }
    }
  };

  const handleCopyLink = async () => {
    await copyText(shareUrl, () => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyCode = async () => {
    await copyText(session.id, () => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 bg-[#0f294d]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="w-full max-w-lg bg-white border border-blue-200 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="h-1.5 bg-gradient-to-r from-[#1d4ed8] via-sky-500 to-teal-500" />
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="share-modal-title"
                className="font-display text-lg font-semibold text-[#0f294d]"
              >
                Share this study room
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Anyone with this number code or link can join your live notes and chat.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close share dialog"
              className="p-1.5 text-blue-700 hover:text-blue-950 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-[#eff6ff] to-[#e0f2fe] border border-blue-200 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-blue-800">
                Room Number Code
              </p>
              <p
                data-testid="room-number-code"
                className="font-mono text-2xl font-bold tracking-[0.22em] text-[#0f294d] tabular-nums mt-0.5"
              >
                {session.id}
              </p>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleCopyCode}
              className="min-h-[38px] px-3.5 py-2 bg-white hover:bg-blue-50 border border-blue-300 text-[#0f294d] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-600" />
                  <span>Code Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-blue-700" />
                  <span>Copy Code</span>
                </>
              )}
            </motion.button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="share-session-url-input"
              className="block text-xs font-medium text-slate-600"
            >
              Or share the full room link
            </label>
            <div className="flex items-center gap-2">
              <input
                id="share-session-url-input"
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 text-xs font-mono bg-[#f4f9ff] border border-blue-200 rounded-lg text-slate-800 select-all"
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleCopyLink}
                className="min-h-[38px] px-4 py-2 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 shadow-sm"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <div className="pt-3 border-t border-blue-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0f294d]">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>
                People in this room ({session.participants.length})
              </span>
            </div>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {session.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm py-1.5 px-2.5 rounded-lg bg-[#f4f9ff] border border-blue-100"
                >
                  <span className="font-medium text-slate-800 truncate">
                    {p.name}
                  </span>
                  <span className="text-xs text-blue-800/75 whitespace-nowrap shrink-0">
                    {p.role === 'host' ? 'Host' : 'Peer'} ·{' '}
                    {p.online ? 'Connected' : 'Away'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
