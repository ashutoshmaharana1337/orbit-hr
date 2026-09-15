import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ConfigService } from '@nestjs/config';

/**
 * Service for initializing and managing Sentry error tracking.
 * Provides methods to set context, capture exceptions, and manage error reporting.
 */
@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);

  constructor(private config: ConfigService) {
    this.initializeSentry();
  }

  /**
   * Initialize Sentry with configuration from environment variables.
   * Only initializes in non-test environments if DSN is provided.
   */
  private initializeSentry(): void {
    const dsn = this.config.get<string>('SENTRY_DSN');
    const environment = this.config.get<string>('NODE_ENV', 'development');

    // Only initialize if DSN is provided and not in test environment
    if (!dsn || environment === 'test') {
      this.logger.debug('Sentry initialization skipped (no DSN or test environment)');
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment,
        // Sample traces: 10% in production, 100% in development
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        // Capture unhandled promise rejections and exceptions
        attachStacktrace: true,
        // Release tracking (can be set via environment or git)
        release: this.config.get<string>('SENTRY_RELEASE'),
        // Default integrations handle most common cases
        // @sentry/nestjs automatically includes:
        // - Http integration
        // - OnUncaughtException integration
        // - OnUnhandledRejection integration
      });

      this.logger.log(`Sentry initialized for ${environment} environment`);
    } catch (error) {
      this.logger.error('Failed to initialize Sentry', error);
    }
  }

  /**
   * Set user context for error reporting.
   * Associates all subsequent errors with this user.
   *
   * @param userId - Unique identifier for the user
   * @param email - User's email address
   * @param username - User's name (optional)
   */
  setUserContext(userId: string, email?: string, username?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }

  /**
   * Clear user context.
   * Call this when user logs out.
   */
  clearUserContext(): void {
    Sentry.setUser(null);
  }

  /**
   * Set tenant context as a tag.
   * Critical for multi-tenant debugging.
   *
   * @param tenantId - Tenant identifier
   */
  setTenantContext(tenantId: string): void {
    Sentry.setTag('tenantId', tenantId);
    Sentry.setContext('tenant', { id: tenantId });
  }

  /**
   * Set role context as a tag.
   * Helps debug role-based access control issues.
   *
   * @param role - User's role
   */
  setRoleContext(role: string): void {
    Sentry.setTag('userRole', role);
  }

  /**
   * Set request ID for correlation.
   * Links errors to specific requests.
   *
   * @param requestId - Unique request identifier
   */
  setRequestId(requestId: string): void {
    Sentry.setTag('requestId', requestId);
  }

  /**
   * Capture an exception in Sentry.
   * Automatically includes all previously set context.
   *
   * @param error - The error to capture
   * @param level - Error level (fatal, error, warning, info)
   */
  captureException(error: Error, level: Sentry.SeverityLevel = 'error'): void {
    Sentry.captureException(error, { level });
  }

  /**
   * Capture a message in Sentry.
   * Useful for non-exception errors or important events.
   *
   * @param message - The message to capture
   * @param level - Message level (fatal, error, warning, info, debug)
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
    Sentry.captureMessage(message, level);
  }

  /**
   * Create a transaction for tracking performance.
   * Useful for monitoring slow operations.
   *
   * Note: Transactions are primarily managed by the SentryContextInterceptor.
   * This method is here for advanced usage in services.
   *
   * @param name - Transaction name
   * @param op - Operation type (e.g., 'http.request', 'db.query')
   */
  startTransaction(name: string, op: string = 'operation') {
    // Transactions are handled automatically by @sentry/nestjs integrations
    // This is a placeholder for future advanced usage
    return { name, op };
  }

  /**
   * Add custom context for debugging.
   *
   * @param name - Context name
   * @param data - Context data (any object)
   */
  setCustomContext(name: string, data: Record<string, any>): void {
    Sentry.setContext(name, data);
  }

  /**
   * Get the Sentry instance for advanced usage.
   */
  getSentry() {
    return Sentry;
  }
}
