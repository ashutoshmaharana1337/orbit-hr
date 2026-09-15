/**
 * Liveness probe configuration for container orchestration
 *
 * Liveness probe checks if the application is still running and responsive.
 * If liveness checks fail consistently, the container is restarted.
 *
 * Configuration details:
 * - Endpoint: GET /api/health
 * - Interval: 30 seconds (checks happen every 30s)
 * - Timeout: 5 seconds (wait max 5s for response)
 * - Failure threshold: 3 consecutive failures = restart
 * - Initial delay: 15 seconds (wait for app to start)
 *
 * Total time before restart: 15s (initial) + (3 failures × (30s + 5s timeout)) = 120s
 */

export const LIVENESS_PROBE_CONFIG = {
  endpoint: '/api/health',
  httpMethod: 'GET',
  port: parseInt(process.env.PORT || '3001', 10),
  // Timing configuration (in seconds)
  interval: 30,
  timeout: 5,
  initialDelaySeconds: 15,
  failureThreshold: 3,
  // Calculated total time before restart
  totalTimeBeforeRestart: 15 + 3 * (30 + 5), // 120 seconds
};

/**
 * Docker Healthcheck equivalent
 * dockerfile: HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:3001/api/health || exit 1
 */

/**
 * Kubernetes readinessProbe configuration
 * This should be applied to the deployment spec
 */
export const KUBERNETES_READINESS_PROBE = {
  httpGet: {
    path: '/api/health',
    port: 3001,
    scheme: 'HTTP',
  },
  initialDelaySeconds: 10,
  periodSeconds: 5, // Check more frequently for readiness
  timeoutSeconds: 3,
  failureThreshold: 2,
  successThreshold: 1,
};

/**
 * Kubernetes liveness probe configuration
 */
export const KUBERNETES_LIVENESS_PROBE = {
  httpGet: {
    path: '/api/health',
    port: 3001,
    scheme: 'HTTP',
  },
  initialDelaySeconds: 30,
  periodSeconds: 30,
  timeoutSeconds: 5,
  failureThreshold: 3,
  successThreshold: 1,
};
