import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.preview.emergentcf.cloud", "*.emergentagent.com"],
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
