'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { PublicBusUpdate } from '@tubus/contracts';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';
const POLL_INTERVAL_MS = 10_000;
const SOCKET_CONNECT_TIMEOUT_MS = 4_000;

export interface LiveBusesState {
  buses: PublicBusUpdate[];
  connectionDegraded: boolean;
}

/**
 * Subscribes to the passenger live socket for one route. On reconnect it refetches the
 * REST snapshot before resuming the stream, so positions missed during the gap cannot
 * leave a stale marker on screen (README.md "Connection resilience"). If the socket
 * never connects, it falls back to polling the same snapshot every ten seconds.
 */
export function useLiveBuses(routeSlug: string, initialBuses: PublicBusUpdate[]): LiveBusesState {
  const [buses, setBuses] = useState<PublicBusUpdate[]>(initialBuses);
  const [connectionDegraded, setConnectionDegraded] = useState(false);
  const busesRef = useRef(buses);
  busesRef.current = buses;

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function refetchSnapshot() {
      try {
        const res = await fetch(`/api/public/routes/${routeSlug}/live`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { buses: PublicBusUpdate[] };
        if (!cancelled) setBuses(data.buses);
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

    // In production the socket connects through Caddy on the same hostname as the page,
    // so the browser's own Host header already identifies the tenant. In local dev,
    // WS_URL points straight at the API on a different host:port, so the API's
    // dev-only X-Tenant-Host override (see HostResolutionMiddleware) is needed here —
    // otherwise the gateway can't resolve a company and disconnects the socket
    // immediately, which otherwise looks like an infinite reconnect loop.
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
      socket.emit('subscribe', { routeSlug });
    });

    socket.on('disconnect', () => {
      startPolling();
    });

    socket.on('connect_error', () => {
      startPolling();
    });

    socket.on('bus:update', (update: PublicBusUpdate) => {
      setBuses((prev) => {
        const next = prev.filter((b) => b.tripId !== update.tripId);
        next.push(update);
        return next;
      });
    });

    socket.on('bus:ended', ({ tripId }: { tripId: string }) => {
      setBuses((prev) => prev.filter((b) => b.tripId !== tripId));
    });

    return () => {
      cancelled = true;
      clearTimeout(connectTimeout);
      stopPolling();
      socket.disconnect();
    };
  }, [routeSlug]);

  return { buses, connectionDegraded };
}
