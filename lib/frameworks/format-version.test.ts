import assert from "node:assert/strict";
import test from "node:test";
import { formatFrameworkVersion } from "@/lib/frameworks/format-version";

test("formatFrameworkVersion returns null for undefined", () => {
  assert.equal(formatFrameworkVersion(undefined), null);
});

test("formatFrameworkVersion returns null for empty string", () => {
  assert.equal(formatFrameworkVersion(""), null);
});

test("formatFrameworkVersion prefixes numeric semver with 'v'", () => {
  assert.equal(formatFrameworkVersion("4.0.1"), "v4.0.1");
});

test("formatFrameworkVersion prefixes numeric year with 'v'", () => {
  assert.equal(formatFrameworkVersion("2023"), "v2023");
});

test("formatFrameworkVersion leaves 'rev5' unprefixed", () => {
  assert.equal(formatFrameworkVersion("rev5"), "rev5");
});

test("formatFrameworkVersion leaves 'rev4' unprefixed", () => {
  assert.equal(formatFrameworkVersion("rev4"), "rev4");
});

test("formatFrameworkVersion leaves already-prefixed 'v4.0.1' unchanged", () => {
  assert.equal(formatFrameworkVersion("v4.0.1"), "v4.0.1");
});

test("formatFrameworkVersion trims surrounding whitespace before prefixing", () => {
  assert.equal(formatFrameworkVersion("  4.0.1  "), "v4.0.1");
});
