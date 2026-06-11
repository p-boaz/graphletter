import assert from "node:assert/strict";
import test from "node:test";
import { apiError } from "@/lib/api/error-response";

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
  const captured: string[] = [];
  const original = console.error;
  const internalMsg = "internal constraint violation";
  const context = "evidence.upload_failed";
  try {
    console.error = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
    apiError(context, "Upload failed", 500, new Error(internalMsg));
  } finally {
    console.error = original;
  }
  assert.equal(captured.length, 1, "expected exactly one console.error call");

  // Parse the JSON log line to verify field-level correctness.
  const parsed = JSON.parse(captured[0]) as Record<string, unknown>;

  // (a) The context event name must survive as the `message` field.
  assert.equal(
    parsed["message"],
    context,
    `Expected log.message to be the event name "${context}", got: ${parsed["message"]}`
  );

  // (b) The internal error text must be under `detail`, not `message`.
  assert.equal(
    parsed["detail"],
    internalMsg,
    `Expected log.detail to contain internal message, got: ${parsed["detail"]}`
  );

  // The logger module name "api-error" is always present in the JSON output.
  assert.ok(
    captured[0].includes("api-error"),
    `Expected log output to contain module name "api-error", got: ${captured[0]}`
  );
});
