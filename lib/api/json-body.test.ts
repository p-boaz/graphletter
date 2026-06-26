import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonBody } from "@/lib/api/json-body";

test("parseJsonBody returns parsed JSON", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify({ frameworkId: "soc2" }),
  });

  const result = await parseJsonBody(request, {});

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.body, { frameworkId: "soc2" });
  }
});

test("parseJsonBody treats an empty body as the route default", async () => {
  const request = new Request("http://localhost/api/test", { method: "POST" });
  const defaultBody = { includeControls: true };

  const result = await parseJsonBody(request, defaultBody);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.body, defaultBody);
  }
});

test("parseJsonBody returns a sanitized 400 for malformed JSON", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    body: "{not valid json",
  });

  const result = await parseJsonBody(request, {});

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 400);
    assert.deepEqual(await result.response.json(), { error: "Malformed JSON request body" });
  }
});
