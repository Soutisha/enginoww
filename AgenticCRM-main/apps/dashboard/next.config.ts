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
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL
      ?? (process.env.NEXT_PUBLIC_API_HOST
        ? `https://${process.env.NEXT_PUBLIC_API_HOST}`
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
