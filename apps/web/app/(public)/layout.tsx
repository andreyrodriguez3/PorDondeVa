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
    <div style={style} className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        {company.logoPath ? (
          <img src={company.logoPath} alt={company.name} className="h-8 w-8 rounded" />
        ) : null}
        <span className="text-lg font-semibold text-brand">{company.name}</span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-100 px-4 py-3 text-center text-xs text-gray-400">
        {copy.poweredBy}
      </footer>
    </div>
  );
}
