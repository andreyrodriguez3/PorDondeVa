'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { copy } from '@/lib/copy';

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v12m0-12 4 4m-4-4-4 4M6 13v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShareButton({ routeName }: { routeName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: routeName, url });
        return;
      } catch {
        // The user cancelled the native share sheet — fall through to clipboard.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-callout font-medium text-ink-secondary shadow-elevate-1 transition-transform duration-100 active:scale-95"
      >
        <ShareIcon />
        {copy.share}
      </button>
      <AnimatePresence>
        {copied ? (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
            className="absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-micro font-medium text-white shadow-elevate-2"
          >
            {copy.shareCopied}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
