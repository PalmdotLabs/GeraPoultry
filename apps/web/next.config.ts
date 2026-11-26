import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@poultry/api-client',
    '@poultry/types',
    '@poultry/validation',
  ],
};

export default nextConfig;
