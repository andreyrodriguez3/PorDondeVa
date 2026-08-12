'use client';

import { useEffect, useState } from 'react';
import type { RouteResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { QrImage } from '@/components/admin/QrImage';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RouteIcon } from '@/components/admin/icons';

export default function QrPage() {
  return (
    <AdminShell>
      <QrContent />
    </AdminShell>
  );
}

function QrContent() {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<RouteResponse[]>('/routes')
      .then(setRoutes)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Códigos QR"
        description="Imprimí uno en cada parada — escanearlo lleva directo al mapa en vivo de esa ruta."
      />

      <h2 className="mb-2 text-title text-ink">Página principal</h2>
      <Card className="mb-8 flex w-fit items-center gap-4 p-4">
        <QrImage
          path="/qr/company"
          alt="QR de la página principal"
          fileName="tubus-qr-empresa.png"
        />
        <p className="max-w-xs text-callout text-ink-secondary">
          Lleva a la lista de rutas de tu empresa. Útil en carteles generales o redes sociales.
        </p>
      </Card>

      <h2 className="mb-2 text-title text-ink">Por ruta</h2>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : routes.length === 0 ? (
        <EmptyState
          icon={<RouteIcon />}
          title="Todavía no hay rutas"
          description="Creá una ruta primero para generar su QR."
        />
      ) : (
        <div className="flex flex-wrap gap-4">
          {routes.map((route) => (
            <Card key={route.id} className="flex w-fit flex-col items-center gap-3 p-4">
              <QrImage
                path={`/qr/route/${route.id}`}
                alt={`QR de ${route.name}`}
                fileName={`tubus-qr-${route.publicSlug}.png`}
              />
              <p className="max-w-[10rem] text-center text-callout font-medium text-ink">
                {route.name}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
