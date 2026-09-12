"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary component.
 *
 * This component catches errors that happen in layout.tsx
 * and other root-level errors that the regular error.tsx can't catch.
 *
 * Note: This component must include HTML tags since it's the fallback
 * for root-level errors.
 */
export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps) {
  useEffect(() => {
    // Log to Sentry
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        component: "global-error-boundary",
      },
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="mt-4 text-lg font-semibold text-gray-900">
                Critical Error
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                The application encountered a critical error. Please reload the page.
              </p>

              {process.env.NODE_ENV === "development" && (
                <details className="mt-4 p-3 bg-gray-100 rounded text-left text-xs text-gray-700 max-h-40 overflow-auto">
                  <summary className="cursor-pointer font-mono font-semibold mb-2">
                    Error Details
                  </summary>
                  <pre className="whitespace-pre-wrap break-words">
                    {error.message}
                    {"\n\n"}
                    {error.stack}
                  </pre>
                </details>
              )}

              <button
                onClick={() => reset()}
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retry
              </button>

              <a
                href="/"
                className="mt-2 block w-full text-center text-sm text-blue-600 hover:text-blue-700"
              >
                Reload Page
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
