/**
 * Log shipper service for sending logs to Better Stack (or any log aggregation service)
 *
 * Features:
 * - Batches logs to reduce API calls
 * - Includes tenant context in request headers
 * - Handles backpressure (queues logs if service is down)
 * - Fallback to local file storage if remote fails
 * - Retries with exponential backoff
 * - Non-blocking (doesn't slow down request processing)
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { LogEntry } from './logger.service.js';

interface BatchedLogs {
  tenantId?: string;
  logs: LogEntry[];
  timestamp: number;
}

@Injectable()
export class LogShipperService implements OnModuleInit, OnModuleDestroy {
  private queue: LogEntry[] = [];
  private batchTimer?: NodeJS.Timeout;
  private fallbackLogPath: string;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_INTERVAL_MS = 5000; // 5 seconds
  private readonly MAX_QUEUE_SIZE = 10000;
  private readonly MAX_RETRIES = 3;
  private retryCount = 0;
  private isShuttingDown = false;

  private enabled: boolean;
  private endpoint: string;
  private sourceToken: string;

  constructor(private config: ConfigService) {
    this.enabled = !!this.config.get('LOG_SHIPPER_ENABLED');
    this.endpoint = this.config.get('LOG_SHIPPER_ENDPOINT') || 'https://in.betterstack.com/api/v1/logs';
    this.sourceToken = this.config.get('LOG_SHIPPER_SOURCE_TOKEN') || '';

    // Fallback log file in /tmp (for Docker) or local temp directory
    this.fallbackLogPath = this.config.get('LOG_FALLBACK_PATH') || path.join('/tmp', 'logs-fallback.jsonl');
  }

  onModuleInit() {
    // Start batch processing if enabled
    if (this.enabled && this.sourceToken) {
      this.startBatchTimer();
    }
  }

  onModuleDestroy() {
    // Flush remaining logs on shutdown
    this.isShuttingDown = true;
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    // Synchronously flush remaining logs
    this.flushSync();
  }

  /**
   * Queue a log entry for shipping
   * Called by LoggerService after outputting to stdout
   */
  queueLog(logEntry: LogEntry): void {
    if (!this.enabled) return;

    // Don't queue if we're at capacity
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Write directly to fallback if queue is full
      this.writeFallback(logEntry);
      return;
    }

    this.queue.push(logEntry);

    // Auto-flush if batch is full
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Manually flush the queue
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.BATCH_SIZE);
    const tenantId = batch[0]?.tenantId;

    try {
      await this.sendBatch(batch, tenantId);
      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      // Re-queue the batch and try again
      this.queue.unshift(...batch);

      // If retries exhausted, write to fallback
      if (this.retryCount >= this.MAX_RETRIES) {
        console.error('Log shipping failed, writing to fallback storage', {
          error: (error as Error).message,
          queueSize: this.queue.length,
        });
        batch.forEach((log) => this.writeFallback(log));
        this.queue = this.queue.slice(batch.length);
        this.retryCount = 0;
      } else {
        this.retryCount++;
        // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s)
        const backoffMs = Math.pow(2, this.retryCount) * 1000;
        setTimeout(() => this.flush(), backoffMs);
      }
    }
  }

  /**
   * Synchronous flush for shutdown (best effort)
   */
  private flushSync(): void {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.BATCH_SIZE);
      batch.forEach((log) => this.writeFallback(log));
    }
  }

  /**
   * Send batch of logs to Better Stack (or configured endpoint)
   */
  private async sendBatch(logs: LogEntry[], tenantId?: string): Promise<void> {
    if (!this.sourceToken) {
      throw new Error('LOG_SHIPPER_SOURCE_TOKEN not configured');
    }

    const payload = {
      dt: new Date().toISOString(),
      source_token: this.sourceToken,
      ...(tenantId && { tenant_id: tenantId }),
      logs: logs.map((log) => ({
        dt: log.timestamp,
        level: log.level,
        message: log.message,
        request_id: log.requestId,
        tenant_id: log.tenantId,
        user_id: log.userId,
        user_role: log.userRole,
        duration: log.duration,
        status_code: log.statusCode,
        endpoint: log.endpoint,
        // Include any additional fields
        ...Object.fromEntries(
          Object.entries(log).filter(
            ([key]) => !['timestamp', 'level', 'message', 'requestId', 'tenantId', 'userId', 'userRole', 'duration', 'statusCode', 'endpoint'].includes(key),
          ),
        ),
      })),
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sourceToken}`,
        ...(tenantId && { 'X-Tenant-ID': tenantId }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Better Stack API error: ${response.status} ${errorBody}`);
    }
  }

  /**
   * Write log to fallback file (JSONL format)
   * Used when Better Stack is unavailable or queue is full
   */
  private writeFallback(logEntry: LogEntry): void {
    try {
      const line = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.fallbackLogPath, line, { encoding: 'utf-8' });
    } catch (error) {
      // If fallback file write also fails, just log to stderr
      // (don't throw, as this would crash the request)
      console.error('Failed to write to fallback log', {
        error: (error as Error).message,
        logEntry: logEntry.message,
      });
    }
  }

  /**
   * Start periodic batch flushing
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.BATCH_INTERVAL_MS);

    // Don't hold the process open waiting for this timer
    this.batchTimer.unref();
  }

  /**
   * Get fallback log file path (for monitoring/retrieval)
   */
  getFallbackLogPath(): string {
    return this.fallbackLogPath;
  }

  /**
   * Get current queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if fallback log file has content
   */
  hasFallbackLogs(): boolean {
    try {
      const stats = fs.statSync(this.fallbackLogPath);
      return stats.size > 0;
    } catch {
      return false;
    }
  }
}
