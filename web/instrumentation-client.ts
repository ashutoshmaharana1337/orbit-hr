/**
 * Client-side Sentry setup. Next.js loads this file in the browser before the
 * app hydrates (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).
 * Sentry.init is skipped entirely when NEXT_PUBLIC_SENTRY_DSN is empty.
 */
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Client-side: sample 10% in production, 100% in development
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Session replay: 10% of sessions in production, 100% of sessions with an error
    replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,
    debug: process.env.NODE_ENV === "development",
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
  });
}

// Lets Sentry trace App Router navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
