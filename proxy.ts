import { NextResponse, type NextRequest } from "next/server";
import { getApiRateLimitConfig } from "@/lib/api/rate-limit-config";
import {
  checkFixedWindowRateLimit,
  createRateLimitHeaders,
  getClientIpAddress,
} from "@/lib/security/rate-limit";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const config = getApiRateLimitConfig(pathname, request.method);

  if (!config) {
    return NextResponse.next();
  }

  const clientIp = getClientIpAddress(request.headers) ?? "unknown";
  const result = checkFixedWindowRateLimit({
    namespace: `${config.namespace}:${request.method.toUpperCase()}`,
    key: clientIp,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  });

  if (result.allowed) {
    return NextResponse.next();
  }

  return NextResponse.json(
    {
      error: config.message,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result),
    }
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
