/**
 * Unit tests for lib/ai/assess-evidence/utils.ts
 *
 * Covers generateObjectWithRetry: success, retry-then-succeed, exhausted
 * retries, circuit-breaker trip.
 *
 * Timeout test (AI_CALL_TIMEOUT_MS = 90s) is not covered: the real timeout
 * value is far above any practical test budget and there is no prod-safe way
 * to override it without changing production code — that path is excluded per
 * plan step 5 guidance.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  generateObjectWithRetry,
  MAX_AI_CALL_ATTEMPTS,
  ProviderTrippedError,
} from "@/lib/ai/assess-evidence/utils";
import { setCircuitBreakerOverrideForTesting } from "@/lib/ai/circuit-breaker";
import {
  failingModel,
  installMockModel,
  mockObjectModel,
  resetMockModel,
} from "@/lib/ai/testing/mock-model";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SCHEMA = z.object({
  result: z.enum(["pass", "fail", "partial", "not_applicable"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const LOG_CONTEXT = {
  requestId: "test-req-id",
  sessionId: "test-session",
  evidenceId: "evidence-1",
  evidenceContentHash: "abc123",
  scfControlId: "SCF-TEST-1",
};

function makeParams(model: ReturnType<typeof mockObjectModel>) {
  return {
    model,
    schema: SCHEMA,
    prompt: "Assess this evidence",
  } as Parameters<typeof import("ai").generateObject>[0];
}

// ---------------------------------------------------------------------------
// generateObjectWithRetry: success on first try
// ---------------------------------------------------------------------------

test("generateObjectWithRetry: succeeds on first try — one model call", async () => {
  const canned = { result: "pass", confidence: 0.9, reasoning: "Evidence is clear" };
  const model = mockObjectModel([canned]);

  // Ensure circuit breaker is open
  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(model);
  try {
    const result = await generateObjectWithRetry(
      makeParams(model),
      LOG_CONTEXT,
      "createBasicAssessment"
    );

    const typed = result.object as z.infer<typeof SCHEMA>;
    assert.equal(typed.result, "pass");
    assert.equal(typed.confidence, 0.9);
    assert.equal(model.doGenerateCalls.length, 1, "exactly one model call");
  } finally {
    resetMockModel();
    setCircuitBreakerOverrideForTesting(null);
  }
});

// ---------------------------------------------------------------------------
// generateObjectWithRetry: fails once then succeeds
// ---------------------------------------------------------------------------

test("generateObjectWithRetry: fails once then succeeds — exactly 2 model calls", async () => {
  const canned = { result: "partial", confidence: 0.5, reasoning: "Partial evidence" };
  const transientError = new Error("Transient network error");
  const model = failingModel(transientError, 1, canned);

  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(model);
  try {
    const result = await generateObjectWithRetry(
      makeParams(model),
      LOG_CONTEXT,
      "createBasicAssessment"
    );

    const typed = result.object as z.infer<typeof SCHEMA>;
    assert.equal(typed.result, "partial");
    assert.equal(model.doGenerateCalls.length, 2, "exactly 2 model calls");
  } finally {
    resetMockModel();
    setCircuitBreakerOverrideForTesting(null);
  }
});

// ---------------------------------------------------------------------------
// generateObjectWithRetry: exhausts MAX_AI_CALL_ATTEMPTS — throws last error
// ---------------------------------------------------------------------------

test("generateObjectWithRetry: fails MAX_AI_CALL_ATTEMPTS times — throws the last error", async () => {
  const persistentError = new Error("Persistent provider error");
  // failingModel with failCount >= MAX_AI_CALL_ATTEMPTS never succeeds
  const model = failingModel(persistentError, MAX_AI_CALL_ATTEMPTS, null);

  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(model);
  try {
    await assert.rejects(
      () => generateObjectWithRetry(makeParams(model), LOG_CONTEXT, "createBasicAssessment"),
      (err: Error) => {
        assert.equal(err.message, persistentError.message, "last error is propagated");
        assert.equal(
          model.doGenerateCalls.length,
          MAX_AI_CALL_ATTEMPTS,
          `exactly ${MAX_AI_CALL_ATTEMPTS} model calls before giving up`
        );
        return true;
      }
    );
  } finally {
    resetMockModel();
    setCircuitBreakerOverrideForTesting(null);
  }
});

// ---------------------------------------------------------------------------
// generateObjectWithRetry: circuit breaker tripped — zero model calls
// ---------------------------------------------------------------------------

test("generateObjectWithRetry: circuit breaker tripped — throws ProviderTrippedError with zero model calls", async () => {
  const canned = { result: "pass", confidence: 0.9, reasoning: "Would succeed" };
  const model = mockObjectModel([canned]);

  setCircuitBreakerOverrideForTesting({ allowed: false });
  installMockModel(model);
  try {
    await assert.rejects(
      () => generateObjectWithRetry(makeParams(model), LOG_CONTEXT, "createBasicAssessment"),
      (err: Error) => {
        assert.ok(
          err instanceof ProviderTrippedError,
          `expected ProviderTrippedError, got ${err.constructor.name}`
        );
        assert.equal(model.doGenerateCalls.length, 0, "zero model calls when tripped");
        return true;
      }
    );
  } finally {
    resetMockModel();
    setCircuitBreakerOverrideForTesting(null);
  }
});

// not covered: AI_CALL_TIMEOUT_MS (90s) — too long for a test, and overriding
// it would require a prod code change beyond the two approved seams.

// ---------------------------------------------------------------------------
// Pure utility functions (no mock model needed)
// ---------------------------------------------------------------------------

import {
  withTimeout,
  confidenceLevelToScore,
  isTimeoutError,
  buildEvidenceText,
  createControlRunKey,
} from "@/lib/ai/assess-evidence/utils";

test("withTimeout: resolves when promise settles before the deadline", async () => {
  const result = await withTimeout(Promise.resolve(42), 5_000, "should not fire");
  assert.equal(result, 42);
});

test("withTimeout: rejects with the timeout message when deadline is exceeded", async () => {
  const neverResolves = new Promise<never>(() => undefined);
  await assert.rejects(
    () => withTimeout(neverResolves, 10, "timed out in test"),
    (err: Error) => {
      assert.equal(err.message, "timed out in test");
      return true;
    }
  );
});

test("withTimeout: propagates the underlying rejection (not a timeout error)", async () => {
  const boom = Promise.reject(new Error("underlying error"));
  await assert.rejects(
    () => withTimeout(boom, 5_000, "timeout label"),
    (err: Error) => {
      assert.equal(err.message, "underlying error");
      return true;
    }
  );
});

test("confidenceLevelToScore: maps 'high' → 0.9, 'medium' → 0.6, anything else → 0.3", () => {
  assert.equal(confidenceLevelToScore("high"), 0.9);
  assert.equal(confidenceLevelToScore("medium"), 0.6);
  assert.equal(confidenceLevelToScore("low"), 0.3);
  assert.equal(confidenceLevelToScore(null), 0.3);
  assert.equal(confidenceLevelToScore(undefined), 0.3);
  assert.equal(confidenceLevelToScore("unknown"), 0.3);
});

test("isTimeoutError: true for messages containing 'timed out', false otherwise", () => {
  assert.equal(isTimeoutError(new Error("AI call timed out")), true);
  assert.equal(isTimeoutError(new Error("TIMED OUT uppercase")), true);
  assert.equal(isTimeoutError(new Error("connection refused")), false);
  assert.equal(isTimeoutError("not an error"), false);
  assert.equal(isTimeoutError(null), false);
});

test("buildEvidenceText: without image wraps content in 'Evidence:' prefix", () => {
  const text = buildEvidenceText("my evidence", null);
  assert.ok(text.startsWith("DOCUMENT TEXT"));
  assert.ok(text.includes("my evidence"));
});

test("buildEvidenceText: with image prepends OCR label and includes original content", () => {
  const text = buildEvidenceText("ocr text", { base64: "abc", mimeType: "image/png" });
  assert.ok(text.includes("DOCUMENT TEXT"));
  assert.ok(text.includes("ocr text"));
});

test("buildEvidenceText: includes full content by default", () => {
  const marker = "OKTA_SAML_2FA_AFTER_2000";
  const content = `${"a".repeat(2500)}${marker}`;
  const text = buildEvidenceText(content, null);
  assert.ok(text.includes(marker));
});

test("createControlRunKey: produces a 64-char hex string deterministically", () => {
  const key1 = createControlRunKey("ev-1", "SCF-AC-1", "hash-a");
  const key2 = createControlRunKey("ev-1", "SCF-AC-1", "hash-a");
  const key3 = createControlRunKey("ev-1", "SCF-AC-1", "hash-b");
  assert.equal(typeof key1, "string");
  assert.equal(key1.length, 64); // sha256 hex
  assert.equal(key1, key2, "same inputs → same key");
  assert.notEqual(key1, key3, "different hash → different key");
});
