import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProgressSession,
  updateProgress,
  completeProgressSession,
  errorProgressSession,
  getProgressSession,
} from "@/lib/progress/progress-store";

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

/** Builds a minimal Supabase client stub with a recorded call log. */
function makeStub(options: {
  insertResult?: { data: unknown; error: null | { message: string } };
  updateResult?: { data: unknown[] | null; error: null | { message: string } };
  selectResult?: { data: unknown | null; error: null | { message: string } };
}) {
  const calls: Call[] = [];

  const stub = {
    _calls: calls,
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return {
        insert(values: unknown) {
          calls.push({ method: "insert", args: [values] });
          return {
            select() {
              calls.push({ method: "select", args: [] });
              return {
                single() {
                  calls.push({ method: "single", args: [] });
                  return Promise.resolve(
                    options.insertResult ?? { data: null, error: { message: "not configured" } }
                  );
                },
              };
            },
          };
        },
        update(values: unknown) {
          calls.push({ method: "update", args: [values] });
          return {
            eq(col: string, val: unknown) {
              calls.push({ method: "eq", args: [col, val] });
              return {
                select(cols?: string) {
                  calls.push({ method: "select", args: [cols] });
                  return Promise.resolve(options.updateResult ?? { data: [], error: null });
                },
                // completeProgressSession / errorProgressSession use no .select()
                then(resolve: (v: unknown) => unknown) {
                  return Promise.resolve(options.updateResult ?? { data: [], error: null }).then(
                    resolve
                  );
                },
              };
            },
          };
        },
        select(cols: string) {
          calls.push({ method: "select", args: [cols] });
          return {
            eq(col: string, val: unknown) {
              calls.push({ method: "eq", args: [col, val] });
              return {
                maybeSingle() {
                  calls.push({ method: "maybeSingle", args: [] });
                  return Promise.resolve(options.selectResult ?? { data: null, error: null });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient & { _calls: Call[] };

  return stub;
}

// A valid DB row to return from insert/select
function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "session-1",
    user_id: "user-1",
    operation: "test-op",
    current_stage: "initializing",
    progress: 0,
    status: "active",
    message: "Starting test-op...",
    metadata: null,
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createProgressSession
// ---------------------------------------------------------------------------

test("createProgressSession: maps row fields to ProgressSession shape", async () => {
  const row = makeRow();
  const stub = makeStub({ insertResult: { data: row, error: null } });

  const session = await createProgressSession(stub, {
    sessionId: "session-1",
    userId: "user-1",
    operation: "test-op",
  });

  assert.equal(session.sessionId, "session-1");
  assert.equal(session.userId, "user-1");
  assert.equal(session.operation, "test-op");
  assert.equal(session.currentStage, "initializing");
  assert.equal(session.progress, 0);
  assert.equal(session.status, "active");
  assert.equal(session.startTime, row.created_at);
  assert.equal(session.updatedAt, row.updated_at);
});

test("createProgressSession: throws when insert returns an error", async () => {
  const stub = makeStub({ insertResult: { data: null, error: { message: "db error" } } });

  await assert.rejects(
    () => createProgressSession(stub, { sessionId: "s", userId: "u", operation: "op" }),
    /db error/
  );
});

// ---------------------------------------------------------------------------
// updateProgress — clamping
// ---------------------------------------------------------------------------

test("updateProgress: clamps negative progress to 0", async () => {
  const stub = makeStub({ updateResult: { data: [{ id: "s" }], error: null } });
  await updateProgress(stub, "s", "stage", -5, "msg");

  const updateCall = stub._calls.find((c) => c.method === "update");
  assert.ok(updateCall, "update was called");
  const values = updateCall!.args[0] as Record<string, unknown>;
  assert.equal(values.progress, 0);
});

test("updateProgress: clamps progress > 100 to 100", async () => {
  const stub = makeStub({ updateResult: { data: [{ id: "s" }], error: null } });
  await updateProgress(stub, "s", "stage", 150, "msg");

  const updateCall = stub._calls.find((c) => c.method === "update");
  assert.ok(updateCall, "update was called");
  const values = updateCall!.args[0] as Record<string, unknown>;
  assert.equal(values.progress, 100);
});

test("updateProgress: passes through valid progress unchanged", async () => {
  const stub = makeStub({ updateResult: { data: [{ id: "s" }], error: null } });
  await updateProgress(stub, "s", "stage", 42, "msg");

  const updateCall = stub._calls.find((c) => c.method === "update");
  assert.ok(updateCall);
  const values = updateCall!.args[0] as Record<string, unknown>;
  assert.equal(values.progress, 42);
});

// ---------------------------------------------------------------------------
// updateProgress — missing row is a no-op warn, not a throw
// ---------------------------------------------------------------------------

test("updateProgress: missing row logs warn and does not throw", async () => {
  const stub = makeStub({ updateResult: { data: [], error: null } });
  // Must not throw
  await assert.doesNotReject(() => updateProgress(stub, "missing-id", "stage", 50, "msg"));
});

test("updateProgress: DB error logs warn and does not throw", async () => {
  const stub = makeStub({ updateResult: { data: null, error: { message: "rls violation" } } });
  await assert.doesNotReject(() => updateProgress(stub, "s", "stage", 50, "msg"));
});

// ---------------------------------------------------------------------------
// completeProgressSession
// ---------------------------------------------------------------------------

test("completeProgressSession: sets status=completed and progress=100", async () => {
  const stub = makeStub({ updateResult: { data: [{ id: "s" }], error: null } });
  await completeProgressSession(stub, "session-1", "all done");

  const updateCall = stub._calls.find((c) => c.method === "update");
  assert.ok(updateCall);
  const values = updateCall!.args[0] as Record<string, unknown>;
  assert.equal(values.status, "completed");
  assert.equal(values.progress, 100);
  assert.equal(values.message, "all done");
});

// ---------------------------------------------------------------------------
// errorProgressSession
// ---------------------------------------------------------------------------

test("errorProgressSession: sets status=error and prefixes message", async () => {
  const stub = makeStub({ updateResult: { data: [{ id: "s" }], error: null } });
  await errorProgressSession(stub, "session-1", "something broke");

  const updateCall = stub._calls.find((c) => c.method === "update");
  assert.ok(updateCall);
  const values = updateCall!.args[0] as Record<string, unknown>;
  assert.equal(values.status, "error");
  assert.equal(values.message, "Error: something broke");
});

// ---------------------------------------------------------------------------
// getProgressSession — row → ProgressSession mapping
// ---------------------------------------------------------------------------

test("getProgressSession: maps a full row to ProgressSession", async () => {
  const row = makeRow({ progress: 75, current_stage: "running", status: "active" });
  const stub = makeStub({ selectResult: { data: row, error: null } });

  const session = await getProgressSession(stub, "session-1");
  assert.ok(session);
  assert.equal(session.sessionId, "session-1");
  assert.equal(session.progress, 75);
  assert.equal(session.currentStage, "running");
  assert.equal(session.status, "active");
});

test("getProgressSession: returns null for missing row", async () => {
  const stub = makeStub({ selectResult: { data: null, error: null } });
  const session = await getProgressSession(stub, "nonexistent");
  assert.equal(session, null);
});
