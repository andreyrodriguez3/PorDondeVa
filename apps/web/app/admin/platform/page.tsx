'use client';

import { useEffect, useState } from 'react';
import type { CreateCompanyAdminResponse, PlatformCompanyResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { PlatformShell } from '@/components/admin/PlatformShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';

export default function PlatformPage() {
  return (
    <PlatformShell>
      <PlatformContent />
    </PlatformShell>
  );
}

function PlatformContent() {
  const toast = useToast();
  const [companies, setCompanies] = useState<PlatformCompanyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('America/Costa_Rica');
  const [submitting, setSubmitting] = useState(false);
  const [adminTarget, setAdminTarget] = useState<PlatformCompanyResponse | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PlatformCompanyResponse | null>(null);
  const [suspending, setSuspending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setCompanies(await adminFetch<PlatformCompanyResponse[]>('/platform/companies'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminFetch('/platform/companies', {
        method: 'POST',
        body: { name, slug, timezone },
      });
      setName('');
      setSlug('');
      toast.show(`Empresa "${name}" creada`, 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo crear la empresa.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(
    company: PlatformCompanyResponse,
    nextStatus: 'ACTIVE' | 'SUSPENDED',
  ) {
    try {
      await adminFetch(`/platform/companies/${company.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      toast.show(
        nextStatus === 'SUSPENDED'
          ? `"${company.name}" suspendida`
          : `"${company.name}" reactivada`,
        'success',
      );
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo actualizar la empresa.', 'error');
    }
  }

  // Reactivating is benign — suspending locks out every one of the company's staff and
  // 404s its passenger site the moment this lands, immediately and company-wide, so it
  // gets the same confirm-before-destructive treatment as removing a stop or schedule.
  async function handleConfirmSuspend() {
    if (!suspendTarget) return;
    setSuspending(true);
    await updateStatus(suspendTarget, 'SUSPENDED');
    setSuspending(false);
    setSuspendTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Creá empresas y su primer administrador. La operación diaria pasa al panel de esa empresa."
      />

      <Card className="mb-6 p-5">
        <h2 className="mb-3 text-title text-ink">Nueva empresa</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Slug"
            required
            placeholder="rutaejemplo"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          <Input
            label="Zona horaria"
            required
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
          <Button type="submit" loading={submitting}>
            Crear empresa
          </Button>
        </form>
      </Card>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : companies.length === 0 ? (
        <EmptyState
          title="Sin empresas todavía"
          description="Creá la primera con el formulario de arriba."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Slug</TH>
              <TH>Estado</TH>
              <TH>&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {companies.map((company) => (
              <TR key={company.id}>
                <TD className="font-medium text-ink">{company.name}</TD>
                <TD className="text-ink-secondary">{company.slug}</TD>
                <TD>
                  <Badge tone={company.status === 'ACTIVE' ? 'live' : 'danger'}>
                    {company.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setAdminTarget(company)}
                      className="text-caption font-medium text-ink-tertiary hover:text-brand"
                    >
                      Crear admin
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        company.status === 'ACTIVE'
                          ? setSuspendTarget(company)
                          : updateStatus(company, 'ACTIVE')
                      }
                      className="text-caption font-medium text-ink-tertiary hover:text-danger"
                    >
                      {company.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <CreateAdminDialog
        company={adminTarget}
        onClose={() => setAdminTarget(null)}
        onDone={() => toast.show('Administrador creado', 'success')}
      />

      <ConfirmDialog
        open={suspendTarget !== null}
        title={`¿Suspender "${suspendTarget?.name}"?`}
        description="Su sitio de pasajeros deja de responder y ningún administrador, operador o conductor de esta empresa va a poder iniciar sesión, de inmediato. Podés reactivarla en cualquier momento."
        confirmLabel={suspending ? 'Suspendiendo…' : 'Suspender'}
        onConfirm={handleConfirmSuspend}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  );
}

function CreateAdminDialog({
  company,
  onClose,
  onDone,
}: {
  company: PlatformCompanyResponse | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateCompanyAdminResponse | null>(null);

  useEffect(() => {
    setName('');
    setEmail('');
    setResult(null);
  }, [company]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSubmitting(true);
    try {
      const created = await adminFetch<CreateCompanyAdminResponse>(
        `/platform/companies/${company.id}/admins`,
        { method: 'POST', body: { name, email } },
      );
      setResult(created);
      onDone();
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : 'No se pudo crear el administrador.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <Card className="w-full max-w-sm p-5">
        <h2 className="text-title text-ink">Administrador de {company.name}</h2>

        {result ? (
          <div className="mt-3">
            <p className="text-callout text-ink-secondary">
              Guardá esta contraseña — solo se muestra una vez. Se le va a pedir cambiarla al
              iniciar sesión.
            </p>
            <div className="mt-3 rounded-md border border-line bg-surface-secondary p-3">
              <p className="text-caption text-ink-tertiary">Correo</p>
              <p className="font-mono text-body text-ink">{result.email}</p>
              <p className="mt-2 text-caption text-ink-tertiary">Contraseña temporal</p>
              <p className="font-mono text-body text-ink">{result.temporaryPassword}</p>
            </div>
            <Button className="mt-4 w-full" onClick={onClose}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
            <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Correo"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" loading={submitting}>
                Crear
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
