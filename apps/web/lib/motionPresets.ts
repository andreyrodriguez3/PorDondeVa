import type { Target, Transition } from 'motion/react';

interface SpringPreset {
  initial: Target;
  animate: Target;
  exit: Target;
  transition: Transition;
}

/**
 * apple-design §14 — reduced motion means a gentler equivalent, not no feedback at all.
 * `prefers-reduced-motion` in globals.css only stops CSS `transition`/`animation`; every
 * Framer Motion spring (WAAPI/JS-driven, not CSS) needs this called explicitly with
 * `useReducedMotion()` from 'motion/react'. With reduced motion on, position/scale
 * motion drops out and only a short opacity cross-fade remains.
 */
export function springOrFade(reduced: boolean, preset: SpringPreset): SpringPreset {
  if (!reduced) return preset;
  return {
    initial: { opacity: preset.initial.opacity ?? 0 },
    animate: { opacity: preset.animate.opacity ?? 1 },
    exit: { opacity: preset.exit.opacity ?? 0 },
    transition: { duration: 0.15 },
  };
}
