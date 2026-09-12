/**
 * Sentry Client-Side Configuration for Next.js
 *
 * This configuration is used for client-side code:
 * - Browser JavaScript errors
 * - React component errors
 * - Performance monitoring
 *
 * The client-side SDK is initialized automatically by @sentry/nextjs
 * when imported, but can be customized here.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Client-side: sample 10% in production, 100% in development
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Capture browser replay for 10% of errors
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with an error
    // Helpful for debugging
    debug: process.env.NODE_ENV === 'development',
    // Integrations are added automatically, but you can customize here
    integrations: [
      // Capture unhandled promise rejections
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
  });
}

export default Sentry;
