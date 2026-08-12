import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label className="block text-callout text-ink-secondary" htmlFor={inputId}>
        {label ? <span className="mb-1.5 block font-medium text-ink">{label}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-md border border-line bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-tertiary transition-shadow duration-150 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 ${className}`}
          {...props}
        />
        {hint ? <span className="mt-1 block text-caption text-ink-tertiary">{hint}</span> : null}
      </label>
    );
  },
);
Input.displayName = 'Input';
