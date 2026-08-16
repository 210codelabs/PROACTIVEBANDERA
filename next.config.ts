import type { NextConfig } from "next";
import path from "node:path";

// Clinic operates in US Central Time. Pin the Node process timezone so ALL
// server-side booking parsing, schedule rendering and date formatting use
// America/Chicago (Node reads this at startup / on assignment).
process.env.TZ = "America/Chicago";

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
