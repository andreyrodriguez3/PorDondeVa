'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg shadow-elevate-1 hover:brightness-105',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-secondary',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-tertiary',
  danger: 'bg-danger text-white hover:brightness-105',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-callout gap-1.5',
  md: 'h-10 px-4 text-body gap-2',
  lg: 'h-12 px-5 text-title gap-2',
};

/**
 * Feedback lives on the press, not the release (apple-design §1) — `active:scale-97` is a
 * plain CSS pseudo-class, so it fires the instant the pointer goes down with zero JS
 * round-trip, and `duration-100` keeps the settle fast enough to read as instantaneous.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center rounded-md font-medium transition-[transform,filter,background-color] duration-100 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
