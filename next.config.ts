import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Electron packaging
  output: 'standalone',

  // Configure for offline/Electron use
  trailingSlash: true,

  // Disable image optimization for Electron (uses local images)
  images: {
    unoptimized: true,
  },

  // Webpack configuration for Electron compatibility
  webpack: (config, { isServer }) => {
    // Handle native modules in Electron
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
