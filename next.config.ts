import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
   devIndicators: false, // ← add this: hides the "N" button in development
};

export default nextConfig;
