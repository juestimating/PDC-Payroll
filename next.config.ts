import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Single app rooted here — pin the tracing root so Next does not walk up to a
  // stray lockfile in the home directory when inferring the workspace root.
  outputFileTracingRoot: process.cwd(),
  // Baseline security headers applied to every route. Conservative set that is
  // safe with Next.js + Supabase.
  // NOTE: a Content-Security-Policy is intentionally NOT set here — a strict CSP
  // risks breaking Next.js inline/hydration scripts and Supabase client calls
  // and needs per-directive tuning + nonces. Treat CSP as a follow-up task.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
