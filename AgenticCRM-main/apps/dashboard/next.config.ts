import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@wacrm/shared'],
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'minio' },
    ],
  },
  async rewrites() {
    // Render builds Next.js rewrite destinations at build time. If a linked
    // service variable is unavailable during the image build, never leave the
    // production dashboard pointing at the local Docker-only "api" hostname.
    const configuredApiOrigin = process.env.NEXT_PUBLIC_API_URL?.trim();
    const apiHost = process.env.NEXT_PUBLIC_API_HOST?.trim();
    const apiOrigin = configuredApiOrigin
      || (apiHost ? `https://${apiHost}` : undefined)
      || (process.env.NODE_ENV === 'production'
        ? 'https://bizpilot-api-soutisha-z15s.onrender.com'
        : 'http://api:3000');

    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
