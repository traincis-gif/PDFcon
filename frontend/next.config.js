/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: 'http://localhost:9090/auth/:path*' },
      { source: '/jobs/:path*', destination: 'http://localhost:9090/jobs/:path*' },
      { source: '/health', destination: 'http://localhost:9090/health' },
    ];
  },
};

module.exports = nextConfig;
