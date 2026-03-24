/**
 * Workflow console log store — captures stdout (output) and stderr (error) messages.
 */

export type LogLevel = "output" | "error";

export interface LogEntry {
  readonly id: number;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
}

let _counter = 0;

export function createLogEntry(level: LogLevel, message: string): LogEntry {
  _counter += 1;
  return { id: _counter, level, message, timestamp: Date.now() };
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
