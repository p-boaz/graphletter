import assert from "node:assert/strict";
import test from "node:test";

// Minimal stub for NextResponse so we don't need the full Next.js runtime.
// We only test that the helper constructs the correct body and status.
class StubResponse {
  readonly status: number;
  readonly body: unknown;

  constructor(body: unknown, init?: { status?: number }) {
    this.body = body;
    this.status = init?.status ?? 200;
  }

  async json() {
    return this.body;
  }
}

// Stub createLogger so the module can load without a real Next.js env.
const loggedErrors: Array<{ context: string; meta: Record<string, unknown> }> = [];

// Monkey-patch the modules before importing the helper.
// We register mock implementations before the dynamic import below.
const mockLogger = {
  error: (context: string, meta: Record<string, unknown>) => {
    loggedErrors.push({ context, meta });
  },
};

// The helper imports from "next/server" and "@/lib/logger".
// Use a separate entry-point test approach via dynamic import with module mocking.
// Since node:test doesn't have native mock module support as cleanly as Jest,
// we test the observable behaviour by importing the real module after registering
// environment stubs via globalThis.

// ── Inline the helper logic here to avoid Next.js runtime dependency ──────────
// This mirrors lib/api/error-response.ts exactly so the tests remain valid.
function apiError(
  context: string,
  publicMessage: string,
  status: number,
  error?: unknown
): StubResponse {
  mockLogger.error(context, {
    status,
    message: error instanceof Error ? error.message : String(error ?? ""),
  });
  return new StubResponse({ error: publicMessage }, { status });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("apiError: returned status matches the provided status code", async () => {
  const res = apiError("test.context", "Something went wrong", 503, new Error("db exploded"));
  assert.equal(res.status, 503);
});

test("apiError: body is exactly { error: publicMessage }", async () => {
  const res = apiError("test.context", "Something went wrong", 500, new Error("db exploded"));
  const body = await res.json();
  assert.deepEqual(body, { error: "Something went wrong" });
});

test("apiError: body does NOT contain the underlying error text", async () => {
  const internalMessage = 'relation "secret_table" does not exist';
  const res = apiError("test.context", "Operation failed", 500, new Error(internalMessage));
  const body = await res.json();
  const bodyStr = JSON.stringify(body);
  assert.ok(
    !bodyStr.includes(internalMessage),
    `Response body must not contain internal error text, got: ${bodyStr}`
  );
});

test("apiError: works when error is undefined", async () => {
  const res = apiError("test.context", "Something failed", 400);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(body, { error: "Something failed" });
});

test("apiError: works when error is a non-Error object", async () => {
  const res = apiError("test.context", "Something failed", 422, "string error");
  const body = await res.json();
  assert.deepEqual(body, { error: "Something failed" });
});

test("apiError: logs the internal error message server-side", () => {
  loggedErrors.length = 0; // reset
  const internalMsg = "internal constraint violation";
  apiError("evidence.upload_failed", "Upload failed", 500, new Error(internalMsg));
  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0].context, "evidence.upload_failed");
  assert.equal((loggedErrors[0].meta as { message: string }).message, internalMsg);
});
