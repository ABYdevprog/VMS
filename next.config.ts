import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'node-cron', '@whiskeysockets/baileys'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
