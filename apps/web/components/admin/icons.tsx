// Small hand-rolled stroke icon set — consistent 1.7 stroke weight, 18-20px, no icon
// library dependency for a half-dozen glyphs (CODESTYLE.md — no dependency without
// a real problem to solve).
export function LiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path
        d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.6 10.6 0 0 0 0 14.8M19.4 4.6a10.6 10.6 0 0 1 0 14.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TripsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M4 12h10M4 18h13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="19.5" cy="18" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function BusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16.5V6.8C4 5.25 5.3 4 6.9 4h10.2C18.7 4 20 5.25 20 6.8v9.7c0 1.05-.86 1.9-1.93 1.9H5.93A1.93 1.93 0 0 1 4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M6 6.4h12" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="7.6" cy="19" r="1.4" fill="currentColor" />
      <circle cx="16.4" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function DriverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c0-3.3 3.13-6 7-6s7 2.7 7 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RouteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M7.6 7.4C9 9.4 11 11 13 12.4c1.6 1.1 2.9 2 3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="1 2.6"
      />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 1 1 18.5 10c0 5.4-6.5 11-6.5 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.5 6.5l-1.6 1.6M8.1 15.9l-1.6 1.6M17.5 17.5l-1.6-1.6M8.1 8.1 6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5"
        y="3.5"
        width="6.5"
        height="6.5"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="14"
        y="3.5"
        width="6.5"
        height="6.5"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="3.5"
        y="14"
        width="6.5"
        height="6.5"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect x="14.3" y="14.3" width="2.4" height="2.4" fill="currentColor" />
      <rect x="18.1" y="14.3" width="2.4" height="2.4" fill="currentColor" />
      <rect x="14.3" y="18.1" width="2.4" height="2.4" fill="currentColor" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l4-5-4-5M20 12H9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
