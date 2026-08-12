import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCompany } from '@/lib/api';
import { copy } from '@/lib/copy';

function resolveHostname(): string {
  const h = headers();
  return (h.get('host') ?? '').split(':')[0]!;
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const hostname = resolveHostname();
  const company = await getCompany(hostname);
  if (!company) notFound();

  const style = company.brandPrimaryColor
    ? ({ '--brand-color': company.brandPrimaryColor } as React.CSSProperties)
    : undefined;

  return (
    <div style={style} className="flex min-h-screen flex-col bg-surface-secondary">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/75 px-4 py-3 backdrop-blur-chrome">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          {company.logoPath ? (
            <img
              src={company.logoPath}
              alt={company.name}
              className="h-8 w-8 rounded-full object-cover shadow-elevate-1"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-body font-bold text-brand-fg">
              {company.name.charAt(0)}
            </span>
          )}
          <span className="text-title text-ink">{company.name}</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="px-4 py-6 text-center text-caption text-ink-tertiary">
        {copy.poweredBy}
      </footer>
    </div>
  );
}
