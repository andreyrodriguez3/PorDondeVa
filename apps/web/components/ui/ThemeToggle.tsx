'use client';

import { useTheme, type ThemePreference } from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const LABEL: Record<ThemePreference, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

/** One button that cycles sistema → claro → oscuro → sistema, persisted (lib/theme.tsx). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[preference])}
      aria-label={`Tema: ${LABEL[preference]}. Cambiar a ${LABEL[NEXT[preference]]}.`}
      title={`Tema: ${LABEL[preference]}`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-[transform,background-color] duration-100 ease-out hover:bg-surface-tertiary hover:text-ink active:scale-[0.94] ${className}`}
    >
      {preference === 'light' ? <SunIcon /> : preference === 'dark' ? <MoonIcon /> : <SystemIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.4 14.7A8.5 8.5 0 1 1 9.3 3.6a7 7 0 0 0 11.1 11.1Z"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M8.5 20.5h7M12 16.5v4" />
    </svg>
  );
}
