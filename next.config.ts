import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_DEVFLOW_WS_PORT: process.env.DEVFLOW_WS_PORT || '3001',
  },
  outputFileTracingExcludes: {
    '*': ['./node_modules/typescript/**', './node_modules/sharp/**', './node_modules/@img/**'],
  },
};

export default nextConfig;
