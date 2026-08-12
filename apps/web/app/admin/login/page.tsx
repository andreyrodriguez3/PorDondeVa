'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginResponse } from '@tubus/contracts';
import { storeSession } from '@/lib/adminAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? 'No se pudo iniciar sesión.');
      }
      const data = (await res.json()) as LoginResponse;
      storeSession(data.tokens, data.user);
      router.replace('/live');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-title font-bold text-brand-fg shadow-elevate-2">
            T
          </span>
          <h1 className="text-title-lg text-ink">Panel administrativo</h1>
          <p className="text-callout text-ink-secondary">Iniciá sesión para continuar</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <p className="rounded-md border border-danger/25 bg-danger-bg px-3 py-2 text-callout text-danger">
                {error}
              </p>
            ) : null}
            <Input
              label="Correo electrónico"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Contraseña"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" loading={submitting} className="mt-1 w-full">
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
