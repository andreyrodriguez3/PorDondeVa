'use client';

import { useEffect, useState } from 'react';
import type { RouteResponse, StopResponse } from '@tubus/contracts';
import { adminFetch } from '@/lib/adminAuth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageHeader } from '@/components/admin/PageHeader';
import { QrImage } from '@/components/admin/QrImage';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RouteIcon, StopIcon } from '@/components/admin/icons';

export default function QrPage() {
  return (
    <AdminShell>
      <QrContent />
    </AdminShell>
  );
}

function QrContent() {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [stops, setStops] = useState<StopResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminFetch<RouteResponse[]>('/routes'), adminFetch<StopResponse[]>('/stops')])
      .then(([r, s]) => {
        setRoutes(r);
        setStops(s);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Códigos QR"
        description="Imprimí el de una ruta para el mapa en vivo, o el de una parada para ver solo los buses que se acercan a ella."
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

      <h2 className="mb-2 mt-8 text-title text-ink">Por parada</h2>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : stops.length === 0 ? (
        <EmptyState
          icon={<StopIcon />}
          title="Todavía no hay paradas"
          description="Creá una parada primero para generar su QR."
        />
      ) : (
        <div className="flex flex-wrap gap-4">
          {stops.map((stop) => (
            <Card key={stop.id} className="flex w-fit flex-col items-center gap-3 p-4">
              <QrImage
                path={`/qr/stop/${stop.id}`}
                alt={`QR de ${stop.name}`}
                fileName={`tubus-qr-parada-${stop.id}.png`}
              />
              <p className="max-w-[10rem] text-center text-callout font-medium text-ink">
                {stop.name}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
