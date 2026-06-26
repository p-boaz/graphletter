import assert from "node:assert/strict";
import test from "node:test";
import { consumeDemoQuota, DEMO_QUOTA_MAX, getDemoQuota } from "./demo-quota";

type DemoQuotaTestClient = NonNullable<Parameters<typeof getDemoQuota>[1]>;
type QueryError = { message: string } | null;
type ChainCall = { method: string; args: unknown[] };

interface FakeClientOptions {
  hits?: string[];
  deleteError?: QueryError;
  selectError?: QueryError;
  rpcData?: unknown;
  rpcError?: QueryError;
}

function fakeQuotaClient(options: FakeClientOptions = {}) {
  const queries: { table: string; chain: ChainCall[] }[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  const client = {
    from(table: string) {
      const chain: ChainCall[] = [];
      queries.push({ table, chain });
      let mode: "delete" | "select" | null = null;

      const builder = {
        delete() {
          mode = "delete";
          chain.push({ method: "delete", args: [] });
          return builder;
        },
        select(...args: unknown[]) {
          mode = "select";
          chain.push({ method: "select", args });
          return builder;
        },
        lte(...args: unknown[]) {
          chain.push({ method: "lte", args });
          return builder;
        },
        eq(...args: unknown[]) {
          chain.push({ method: "eq", args });
          return builder;
        },
        gt(...args: unknown[]) {
          chain.push({ method: "gt", args });
          return builder;
        },
        order(...args: unknown[]) {
          chain.push({ method: "order", args });
          return builder;
        },
        limit(...args: unknown[]) {
          chain.push({ method: "limit", args });
          return builder;
        },
        then(
          onFulfilled?: (value: { data: unknown; error: QueryError }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          const response =
            mode === "delete"
              ? { data: null, error: options.deleteError ?? null }
              : {
                  data: (options.hits ?? []).map((consumed_at) => ({ consumed_at })),
                  error: options.selectError ?? null,
                };
          return Promise.resolve(response).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return {
        single() {
          return Promise.resolve({
            data: options.rpcData ?? null,
            error: options.rpcError ?? null,
          });
        },
      };
    },
  };

  return { client: client as unknown as DemoQuotaTestClient, queries, rpcCalls };
}

test("getDemoQuota cleans expired hits and returns remaining quota from durable rows", async () => {
  const { client, queries } = fakeQuotaClient({
    hits: ["2026-06-26T16:00:00.000Z", "2026-06-26T16:10:00.000Z"],
  });

  const quota = await getDemoQuota("203.0.113.10", client);

  assert.deepEqual(quota, { remaining: 1, max: DEMO_QUOTA_MAX });
  assert.equal(queries.length, 2);
  assert.equal(queries[0]?.table, "demo_quota_hits");
  assert.deepEqual(
    queries[0]?.chain.map((call) => call.method),
    ["delete", "lte"]
  );
  assert.equal(queries[1]?.table, "demo_quota_hits");

  const eqCall = queries[1]?.chain.find((call) => call.method === "eq");
  assert.equal(eqCall?.args[0], "quota_key");
  assert.notEqual(eqCall?.args[1], "203.0.113.10");
  assert.match(String(eqCall?.args[1]), /^[a-f0-9]{64}$/);
});

test("consumeDemoQuota delegates to the atomic database function", async () => {
  const { client, rpcCalls } = fakeQuotaClient({
    rpcData: { ok: true, remaining: 2, retry_after_seconds: 0 },
  });

  const quota = await consumeDemoQuota("203.0.113.11", client);

  assert.deepEqual(quota, {
    ok: true,
    remaining: 2,
    max: DEMO_QUOTA_MAX,
    retryAfterSeconds: 0,
  });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0]?.name, "consume_demo_quota");
  assert.equal(rpcCalls[0]?.args.p_max_hits, DEMO_QUOTA_MAX);
  assert.equal(rpcCalls[0]?.args.p_window_seconds, 3600);
  assert.match(String(rpcCalls[0]?.args.p_quota_key), /^[a-f0-9]{64}$/);
});

test("consumeDemoQuota preserves limit rejection details", async () => {
  const { client } = fakeQuotaClient({
    rpcData: { ok: false, remaining: 0, retry_after_seconds: 417 },
  });

  const quota = await consumeDemoQuota("203.0.113.12", client);

  assert.deepEqual(quota, {
    ok: false,
    remaining: 0,
    max: DEMO_QUOTA_MAX,
    retryAfterSeconds: 417,
  });
});

test("demo quota helpers surface durable store errors", async () => {
  const cleanupFailure = fakeQuotaClient({
    deleteError: { message: "delete failed" },
  });
  await assert.rejects(() => getDemoQuota("203.0.113.13", cleanupFailure.client), /delete failed/);

  const consumeFailure = fakeQuotaClient({
    rpcError: { message: "rpc failed" },
  });
  await assert.rejects(() => consumeDemoQuota("203.0.113.14", consumeFailure.client), /rpc failed/);
});
