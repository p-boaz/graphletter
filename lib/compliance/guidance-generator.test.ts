import assert from "node:assert/strict";
import test from "node:test";
import { setCircuitBreakerOverrideForTesting } from "@/lib/ai/circuit-breaker";
import {
  failingModel,
  installMockModel,
  mockObjectModel,
  resetMockModel,
} from "@/lib/ai/testing/mock-model";
import { fakeSupabase, queriesFor, chainArg } from "@/lib/testing/fake-supabase";
import { generateGuidance, type GuidanceRequest } from "./guidance-generator";

function request(overrides: Partial<GuidanceRequest> = {}): GuidanceRequest {
  return {
    erlId: "ERL-AC-001",
    artifact: "Access Control Policy",
    artifactDescription: "Policy covering identity lifecycle.",
    controlIds: ["AC-01", "AC-02"],
    controlTitles: ["Access control policy", "Privileged access"],
    ...overrides,
  };
}

function withSeams(t: { after: (fn: () => void) => void }) {
  t.after(() => {
    setCircuitBreakerOverrideForTesting(null);
    resetMockModel();
  });
}

const TEMPLATE_SECTIONS = [
  "Purpose & Scope",
  "Roles & Responsibilities",
  "Implementation Details",
  "Evidence of Execution",
  "Review Cadence",
];

test("generateGuidance: cache hit returns the cached row untouched", async (t) => {
  withSeams(t);
  const { client } = fakeSupabase({
    erl_guidance_cache: {
      data: {
        guidance_text: "cached guidance",
        example_sections: ["A", "B"],
        estimated_effort: "high",
      },
    },
  });

  const result = await generateGuidance(client, request());
  assert.deepEqual(result, {
    guidance: "cached guidance",
    exampleSections: ["A", "B"],
    estimatedEffort: "high",
    cached: true,
    templateFallback: false,
  });
});

test("generateGuidance: cached effort is only defaulted when falsy, not validated", async (t) => {
  withSeams(t);
  const { client } = fakeSupabase({
    erl_guidance_cache: {
      data: {
        guidance_text: "cached",
        example_sections: "not-an-array",
        estimated_effort: "extreme",
      },
    },
  });

  const result = await generateGuidance(client, request());
  // CHARACTERIZATION: `(row.estimated_effort as ...) || "medium"` lets any
  // truthy garbage value through the type assertion — only ""/null fall
  // back to "medium". The AI path DOES validate (low|medium|high); the
  // cache-read path does not.
  assert.equal(result.estimatedEffort, "extreme");
  assert.deepEqual(result.exampleSections, []);

  const { client: emptyClient } = fakeSupabase({
    erl_guidance_cache: {
      data: { guidance_text: "cached", example_sections: [], estimated_effort: "" },
    },
  });
  const defaulted = await generateGuidance(emptyClient, request());
  assert.equal(defaulted.estimatedEffort, "medium");
});

test("generateGuidance: tripped circuit breaker yields the template fallback", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: false });
  const { client } = fakeSupabase({
    erl_guidance_cache: { data: null },
  });

  const result = await generateGuidance(client, request());
  assert.equal(result.templateFallback, true);
  assert.equal(result.cached, false);
  assert.deepEqual(result.exampleSections, TEMPLATE_SECTIONS);
  assert.ok(result.guidance.startsWith("## Access Control Policy"));
  assert.ok(result.guidance.includes("- AC-01"));
});

test("generateGuidance: template effort scales with control count (2→low, 6→medium, 7→high)", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: false });

  const controlsOf = (n: number) =>
    Array.from({ length: n }, (_, i) => `AC-${String(i + 1).padStart(2, "0")}`);

  for (const [count, effort] of [
    [2, "low"],
    [6, "medium"],
    [7, "high"],
  ] as const) {
    const { client } = fakeSupabase({ erl_guidance_cache: { data: null } });
    const result = await generateGuidance(
      client,
      request({ controlIds: controlsOf(count), controlTitles: undefined })
    );
    assert.equal(result.estimatedEffort, effort, `${count} controls`);
  }
});

