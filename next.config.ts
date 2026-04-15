import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@e2b/code-interpreter", "e2b"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:crypto": path.resolve(__dirname, "src/lib/edge-crypto-polyfill.ts"),
        "@e2b/code-interpreter": path.resolve(__dirname, "src/lib/e2b-mock.ts"),
        "e2b": path.resolve(__dirname, "src/lib/e2b-mock.ts"),
      };
    }
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;






