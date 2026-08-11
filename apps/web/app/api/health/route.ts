import { NextResponse } from 'next/server';

// Liveness probe for the web process itself, reachable on plain `localhost` with no
// tenant host required — unlike every other route, which the middleware resolves by
// hostname. Used by container healthchecks and by local tooling that can't rely on
// `*.localhost` DNS resolution (only browsers special-case that; Node's resolver does
// not — see README.md's note on hosts-file fallbacks).
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
