import { copy } from '@/lib/copy';

export function ConnectionBanner({ degraded }: { degraded: boolean }) {
  if (!degraded) return null;
  return (
    <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-700">
      {copy.connectionDegraded}
    </div>
  );
}
