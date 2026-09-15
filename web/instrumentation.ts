/**
 * Next.js instrumentation hook (https://nextjs.org/docs/app/guides/instrumentation).
 * Loads the server-side Sentry config once per server process and forwards
 * request errors from Server Components / route handlers to Sentry.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
