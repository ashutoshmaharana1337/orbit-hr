import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Emit .next/standalone for the Docker image (see web/Dockerfile).
  output: "standalone",
  webpack: (config) => {
    config.externals.push("pino-pretty", "encoding");
    return config;
  },
};

// Wrap the config with Sentry's Next.js integration
// This enables automatic error tracking and performance monitoring
const sentryConfig = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for better debugging (optional)
    widenClientFileUpload: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/monitoring",
  }
);

export default sentryConfig;
