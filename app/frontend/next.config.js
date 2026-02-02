/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // API proxy is in app/api/[[...path]]/route.ts so BACKEND_URL is read at runtime (required when frontend runs in Docker and backend URL varies).
  // Allow dev server to serve _next/static when accessed via host IP (e.g. http://10.66.50.210:3000).
  allowedDevOrigins: ['localhost', '127.0.0.1', '10.66.50.210', '*.local'],
};

module.exports = nextConfig;
