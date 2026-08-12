'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthenticatedUser } from '@tubus/contracts';

const ACCESS_TOKEN_KEY = 'tubus_admin_access_token';
const REFRESH_TOKEN_KEY = 'tubus_admin_refresh_token';
const USER_KEY = 'tubus_admin_user';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getCurrentUser(): AuthenticatedUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
}

export function storeSession(
  tokens: { accessToken: string; refreshToken: string },
  user: AuthenticatedUser,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Every admin fetch goes through the same-origin `/api/*` path (proxied to the API by
 * next.config.js's rewrite, mirroring Caddy in production), carrying the stored access
 * token. A 401 clears the session so the next render redirects to login rather than
 * looping on stale credentials.
 */
export async function adminFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401) {
    clearSession();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

/** Same auth as adminFetch, for a multipart file upload — no Content-Type set manually
 * so the browser can add its own boundary. */
export async function adminUpload<T>(path: string, file: File): Promise<T> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    clearSession();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Same auth as adminFetch, for endpoints that return a binary body (QR PNGs) instead of JSON. */
export async function adminFetchBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (res.status === 401) {
    clearSession();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.blob();
}

/** Redirects to /login if there is no stored session; otherwise returns the user. */
export function useRequireAdminAuth(): AuthenticatedUser | null {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    const current = getCurrentUser();
    if (!current || !getAccessToken()) {
      router.replace('/login');
      return;
    }
    setUser(current);
  }, [router]);

  return user;
}
