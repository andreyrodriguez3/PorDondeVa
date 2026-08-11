import { headers } from 'next/headers';
import Link from 'next/link';
import { listRoutes } from '@/lib/api';
import { copy } from '@/lib/copy';

function resolveHostname(): string {
  const h = headers();
  return (h.get('host') ?? '').split(':')[0]!;
}

export default async function CompanyLandingPage() {
  const hostname = resolveHostname();
  const routes = (await listRoutes(hostname)) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">{copy.routesHeading}</h1>
      {routes.length === 0 ? (
        <p className="text-gray-500">{copy.noRoutes}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {routes.map((route) => (
            <li key={route.slug}>
              <Link
                href={`/r/${route.slug}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-brand"
              >
                <span>
                  <span className="block font-medium">{route.name}</span>
                  <span className="block text-sm text-gray-500">
                    {route.originLabel} → {route.destinationLabel}
                  </span>
                </span>
                {route.activeBusCount > 0 ? (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    {route.activeBusCount} en vivo
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
