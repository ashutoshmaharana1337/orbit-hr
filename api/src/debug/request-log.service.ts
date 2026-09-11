import { Injectable } from '@nestjs/common';

export type RequestLogEntry = {
  time: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

const MAX_ENTRIES = 200;

// Dev-only debugging aid (see DebugModule) — an in-memory ring buffer, not a
// durable audit log. Fine to lose on restart; never persisted or per-tenant.
@Injectable()
export class RequestLogService {
  private entries: RequestLogEntry[] = [];

  record(entry: RequestLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
  }

  list(): RequestLogEntry[] {
    return [...this.entries].reverse();
  }
}
