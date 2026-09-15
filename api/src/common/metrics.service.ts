/**
 * Metrics collection service for monitoring
 *
 * Collects basic metrics:
 * - Request count by endpoint
 * - Response times by endpoint
 * - Error rates by status code
 * - Database query times
 *
 * Metrics are aggregated in-memory and can be exported for monitoring tools
 */

import { Injectable } from '@nestjs/common';

export interface EndpointMetrics {
  endpoint: string;
  method: string;
  requestCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorCount: number;
  errorRate: number; // percentage
  lastUpdated: Date;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number; // milliseconds
  endpoints: EndpointMetrics[];
  summary: {
    totalRequests: number;
    totalErrors: number;
    overallErrorRate: number;
    avgResponseTime: number;
  };
}

interface RequestMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
}

@Injectable()
export class MetricsService {
  private metrics: Map<string, RequestMetric[]> = new Map();
  private startTime = Date.now();
  private readonly MAX_METRICS_PER_ENDPOINT = 1000; // Keep last 1000 requests per endpoint

  recordRequest(method: string, endpoint: string, statusCode: number, responseTime: number) {
    const key = `${method} ${endpoint}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const endpointMetrics = this.metrics.get(key)!;
    endpointMetrics.push({
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: new Date(),
    });

    // Keep only recent metrics to avoid memory bloat
    if (endpointMetrics.length > this.MAX_METRICS_PER_ENDPOINT) {
      endpointMetrics.shift();
    }
  }

  getEndpointMetrics(): EndpointMetrics[] {
    const results: EndpointMetrics[] = [];

    for (const [, requestMetrics] of this.metrics) {
      if (requestMetrics.length === 0) continue;

      const errors = requestMetrics.filter((m) => m.statusCode >= 400);
      const responseTimes = requestMetrics.map((m) => m.responseTime);

      results.push({
        endpoint: requestMetrics[0].endpoint,
        method: requestMetrics[0].method,
        requestCount: requestMetrics.length,
        avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        errorCount: errors.length,
        errorRate: Math.round((errors.length / requestMetrics.length) * 100 * 100) / 100, // 2 decimal places
        lastUpdated: requestMetrics[requestMetrics.length - 1].timestamp,
      });
    }

    return results.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  getMetricsSnapshot(): MetricsSnapshot {
    const endpoints = this.getEndpointMetrics();
    const totalRequests = endpoints.reduce((sum, e) => sum + e.requestCount, 0);
    const totalErrors = endpoints.reduce((sum, e) => sum + e.errorCount, 0);
    const totalResponseTime = endpoints.reduce((sum, e) => sum + e.avgResponseTime * e.requestCount, 0);

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      endpoints,
      summary: {
        totalRequests,
        totalErrors,
        overallErrorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100 * 100) / 100 : 0,
        avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
      },
    };
  }

  reset() {
    this.metrics.clear();
    this.startTime = Date.now();
  }
}
