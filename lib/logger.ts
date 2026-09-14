/**
 * Structured logger.
 *
 * A one-file seam between the codebase and whatever transport we
 * eventually ship logs to (Sentry, Datadog, Axiom, or plain console).
 * Every caller uses `log.info` / `log.warn` / `log.error` / `log.debug`
 * and never touches `console` directly, so switching transports is a
 * change to THIS file only.
 *
 * Today: writes to console with a `[level]` prefix and a JSON context
 * suffix. Nothing else. The audit called out 119 scattered `console.*`
 * calls — the migration off them is a later phase; this file just
 * gives that migration a landing spot.
 *
 * Design choices:
 *   - `log.error` accepts an `Error` directly and normalises name /
 *     message / stack into the context payload. Callers no longer
 *     have to remember to spread `err` manually.
 *   - Context is serialised with a safe wrapper — a circular ref or
 *     BigInt in the payload prints "[unserialisable]" instead of
 *     crashing the request.
 *   - No hidden gating (LOG_LEVEL, sampling, etc.) yet. Add here
 *     when needed; keep consumers unchanged.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserialisable]";
  }
}

function emit(level: LogLevel, message: string, context?: LogContext | Error): void {
  const payload: LogContext | undefined =
    context instanceof Error
      ? {
          errorName: context.name,
          errorMessage: context.message,
          stack: context.stack,
        }
      : context;

  const line =
    payload !== undefined
      ? `[${level}] ${message} ${safeJson(payload)}`
      : `[${level}] ${message}`;

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export const log = {
  debug: (message: string, context?: LogContext): void => emit("debug", message, context),
  info: (message: string, context?: LogContext): void => emit("info", message, context),
  warn: (message: string, context?: LogContext): void => emit("warn", message, context),
  error: (message: string, context?: LogContext | Error): void =>
    emit("error", message, context),
};
