export interface MiddlewareRateLimitConfig {
  namespace: string;
  windowMs: number;
  maxRequests: number;
  message: string;
}

const MUTATING_ROUTE_CONFIGS: Array<{
  pattern: RegExp;
  config: MiddlewareRateLimitConfig;
}> = [
  {
    pattern:
      /^\/api\/(ai|analysis|artifacts|compliance|controls|documents|evidence|scf\/import|try-it-out)\b/,
    config: {
      namespace: "api_expensive_mutation",
      windowMs: 60_000,
      maxRequests: 20,
      message: "Rate limit exceeded for API write operations. Please retry shortly.",
    },
  },
  {
    pattern: /^\/api\/(assessments|user\/profile|users)\b/,
    config: {
      namespace: "api_state_change",
      windowMs: 60_000,
      maxRequests: 30,
      message: "Rate limit exceeded for API write operations. Please retry shortly.",
    },
  },
];

const ENUMERATIVE_ROUTE_CONFIGS: Array<{
  pattern: RegExp;
  config: MiddlewareRateLimitConfig;
}> = [
  {
    pattern: /^\/api\/users$/,
    config: {
      namespace: "api_users_index",
      windowMs: 60_000,
      maxRequests: 30,
      message: "Rate limit exceeded for directory access. Please retry shortly.",
    },
  },
  {
    pattern:
      /^\/api\/(assessments|assessments\/history|dashboard\/overview|enhanced\/search|evidence|evidence\/stats|evidence\/count|ai-assessment-logs)\b/,
    config: {
      namespace: "api_enumeration",
      windowMs: 60_000,
      maxRequests: 60,
      message: "Rate limit exceeded for API reads. Please retry shortly.",
    },
  },
];

export function getApiRateLimitConfig(
  pathname: string,
  method: string
): MiddlewareRateLimitConfig | null {
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "GET") {
    // Public SCF catalog reads remain exempt to keep the reference data browseable.
    if (pathname.startsWith("/api/scf/")) {
      return null;
    }

    return ENUMERATIVE_ROUTE_CONFIGS.find(({ pattern }) => pattern.test(pathname))?.config ?? null;
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    return (
      MUTATING_ROUTE_CONFIGS.find(({ pattern }) => pattern.test(pathname))?.config ?? {
        namespace: "api_mutation_default",
        windowMs: 60_000,
        maxRequests: 40,
        message: "Rate limit exceeded for API write operations. Please retry shortly.",
      }
    );
  }

  return null;
}
