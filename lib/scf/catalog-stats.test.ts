import test from "node:test";
import assert from "node:assert/strict";
import frameworkManifest from "../../data/framework-manifest.json";
import { SUPPORTED_FRAMEWORK_COUNT } from "./__generated__/framework-columns";
import {
  CONTROL_COUNT,
  CROSSWALK_COUNT,
  FRAMEWORK_COUNT,
  SCF_EDITION,
  formatStat,
} from "./catalog-stats";

// Drift tripwires: an SCF version bump must regenerate BOTH the framework
// manifest (pnpm manifest:generate) and the seed row-count snapshot
// (scripts/snapshot-row-counts.ts). If one moves without the other, public
// copy would silently disagree with the serving path — fail here instead.

test("seed snapshot edition matches the framework manifest", () => {
  assert.equal(SCF_EDITION, frameworkManifest.provenance.scfVersion);
});

test("seed snapshot framework count matches generated columns and manifest", () => {
  assert.equal(FRAMEWORK_COUNT, SUPPORTED_FRAMEWORK_COUNT);
  assert.equal(FRAMEWORK_COUNT, frameworkManifest.summary.imported);
});

test("catalog magnitudes are sane", () => {
  // Coarse floors so a truncated or partial snapshot can't render as copy.
  assert.ok(CONTROL_COUNT > 1000, `control count ${CONTROL_COUNT} implausibly low`);
  assert.ok(CROSSWALK_COUNT > 10_000, `crosswalk count ${CROSSWALK_COUNT} implausibly low`);
  assert.ok(CROSSWALK_COUNT > CONTROL_COUNT);
});

test("formatStat renders en-US thousands separators", () => {
  assert.equal(formatStat(1534), "1,534");
  assert.equal(formatStat(81), "81");
});
