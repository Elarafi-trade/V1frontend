import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Ignore Node.js modules that don't work in the browser
    // These are only used for server-side/CLI operations, not browser wallet operations
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    // Ignore source map warnings from dependencies
    config.ignoreWarnings = [
      { module: /node_modules/ },
    ];

    return config;
  },
};

export default nextConfig;
