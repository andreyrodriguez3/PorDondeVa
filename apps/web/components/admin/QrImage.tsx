'use client';

import { useEffect, useState } from 'react';
import { adminFetchBlob } from '@/lib/adminAuth';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The QR endpoints require a bearer token, so a plain `<img src>` can't reach them —
 * fetch the PNG with the same auth as everything else and hand the browser an object
 * URL instead.
 */
export function QrImage({ path, alt, fileName }: { path: string; alt: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    adminFetchBlob(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!url) return <Skeleton className="h-40 w-40" />;

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={url} alt={alt} className="h-40 w-40 rounded-md border border-line bg-white p-2" />
      <a
        href={url}
        download={fileName}
        className="text-caption font-medium text-brand hover:underline"
      >
        Descargar PNG
      </a>
    </div>
  );
}
