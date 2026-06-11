import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_SIZE, IN_CHUNK_SIZE, chunkArray, selectAllRows } from "@/lib/database/paged-select";

// ---------------------------------------------------------------------------
// chunkArray
// ---------------------------------------------------------------------------

test("chunkArray: empty input returns []", () => {
  assert.deepEqual(chunkArray([], 10), []);
});

test("chunkArray: exact multiple splits cleanly", () => {
  const items = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(chunkArray(items, 3), [
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("chunkArray: remainder becomes a smaller last chunk", () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(chunkArray(items, 3), [
    [1, 2, 3],
    [4, 5],
  ]);
});

// ---------------------------------------------------------------------------
// selectAllRows
// ---------------------------------------------------------------------------

test("selectAllRows: concatenates 2 full pages + 1 short page; 3 range() calls with correct ranges", async () => {
  const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i }));
  const shortPage = [{ id: 9999 }];

  // We need to track range() calls and their arguments independently.
  const rangeArgs: Array<[number, number]> = [];
  let rangeCallCount = 0;

  const pagePayloads = [fullPage, fullPage, shortPage];

  function buildQuery() {
    return {
      range(from: number, to: number) {
        rangeArgs.push([from, to]);
        const rows = pagePayloads[rangeCallCount++] ?? [];
        return Promise.resolve({ data: rows, error: null });
      },
    };
  }

  const result = await selectAllRows<{ id: number }>(buildQuery);

  assert.equal(result.length, PAGE_SIZE * 2 + 1, "total rows concatenated");
  assert.equal(rangeCallCount, 3, "exactly 3 range() calls");
  assert.deepEqual(rangeArgs[0], [0, PAGE_SIZE - 1], "first page range");
  assert.deepEqual(rangeArgs[1], [PAGE_SIZE, PAGE_SIZE * 2 - 1], "second page range");
  assert.deepEqual(rangeArgs[2], [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1], "third page range");
});

test("selectAllRows: propagates an error from page 2 as a thrown Error", async () => {
  const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i }));
  let rangeCallCount = 0;

  function buildQuery() {
    return {
      range(_from: number, _to: number) {
        const call = rangeCallCount++;
        if (call === 0) {
          return Promise.resolve({ data: fullPage, error: null });
        }
        // Page 2 returns an error
        return Promise.resolve({
          data: null,
          error: { message: "DB error on page 2" },
        });
      },
    };
  }

  await assert.rejects(
    () => selectAllRows(buildQuery),
    (err: Error) => {
      assert.equal(err.message, "DB error on page 2");
      return true;
    }
  );
});

// Export constants so callers don't need to hardcode them elsewhere.
test("PAGE_SIZE is 1000 and IN_CHUNK_SIZE is 200", () => {
  assert.equal(PAGE_SIZE, 1000);
  assert.equal(IN_CHUNK_SIZE, 200);
});
