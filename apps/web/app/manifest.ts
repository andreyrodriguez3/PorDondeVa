import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TuBus',
    short_name: 'TuBus',
    description: 'Rastreo de buses en tiempo real',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#3d5afe',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
