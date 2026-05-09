type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

function formatMessage(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>
) {
  const payload = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  return JSON.stringify(payload);
}

export function createLogger(module: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("debug")) console.debug(formatMessage("debug", module, message, data));
    },
    info: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("info")) console.info(formatMessage("info", module, message, data));
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("warn")) console.warn(formatMessage("warn", module, message, data));
    },
    error: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog("error")) console.error(formatMessage("error", module, message, data));
    },
  };
}
