'use client';

import { AnimatePresence, motion } from 'motion/react';
import { copy } from '@/lib/copy';

/**
 * A floating material pill rather than a full-width colored strip — it announces
 * degraded connectivity without permanently claiming a strip of the passenger's
 * screen (apple-design §12 — translucent chrome as a functional layer, not a fixed bar).
 */
export function ConnectionBanner({ degraded }: { degraded: boolean }) {
  return (
    <div className="pointer-events-none sticky top-[57px] z-30 flex justify-center px-4">
      <AnimatePresence>
        {degraded ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="pointer-events-auto mt-2 flex items-center gap-2 rounded-full border border-stale/25 bg-stale-bg/95 px-3.5 py-1.5 text-caption font-medium text-stale shadow-elevate-2 backdrop-blur-chrome"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-stale" />
            {copy.connectionDegraded}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
