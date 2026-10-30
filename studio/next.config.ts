import type { NextConfig } from "next";

// Local-only studio UI. Data lives one level up (the MotionMind hub) and is read at request time.
const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
};

export default nextConfig;
