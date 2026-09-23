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
    const result: LogFields = { name: value.name, message: value.message, stack: value.stack };
    if (value.cause !== undefined) {
      result.cause = serialise(value.cause);
    }
    const digest = (value as Error & { digest?: unknown }).digest;
    if (typeof digest === 'string') {
      result.digest = digest;
    }
    return result;
  }
  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (SEVERITY[level] > threshold()) return;
  const extra = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serialise(value)]),
  );
  const timestamp = new Date().toISOString();
  const entry = { ...extra, level, message, timestamp };
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch (error) {
    line = JSON.stringify({
      level,
      message,
      timestamp,
      logError: error instanceof Error ? error.message : String(error),
    });
  }
  process.stdout.write(`${line}\n`);
}

export const logger: Record<LogLevel, (message: string, fields?: LogFields) => void> = {
  error: (message, fields) => write('error', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  info: (message, fields) => write('info', message, fields),
  debug: (message, fields) => write('debug', message, fields),
};
