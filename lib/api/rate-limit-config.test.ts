import assert from "node:assert/strict";
import test from "node:test";
import { getApiRateLimitConfig } from "@/lib/api/rate-limit-config";

test("getApiRateLimitConfig exempts read-only SCF catalog routes", () => {
  assert.equal(getApiRateLimitConfig("/api/scf/controls", "GET"), null);
});

test("getApiRateLimitConfig rate limits API mutations and enumerative reads", () => {
  assert.ok(getApiRateLimitConfig("/api/evidence/upload-only", "POST"));
  assert.ok(getApiRateLimitConfig("/api/users", "GET"));
  assert.ok(getApiRateLimitConfig("/api/assessments", "DELETE"));
});
