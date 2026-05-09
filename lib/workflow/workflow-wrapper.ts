/**
 * Vercel Workflow wrapper utilities for Next.js integration
 *
 * Provides helpers to integrate Workflow Development Kit with Next.js API routes
 * for durable, resumable, and observable async operations.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/workflow/workflow-wrapper");

/**
 * Workflow error types for proper retry handling
 */
export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

/**
 * Workflow step configuration
 */
export interface StepConfig {
  maxRetries?: number;
  retryDelay?: string; // e.g., "5s", "1m", "10s"
  timeout?: string; // e.g., "5m", "10m", "30s"
}

/**
 * Wrapper for Next.js API route to enable workflow functionality
 *
 * Usage:
 * ```typescript
 * export const POST = withWorkflow(async (request: NextRequest) => {
 *   "use workflow"
 *
 *   const result = await someWorkflowStep()
 *   return NextResponse.json({ result })
 * })
 * ```
 */
export function withWorkflow(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      // Handle workflow errors
      if (error instanceof FatalError) {
        console.error("Fatal workflow error:", error);
        return NextResponse.json({ error: error.message, fatal: true }, { status: 500 });
      }

      if (error instanceof RetryableError) {
        console.warn("Retryable workflow error:", error);
        // Workflow will automatically retry this step
        throw error;
      }

      // Unknown errors are treated as retryable by default
      console.error("Workflow error:", error);
      throw error;
    }
  };
}

/**
 * Helper to create a workflow step with configuration
 *
 * Usage:
 * ```typescript
 * const uploadFile = createStep(async (file: File) => {
 *   "use step"
 *   // Upload logic here
 *   return uploadResult
 * }, { maxRetries: 3, retryDelay: "5s" })
 * ```
 */
export function createStep<TArgs extends unknown[], TResult>(
  stepFn: (...args: TArgs) => Promise<TResult>,
  _config?: StepConfig
): (...args: TArgs) => Promise<TResult> {
  void _config;
  return async (...args: TArgs) => {
    try {
      return await stepFn(...args);
    } catch (error) {
      // Step errors are automatically retried by Workflow
      if (error instanceof FatalError) {
        throw error; // Don't retry fatal errors
      }
      throw error; // Retry all other errors
    }
  };
}

/**
 * Workflow progress tracking helpers
 */
export interface WorkflowProgress {
  workflowId: string;
  step: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress?: number; // 0-100
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log workflow progress for observability
 */
export function logProgress(progress: WorkflowProgress) {
  log.info("Workflow progress", {
    workflowId: progress.workflowId,
    step: progress.step,
    status: progress.status,
    progress: progress.progress as unknown as string,
    message: progress.message,
  });
}

/**
 * Sleep for a duration (workflow-aware)
 *
 * Usage:
 * ```typescript
 * await sleep("5s")   // 5 seconds
 * await sleep("2m")   // 2 minutes
 * await sleep("1h")   // 1 hour
 * await sleep("7d")   // 7 days
 * ```
 */
export async function sleep(duration: string): Promise<void> {
  // In workflow context, this would use Workflow's sleep()
  // For now, we'll import it directly from workflow package
  const { sleep: workflowSleep } = await import("workflow");
  return workflowSleep(duration as unknown as Parameters<typeof workflowSleep>[0]);
}

/**
 * Workflow metadata helpers
 */
export async function getWorkflowMetadata() {
  try {
    const { getWorkflowMetadata: getMetadata } = await import("workflow");
    return getMetadata();
  } catch {
    return null;
  }
}

export async function getStepMetadata() {
  try {
    const { getStepMetadata: getMetadata } = await import("workflow");
    return getMetadata();
  } catch {
    return null;
  }
}

/**
 * Type-safe workflow fetch wrapper
 *
 * Uses Workflow's fetch() which is serialization-aware
 */
export async function workflowFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const { fetch: workflowFetchFn } = await import("workflow");
    return workflowFetchFn(url, options);
  } catch {
    // Fallback to regular fetch if workflow not available
    return fetch(url, options);
  }
}
