/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,     // ✅ App Router 활성화
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
