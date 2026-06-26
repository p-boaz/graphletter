import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

function malformedRequest(): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body: "{not valid json",
  });
}

async function assertMalformedJsonResponse(response: Response) {
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Malformed JSON request body" });
}

test("gap analysis rejects malformed JSON before route work", async () => {
  const route = await import("@/app/api/analysis/run-gap-analysis/route");

  await assertMalformedJsonResponse(await route.POST(malformedRequest() as never));
});

test("gap remediation rejects malformed JSON before route work", async () => {
  const route = await import("@/app/api/compliance/gap-remediation/route");

  await assertMalformedJsonResponse(await route.POST(malformedRequest() as never));
});

test("coverage build rejects malformed JSON before route work", async () => {
  const route = await import("@/app/api/controls/build-coverage/route");

  await assertMalformedJsonResponse(await route.POST(malformedRequest() as never));
});

test("document evidence extraction rejects malformed JSON before route work", async () => {
  const route = await import("@/app/api/documents/[id]/extract-evidence/route");

  await assertMalformedJsonResponse(
    await route.POST(malformedRequest() as never, { params: Promise.resolve({ id: "doc-1" }) })
  );
});

test("progress session creation rejects malformed JSON before route work", async () => {
  const route = await import("@/app/api/progress/session/route");

  await assertMalformedJsonResponse(await route.POST(malformedRequest()));
});

test("progress session update rejects malformed JSON before route work", async () => {
  const route = await import("@/app/api/progress/session/[sessionId]/route");

  await assertMalformedJsonResponse(
    await route.PATCH(malformedRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1" }),
    })
  );
});
