export interface RequestLogger {
  requestId: string;
  info: (event: string, details?: Record<string, unknown>) => void;
  warn: (event: string, details?: Record<string, unknown>) => void;
  error: (event: string, details?: Record<string, unknown>) => void;
}

function writeLog(
  level: "info" | "warn" | "error",
  requestId: string,
  event: string,
  details?: Record<string, unknown>
) {
  const payload = {
    level,
    requestId,
    event,
    timestamp: new Date().toISOString(),
    ...(details || {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }
}

export function createRequestLogger(requestId: string): RequestLogger {
  return {
    requestId,
    info: (event, details) => writeLog("info", requestId, event, details),
    warn: (event, details) => writeLog("warn", requestId, event, details),
    error: (event, details) => writeLog("error", requestId, event, details),
  };
}

export function getOrCreateRequestId(request: Request): string {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}
