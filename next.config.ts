import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Single app rooted here — pin the tracing root so Next does not walk up to a
  // stray lockfile in the home directory when inferring the workspace root.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
