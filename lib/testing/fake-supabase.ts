/**
 * Minimal fake Supabase client for unit tests.
 *
 * Modules under test only ever (a) chain PostgREST builder methods and
 * (b) await the chain. This fake returns a builder whose every method
 * records the call and returns itself, and whose `then` resolves the
 * response configured for the table. No network, no env vars.
 *
 * Tables without a configured handler resolve to an error response — the
 * modules under test treat query errors as documented degraded paths, so
 * this default exercises those paths instead of hanging or throwing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChainCall {
  method: string;
  args: unknown[];
}

export interface CapturedQuery {
  table: string;
  chain: ChainCall[];
}

export interface TableResponse {
  data: unknown;
  error?: { message: string } | null;
}

/** Static response, or a function of the recorded chain (for per-call logic). */
export type TableHandler = TableResponse | ((chain: ChainCall[]) => TableResponse);

const CHAIN_METHODS = [
  "select",
  "insert",
  "upsert",
  "update",
  "delete",
  "eq",
  "neq",
  "in",
  "is",
  "gt",
  "gte",
  "lt",
  "lte",
  "not",
  "or",
  "order",
  "limit",
  "range",
  "single",
  "maybeSingle",
] as const;

export function fakeSupabase(tables: Record<string, TableHandler>): {
  client: SupabaseClient;
  queries: CapturedQuery[];
} {
  const queries: CapturedQuery[] = [];

  const client = {
    from(table: string) {
      const chain: ChainCall[] = [];
      queries.push({ table, chain });

      const resolve = (): TableResponse => {
        const handler = tables[table];
        if (!handler) {
          return {
            data: null,
            error: { message: `fakeSupabase: no handler for table "${table}"` },
          };
        }
        const response = typeof handler === "function" ? handler(chain) : handler;
        return { data: response.data, error: response.error ?? null };
      };

      const builder: Record<string, unknown> = {
        then(
          onFulfilled?: (value: TableResponse) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          return Promise.resolve(resolve()).then(onFulfilled, onRejected);
        },
      };

      for (const method of CHAIN_METHODS) {
        builder[method] = (...args: unknown[]) => {
          chain.push({ method, args });
          return builder;
        };
      }

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, queries };
}

/** Find every captured query against a table (e.g. to assert insert payloads). */
export function queriesFor(queries: CapturedQuery[], table: string): CapturedQuery[] {
  return queries.filter((q) => q.table === table);
}

/** First argument of the first `method` call in a captured chain, if any. */
export function chainArg(query: CapturedQuery, method: string): unknown {
  return query.chain.find((c) => c.method === method)?.args[0];
}
