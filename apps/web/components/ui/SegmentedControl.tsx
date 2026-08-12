'use client';

import { motion } from 'motion/react';

interface Option {
  id: string;
  label: string;
}

/**
 * The active pill uses a shared layout animation (motion's `layoutId`) rather than a
 * CSS transition, so switching segments mid-flight re-targets smoothly instead of
 * jumping — the interruptibility apple-design calls for (§3) without hand-rolling it.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-surface-tertiary p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative rounded-full px-3.5 py-1.5 text-callout font-medium transition-colors duration-150 ${
              active ? 'text-brand-fg' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="segmented-pill"
                className="absolute inset-0 rounded-full bg-brand shadow-elevate-1"
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
