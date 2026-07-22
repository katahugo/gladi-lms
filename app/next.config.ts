import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wajib untuk target "app" di Dockerfile (image ramping tanpa node_modules penuh)
  output: "standalone",
};

export default nextConfig;