test("generateGuidance: template lists at most 10 controls plus a more-note", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: false });
  const { client } = fakeSupabase({ erl_guidance_cache: { data: null } });

  const result = await generateGuidance(
    client,
    request({
      controlIds: Array.from({ length: 12 }, (_, i) => `AC-${i + 1}`),
      controlTitles: undefined,
    })
  );
  assert.ok(result.guidance.includes("- AC-10"));
  assert.ok(!result.guidance.includes("- AC-11\n"));
  assert.ok(result.guidance.includes("... and 2 more controls"));
});

test("generateGuidance: AI success parses JSON and caches the result", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(
    mockObjectModel([
      {
        guidance: "AI guidance text",
        sections: ["Intro", "Controls"],
        effort: "high",
      },
    ])
  );

  const { client, queries } = fakeSupabase({
    erl_guidance_cache: { data: null },
  });

  const result = await generateGuidance(client, request());
  assert.equal(result.guidance, "AI guidance text");
  assert.deepEqual(result.exampleSections, ["Intro", "Controls"]);
  assert.equal(result.estimatedEffort, "high");
  assert.equal(result.cached, false);
  assert.equal(result.templateFallback, false);

  // Fire-and-forget upsert: give the microtask queue a tick, then assert.
  await new Promise((resolve) => setImmediate(resolve));
  const upsert = queriesFor(queries, "erl_guidance_cache").find((q) =>
    q.chain.some((c) => c.method === "upsert")
  );
  assert.ok(upsert, "expected a cache upsert");
  const payload = chainArg(upsert, "upsert") as Record<string, unknown>;
  assert.equal(payload.erl_id, "ERL-AC-001");
  assert.equal(payload.guidance_text, "AI guidance text");
  assert.equal(typeof payload.control_ids_hash, "string");
});

test("generateGuidance: invalid AI effort falls back to count-based estimate", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(mockObjectModel([{ guidance: "text", sections: [], effort: "gigantic" }]));
  const { client } = fakeSupabase({ erl_guidance_cache: { data: null } });

  // 2 controls → "low" by estimateEffort
  const result = await generateGuidance(client, request());
  assert.equal(result.estimatedEffort, "low");
});

test("generateGuidance: AI response without JSON braces falls back to template", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: true });
  // makeTextResult stringifies; a bare string contains no braces.
  installMockModel(mockObjectModel(["sorry, no JSON here"]));
  const { client } = fakeSupabase({ erl_guidance_cache: { data: null } });

  const result = await generateGuidance(client, request());
  assert.equal(result.templateFallback, true);
});

test("generateGuidance: AI error falls back to template", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(failingModel(new Error("provider down"), 99, {}));
  const { client } = fakeSupabase({ erl_guidance_cache: { data: null } });

  const result = await generateGuidance(client, request());
  assert.equal(result.templateFallback, true);
  assert.deepEqual(result.exampleSections, TEMPLATE_SECTIONS);
});

test("generateGuidance: control-id hash is order-insensitive", async (t) => {
  withSeams(t);
  setCircuitBreakerOverrideForTesting({ allowed: false });

  const hashes: unknown[] = [];
  for (const controlIds of [
    ["AC-01", "AC-02", "AC-03"],
    ["AC-03", "AC-01", "AC-02"],
  ]) {
    const { client, queries } = fakeSupabase({
      erl_guidance_cache: { data: null },
    });
    await generateGuidance(client, request({ controlIds, controlTitles: undefined }));
    const cacheCheck = queriesFor(queries, "erl_guidance_cache")[0];
    const hashEq = cacheCheck.chain.find(
      (c) => c.method === "eq" && c.args[0] === "control_ids_hash"
    );
    hashes.push(hashEq?.args[1]);
  }

  assert.equal(typeof hashes[0], "string");
  assert.equal(hashes[0], hashes[1]);
});
