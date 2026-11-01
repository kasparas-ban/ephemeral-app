import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones on the local network, and the Android emulator's host address.
  allowedDevOrigins: ["192.168.*.*", "10.0.2.2"],
  devIndicators: false,
  reactCompiler: true,
};

export default nextConfig;
