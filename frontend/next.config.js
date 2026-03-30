/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: 'http://localhost:8080/auth/:path*' },
      { source: '/jobs/:path*', destination: 'http://localhost:8080/jobs/:path*' },
      { source: '/health', destination: 'http://localhost:8080/health' },
    ];
  },
};

module.exports = nextConfig;
