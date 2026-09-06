import { NextResponse } from "next/server";
import { getCurrentUser } from "@/utils/auth";

type AuthGuardResult =
  | {
      user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
    }
  | {
      response: NextResponse;
    };

interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}

interface UserRateLimitOptions {
  scope: string;
  userId: string;
  limit: number;
  windowMs: number;
}

const userRateLimitBuckets = new Map<string, RateLimitBucket>();
let rateLimitTouches = 0;
const RATE_LIMIT_CLEANUP_INTERVAL = 500;

function cleanupExpiredRateLimitBuckets(nowMs: number) {
  for (const [key, bucket] of userRateLimitBuckets.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      userRateLimitBuckets.delete(key);
    }
  }
}

export async function requireAuthenticatedUser(): Promise<AuthGuardResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return { user };
  } catch {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}

export function enforceUserRateLimit(options: UserRateLimitOptions): NextResponse | null {
  const nowMs = Date.now();
  const key = `${options.scope}:${options.userId}`;
  const existingBucket = userRateLimitBuckets.get(key);

  if (!existingBucket || existingBucket.resetAtMs <= nowMs) {
    userRateLimitBuckets.set(key, {
      count: 1,
      resetAtMs: nowMs + options.windowMs,
    });
    return null;
  }

  existingBucket.count += 1;
  userRateLimitBuckets.set(key, existingBucket);

  rateLimitTouches += 1;
  if (rateLimitTouches % RATE_LIMIT_CLEANUP_INTERVAL === 0) {
    cleanupExpiredRateLimitBuckets(nowMs);
  }

  if (existingBucket.count <= options.limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existingBucket.resetAtMs - nowMs) / 1000));

  return NextResponse.json(
    {
      error: "Rate limit exceeded. Please try again shortly.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(options.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
