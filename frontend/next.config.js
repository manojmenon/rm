/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // API proxy is in app/api/[[...path]]/route.ts so BACKEND_URL is read at runtime (required when frontend runs in Docker and backend URL varies).
};

module.exports = nextConfig;
