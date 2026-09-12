/**
 * Sentry Server-Side Configuration for Next.js
 *
 * This configuration is used for server-side code:
 * - API routes
 * - Server components
 * - getServerSideProps, getStaticProps
 *
 * Note: Since this is a Next.js app with mostly client-side rendering,
 * server-side errors will be minimal. Most errors occur on the client.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Server-side: capture 100% of transactions for debugging
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Helpful for debugging
    debug: process.env.NODE_ENV === 'development',
  });
}

export default Sentry;
