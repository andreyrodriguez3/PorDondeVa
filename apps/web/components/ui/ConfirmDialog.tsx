'use client';

import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import { springOrFade } from '@/lib/motionPresets';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reserved for genuinely destructive, hard-to-reverse actions (apple-design §16 —
 * Agency/forgiveness: use sparingly, or people learn to click through it blind).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      confirmRef.current?.focus();
    } else {
      (triggerRef.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
            {...springOrFade(Boolean(reduced), {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.18 },
            })}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            {...springOrFade(Boolean(reduced), {
              initial: { opacity: 0, scale: 0.94, y: 8 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.96, y: 4 },
              transition: { type: 'spring', bounce: 0, duration: 0.3 },
            })}
            className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-elevate-3"
          >
            <h2 id={titleId} className="text-title text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1.5 text-callout text-ink-secondary">
                {description}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                ref={confirmRef}
                variant={destructive ? 'danger' : 'primary'}
                size="sm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
