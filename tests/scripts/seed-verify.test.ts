import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRowCounts } from "../../scripts/seed-verify";

function makeSupabase(counts: Record<string, number>): any {
  return {
    from: (table: string) => ({
      select: (_cols: string, opts: { count: string; head: boolean }) => {
        assert.equal(opts.count, "exact");
        assert.equal(opts.head, true);
        return Promise.resolve({ count: counts[table] ?? 0, error: null });
      },
    }),
  };
}

test("verify: all within ±1 % → ok=true", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-"));
  try {
    const snap = { tables: { scf_controls: 1000, scf_evidence_request_list: 200 } };
    await writeFile(join(dir, "expected_row_counts.json"), JSON.stringify(snap));
    const supabase = makeSupabase({ scf_controls: 1005, scf_evidence_request_list: 199 });

    const result = await verifyRowCounts(supabase, join(dir, "expected_row_counts.json"));
    assert.equal(result.ok, true);
    assert.equal(result.mismatches.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verify: one out of tolerance → ok=false", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-"));
  try {
    const snap = { tables: { scf_controls: 1000 } };
    await writeFile(join(dir, "expected_row_counts.json"), JSON.stringify(snap));
    const supabase = makeSupabase({ scf_controls: 1200 });

    const result = await verifyRowCounts(supabase, join(dir, "expected_row_counts.json"));
    assert.equal(result.ok, false);
    assert.equal(result.mismatches.length, 1);
    assert.equal(result.mismatches[0].table, "scf_controls");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verify: missing snapshot file throws with hint", async () => {
  const dir = await mkdtemp(join(tmpdir(), "verify-"));
  try {
    const supabase = makeSupabase({});
    await assert.rejects(
      () => verifyRowCounts(supabase, join(dir, "nope.json")),
      (err: Error) => err.message.includes("pnpm seed:snapshot")
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
