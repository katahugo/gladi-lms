import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // instrumentationHook: true, // otomatis di Next.js 15+
};

// withSentryConfig hanya aktif bila SENTRY_DSN ada; jika tidak, config
// Next.js tetap berjalan normal tanpa sentry.
const sentryConfig = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG ?? "gladi",
      project: process.env.SENTRY_PROJECT ?? "gladi-lms",
    })
  : nextConfig;

export default sentryConfig;
