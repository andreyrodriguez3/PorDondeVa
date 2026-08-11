import { copy } from '@/lib/copy';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-lg font-medium">{copy.companyNotFound}</p>
    </div>
  );
}
