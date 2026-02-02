/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:8080';
    return [
      { source: '/api/auth/:path*', destination: `${backend}/auth/:path*` },
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
