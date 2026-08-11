/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Mirrors Caddy's production routing (README.md — /api/* -> api), so client-side
  // same-origin fetches work in local dev too, without CORS or a second hostname.
  async rewrites() {
    const apiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:8080';
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

module.exports = nextConfig;
