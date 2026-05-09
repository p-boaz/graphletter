import assert from "node:assert/strict";
import test from "node:test";
import { isNewUser } from "@/lib/dashboard/is-new-user";

test("isNewUser returns true when evidenceCount is 0", () => {
  assert.equal(isNewUser({ evidenceCount: 0 }), true);
});

test("isNewUser returns false when evidenceCount is 3", () => {
  assert.equal(isNewUser({ evidenceCount: 3 }), false);
});

test("isNewUser returns false when evidenceCount is 1", () => {
  assert.equal(isNewUser({ evidenceCount: 1 }), false);
});
