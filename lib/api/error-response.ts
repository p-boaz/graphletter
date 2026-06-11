import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-error");

/**
 * Log full error detail server-side; return only a generic, caller-safe
 * message. `context` is a stable event name like "assessments.create_failed".
 */
export function apiError(
  context: string,
  publicMessage: string,
  status: number,
  error?: unknown
): NextResponse {
  log.error(context, {
    status,
    message: error instanceof Error ? error.message : String(error ?? ""),
  });
  return NextResponse.json({ error: publicMessage }, { status });
}
