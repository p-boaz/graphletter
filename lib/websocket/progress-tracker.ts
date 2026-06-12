/**
 * @deprecated Runtime progress tracking has moved to lib/progress/progress-store.ts.
 *
 * This file is retained only to satisfy the `import type { ProgressUpdate }`
 * in hooks/use-progress-tracker.ts (a type-only import that is erased at
 * compile time).  Do not add runtime exports here.
 */

// Re-export the types that external callers depend on.
export type { ProgressSession } from "@/lib/progress/progress-store";

/**
 * Shape of a single progress update event emitted over SSE.
 * Must stay compatible with the payload built in app/api/ws/progress/route.ts.
 */
export interface ProgressUpdate {
  sessionId: string;
  stage: string;
  progress: number; // 0–100
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
