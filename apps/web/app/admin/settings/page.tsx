'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompanyProfileResponse, DomainResponse } from '@tubus/contracts';
import { adminFetch, adminUpload } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function SettingsPage() {
  return (
    <AdminShell>
      <SettingsContent />
    </AdminShell>
  );
}

function SettingsContent() {
  const toast = useToast();
  const [profile, setProfile] = useState<CompanyProfileResponse | null>(null);
  const [domains, setDomains] = useState<DomainResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#3d5afe');
  const [liveThreshold, setLiveThreshold] = useState(30);
  const [staleThreshold, setStaleThreshold] = useState(180);
  const [savingProfile, setSavingProfile] = useState(false);

  const [hostname, setHostname] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainToRemove, setDomainToRemove] = useState<DomainResponse | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [profileData, domainList] = await Promise.all([
        adminFetch<CompanyProfileResponse>('/companies/me'),
        adminFetch<DomainResponse[]>('/companies/me/domains'),
      ]);
      setProfile(profileData);
      setDomains(domainList);
      setName(profileData.name);
      setBrandColor(profileData.brandPrimaryColor ?? '#3d5afe');
      setLiveThreshold(profileData.liveThresholdSeconds);
      setStaleThreshold(profileData.staleThresholdSeconds);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await adminFetch('/companies/me', {
        method: 'PATCH',
        body: {
          name,
          brandPrimaryColor: brandColor,
          liveThresholdSeconds: Number(liveThreshold),
          staleThresholdSeconds: Number(staleThreshold),
        },
      });
      toast.show('Perfil actualizado', 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      await adminUpload('/companies/me/logo', file);
      toast.show('Logo actualizado', 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo subir el logo.', 'error');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    setAddingDomain(true);
    try {
      await adminFetch('/companies/me/domains', { method: 'POST', body: { hostname } });
      setHostname('');
      toast.show('Dominio agregado — verificalo cuando el DNS esté listo', 'success');
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo agregar el dominio.', 'error');
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleVerifyDomain(id: string) {
    try {
      await adminFetch(`/companies/me/domains/${id}/verify`, { method: 'POST' });
      toast.show('Dominio verificado', 'success');
      await load();
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : 'El DNS todavía no resuelve a la plataforma.',
        'error',
      );
    }
  }

  async function handleRemoveDomain() {
    if (!domainToRemove) return;
    try {
      await adminFetch(`/companies/me/domains/${domainToRemove.id}`, { method: 'DELETE' });
      toast.show('Dominio eliminado', 'success');
      setDomainToRemove(null);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo eliminar el dominio.', 'error');
    }
  }

  if (loading || !profile) {
    return (
      <div>
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configuración" description="Marca, umbrales de frescura y dominios." />

      <h2 className="mb-2 text-title text-ink">Perfil de la empresa</h2>
      <Card className="mb-8 max-w-xl p-4">
        <div className="mb-4 flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-secondary">
            {profile.logoPath ? (
              <img src={profile.logoPath} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-title-lg font-bold text-ink-tertiary">
                {profile.name.charAt(0)}
              </span>
            )}
          </span>
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploadingLogo}
              onClick={() => logoInputRef.current?.click()}
            >
              {profile.logoPath ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            <p className="mt-1 text-caption text-ink-tertiary">PNG, JPEG o WebP, máx. 1 MB.</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-end gap-3">
            <label className="text-callout text-ink-secondary">
              <span className="mb-1.5 block font-medium text-ink">Color de marca</span>
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-md border border-line"
              />
            </label>
            <span className="pb-2 text-callout text-ink-tertiary">{brandColor}</span>
          </div>
          <div className="flex gap-3">
            <Input
              label="Umbral “en vivo” (segundos)"
              type="number"
              min={5}
              value={liveThreshold}
              onChange={(e) => setLiveThreshold(Number(e.target.value))}
              hint="Bajo este tiempo sin nuevas señales, el bus se muestra en vivo."
            />
            <Input
              label="Umbral “desactualizado” (segundos)"
              type="number"
              min={liveThreshold + 1}
              value={staleThreshold}
              onChange={(e) => setStaleThreshold(Number(e.target.value))}
              hint="Después de esto, se muestra sin señal."
            />
          </div>
          <Button type="submit" loading={savingProfile} className="w-fit">
            Guardar
          </Button>
        </form>
      </Card>

      <h2 className="mb-2 text-title text-ink">Dominios</h2>
      <p className="mb-3 max-w-xl text-callout text-ink-secondary">
        Además de tu subdominio de la plataforma podés usar tu propio dominio (por ejemplo{' '}
        <code className="rounded bg-surface-tertiary px-1 py-0.5">rutas.tuempresa.com</code>).
        Apuntalo con un registro CNAME o A hacia el servidor y luego verificalo aquí.
      </p>
      <Card className="max-w-xl p-4">
        <ul className="mb-4 flex flex-col divide-y divide-line">
          {domains.map((domain) => (
            <li key={domain.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-body font-medium text-ink">{domain.hostname}</p>
                <p className="text-caption text-ink-tertiary">
                  {domain.kind === 'PLATFORM_SUBDOMAIN'
                    ? 'Subdominio de la plataforma'
                    : 'Dominio propio'}
                  {domain.isPrimary ? ' · principal' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {domain.verifiedAt ? (
                  <Badge tone="live">Verificado</Badge>
                ) : (
                  <>
                    <Badge tone="stale">Sin verificar</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleVerifyDomain(domain.id)}
                    >
                      Verificar
                    </Button>
                  </>
                )}
                {domain.kind === 'CUSTOM' ? (
                  <button
                    type="button"
                    onClick={() => setDomainToRemove(domain)}
                    className="text-caption text-ink-tertiary hover:text-danger"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddDomain} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Nuevo dominio"
              required
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="rutas.tuempresa.com"
            />
          </div>
          <Button type="submit" loading={addingDomain}>
            Agregar
          </Button>
        </form>
      </Card>

      <ConfirmDialog
        open={!!domainToRemove}
        title={`¿Eliminar ${domainToRemove?.hostname}?`}
        description="El dominio dejará de servir la página de pasajeros inmediatamente."
        onConfirm={handleRemoveDomain}
        onCancel={() => setDomainToRemove(null)}
      />
    </div>
  );
}
