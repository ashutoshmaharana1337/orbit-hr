"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary component for the entire application.
 *
 * This component:
 * 1. Catches all unhandled errors in the app
 * 2. Reports them to Sentry with user context (tenant, role)
 * 3. Shows a fallback UI to the user
 * 4. Provides a reset button to recover from the error
 *
 * Sentry context includes:
 * - userId: who encountered the error
 * - tenantId: which tenant had the issue
 * - userRole: their role (helpful for permission-related errors)
 * - error message and stack trace
 */
export default function ErrorBoundary({
  error,
  reset,
}: ErrorBoundaryProps) {
  const { user } = useAuth();

  useEffect(() => {
    // Attach user context to Sentry
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.employee?.name,
      });

      // Add tenant context
      if (user.tenant) {
        Sentry.setTag("tenantId", user.tenant.id);
        Sentry.setContext("tenant", {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
        });
      }

      // Add role context
      if (user.role) {
        Sentry.setTag("userRole", user.role);
      }
    }

    // Capture the error in Sentry
    // This happens automatically for most errors, but we ensure context is set
    Sentry.captureException(error, {
      level: "error",
      tags: {
        component: "error-boundary",
        location: "app",
      },
      contexts: {
        react: {
          componentStack: error.stack,
        },
      },
    });
  }, [error, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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
            Oops! Something went wrong
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            We've been notified about this error. Our team will investigate.
          </p>

          {process.env.NODE_ENV === "development" && (
            <details className="mt-4 p-3 bg-gray-100 rounded text-left text-xs text-gray-700 max-h-40 overflow-auto">
              <summary className="cursor-pointer font-mono font-semibold mb-2">
                Error Details (Dev Only)
              </summary>
              <pre className="whitespace-pre-wrap break-words">
                {error.message}
                {"\n\n"}
                {error.stack}
              </pre>
            </details>
          )}

          {error.digest && (
            <p className="mt-2 text-xs text-gray-500">
              Error ID: {error.digest}
            </p>
          )}

          <button
            onClick={() => reset()}
            className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try again
          </button>

          <a
            href="/"
            className="mt-2 block w-full text-center text-sm text-blue-600 hover:text-blue-700"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
