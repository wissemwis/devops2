export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogFields = Record<string, unknown>;

const SEVERITY: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const DEFAULT_LEVEL: LogLevel = 'info';

function isLogLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && Object.hasOwn(SEVERITY, value);
}

function threshold(): number {
  const configured = process.env.LOG_LEVEL;
  return SEVERITY[isLogLevel(configured) ? configured : DEFAULT_LEVEL];
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (SEVERITY[level] > threshold()) return;
  const extra = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serialise(value)]),
  );
  const entry = { ...extra, level, message, timestamp: new Date().toISOString() };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const logger: Record<LogLevel, (message: string, fields?: LogFields) => void> = {
  error: (message, fields) => write('error', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  info: (message, fields) => write('info', message, fields),
  debug: (message, fields) => write('debug', message, fields),
};
