'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { PublicApproachingBus, PublicBusUpdate, PublicStopRoute } from '@tubus/contracts';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';
const POLL_INTERVAL_MS = 10_000;
const SOCKET_CONNECT_TIMEOUT_MS = 4_000;

export interface StopLiveState {
  approaching: PublicApproachingBus[];
  connectionDegraded: boolean;
}

/**
 * A stop is a shared physical location that can sit on several routes (D-public.ts) —
 * this subscribes to every route serving it on one socket (reusing the same per-route
 * `subscribe` message the route page already uses) and keeps only the bus updates whose
 * computed `nextStopId` is this stop, dropping one once it's passed it. No gateway
 * changes needed: every `bus:update` already carries `nextStopId` (the ETA feature).
 * Route attribution for a fresh update uses `routeVariantId` (present on every socket
 * payload) rather than remembering what a trip was attributed to last time, so a bus
 * that's never been seen before still shows the right route on its first update.
 */
export function useStopLive(
  stopId: string,
  routes: PublicStopRoute[],
  initialApproaching: PublicApproachingBus[],
): StopLiveState {
  const [approaching, setApproaching] = useState<PublicApproachingBus[]>(initialApproaching);
  const [connectionDegraded, setConnectionDegraded] = useState(false);
  const routeByVariantId = useRef(new Map(routes.map((r) => [r.routeVariantId, r])));
  routeByVariantId.current = new Map(routes.map((r) => [r.routeVariantId, r]));

  const routeSlugs = routes.map((r) => r.routeSlug).join(',');

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function refetchSnapshot() {
      try {
        const res = await fetch(`/api/public/stops/${stopId}/live`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { approaching: PublicApproachingBus[] };
        if (!cancelled) setApproaching(data.approaching);
      } catch {
        // Transient network errors are expected during a poll; the next tick retries.
      }
    }

    function startPolling() {
      if (cancelled) return;
      setConnectionDegraded(true);
      if (pollTimer) return;
      pollTimer = setInterval(refetchSnapshot, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      setConnectionDegraded(false);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    }

    if (routes.length === 0) return;

    const socket: Socket = io(`${WS_URL}/live`, {
      reconnectionDelay: 1000,
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
      transportOptions: {
        polling: { extraHeaders: { 'X-Tenant-Host': window.location.hostname } },
      },
    });

    const connectTimeout = setTimeout(() => {
      if (!socket.connected) startPolling();
    }, SOCKET_CONNECT_TIMEOUT_MS);

    socket.on('connect', async () => {
      clearTimeout(connectTimeout);
      stopPolling();
      await refetchSnapshot();
      for (const routeSlug of routeSlugs.split(',')) {
        socket.emit('subscribe', { routeSlug });
      }
    });

    socket.on('disconnect', () => startPolling());
    socket.on('connect_error', () => startPolling());

    socket.on('bus:update', (update: PublicBusUpdate) => {
      setApproaching((prev) => {
        const withoutThisTrip = prev.filter((b) => b.tripId !== update.tripId);
        if (update.nextStopId !== stopId) return withoutThisTrip;

        const route = routeByVariantId.current.get(update.routeVariantId);
        if (!route) return withoutThisTrip; // a variant not actually serving this stop

        const merged: PublicApproachingBus = {
          ...update,
          routeSlug: route.routeSlug,
          routeName: route.routeName,
        };
        return [...withoutThisTrip, merged].sort(
          (a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity),
        );
      });
    });

    socket.on('bus:ended', ({ tripId }: { tripId: string }) => {
      setApproaching((prev) => prev.filter((b) => b.tripId !== tripId));
    });

    return () => {
      cancelled = true;
      clearTimeout(connectTimeout);
      stopPolling();
      socket.disconnect();
    };
  }, [stopId, routeSlugs]);

  return { approaching, connectionDegraded };
}
