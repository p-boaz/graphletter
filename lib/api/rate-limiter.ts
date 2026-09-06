import { NextResponse } from "next/server";
import {
  checkFixedWindowRateLimit,
  createRateLimitHeaders,
  type FixedWindowRateLimitResult,
  getClientIpAddress,
} from "@/lib/security/rate-limit";

export interface RouteRateLimiterConfig {
  namespace: string;
  user: { windowMs: number; maxRequests: number };
  ip: { windowMs: number; maxRequests: number };
  message?: string;
}

function buildRateLimitResponse(message: string, result: FixedWindowRateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result),
    }
  );
}

/**
 * Creates a rate limiter for an API route that checks both user-level and IP-level limits.
 * Returns a NextResponse(429) if rate limited, or null if the request is allowed.
 */
export function checkRouteRateLimit(
  config: RouteRateLimiterConfig,
  userId: string,
  requestHeaders: Headers
): NextResponse | null {
  const baseMessage = config.message ?? "Rate limit exceeded. Please retry shortly.";

  const userResult = checkFixedWindowRateLimit({
    namespace: `${config.namespace}:user`,
    key: userId,
    windowMs: config.user.windowMs,
    maxRequests: config.user.maxRequests,
  });

  if (!userResult.allowed) {
    return buildRateLimitResponse(baseMessage, userResult);
  }

  const clientIp = getClientIpAddress(requestHeaders);
  if (clientIp) {
    const ipResult = checkFixedWindowRateLimit({
      namespace: `${config.namespace}:ip`,
      key: clientIp,
      windowMs: config.ip.windowMs,
      maxRequests: config.ip.maxRequests,
    });

    if (!ipResult.allowed) {
      return buildRateLimitResponse(baseMessage.replace(".", " from this IP."), ipResult);
    }
  }

  return null;
}
