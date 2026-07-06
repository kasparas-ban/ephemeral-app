import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.26", "10.0.2.2"],
  devIndicators: false,
  reactCompiler: true,
};

export default nextConfig;
