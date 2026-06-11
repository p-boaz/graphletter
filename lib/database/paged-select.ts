import { createLogger } from "@/lib/logger";

const log = createLogger("paged-select");

export const PAGE_SIZE = 1000;
export const IN_CHUNK_SIZE = 200;

/**
 * Split an array into chunks of at most `size` elements.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Minimal structural type for a PostgREST builder that supports .range().
// We only call .range() inside selectAllRows — the PromiseLike side of a real
// Supabase builder is not exercised here, so we don't require it.
type PagedResult = { data: unknown[] | null; error: { message: string } | null };
type BuilderWithRange = {
  range: (from: number, to: number) => PromiseLike<PagedResult>;
};

/**
 * Drain a PostgREST query past the 1000-row cap.
 *
 * `buildQuery` must return a FRESH builder each call (PostgREST builders are
 * single-use), already filtered/ordered; this function appends .range() and
 * loops until a short page comes back.
 *
 * NOTE: results across pages are only stable with a deterministic order.
 * Callers should `.order()` a unique column (e.g. `.order("id")`) to avoid
 * non-deterministic pagination gaps.
 */
export async function selectAllRows<Row>(buildQuery: () => BuilderWithRange): Promise<Row[]> {
  const MAX_PAGES = 100;
  const rows: Row[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as Row[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;

    if (page === MAX_PAGES - 1) {
      log.warn("paged_select.safety_stop", {
        offset,
        totalRowsSoFar: rows.length,
        message: "Reached 100-page safety limit; result may be incomplete",
      });
    }
  }

  return rows;
}
