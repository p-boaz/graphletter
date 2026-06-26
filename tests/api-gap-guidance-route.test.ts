import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuidanceRequest, GuidanceResult } from "@/lib/compliance/guidance-generator";
import { fakeSupabase, queriesFor } from "@/lib/testing/fake-supabase";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

type GapGuidancePostHandlerFactory =
  typeof import("@/lib/compliance/gap-guidance-route").createGapGuidancePostHandler;

async function createTestHandler(...args: Parameters<GapGuidancePostHandlerFactory>) {
  const { createGapGuidancePostHandler } = await import("@/lib/compliance/gap-guidance-route");
  return createGapGuidancePostHandler(...args);
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/compliance/gap-guidance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const GUIDANCE_RESULT: GuidanceResult = {
  guidance: "Prepare access control evidence.",
  exampleSections: ["Scope", "Responsibilities"],
  estimatedEffort: "low",
  cached: false,
  templateFallback: false,
};

test("gap guidance route rejects unauthenticated requests", async () => {
  const { client } = fakeSupabase({});
  const handler = await createTestHandler({
    createClient: async () => client,
    getCurrentUser: async () => null,
    supabaseAdmin: client,
    generateGuidance: async () => GUIDANCE_RESULT,
  });

  const response = await handler(jsonRequest({ erlId: "E-1", controlIds: ["AC-01"] }) as never);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("gap guidance route validates required fields before route work", async () => {
  const { client, queries } = fakeSupabase({});
  let guidanceCalled = false;
  const handler = await createTestHandler({
    createClient: async () => client,
    getCurrentUser: async () => ({ id: "user-1" }),
    supabaseAdmin: client,
    generateGuidance: async () => {
      guidanceCalled = true;
      return GUIDANCE_RESULT;
    },
  });

  const response = await handler(jsonRequest({ erlId: "E-1", controlIds: [] }) as never);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "erlId and controlIds are required" });
  assert.equal(guidanceCalled, false);
  assert.equal(queries.length, 0);
});

test("gap guidance route returns generated guidance with fetched artifact and control context", async () => {
  const { client, queries } = fakeSupabase({
    scf_evidence_request_list: {
      data: {
        documentation_artifact: "Access Control Policy",
        artifact_description: "Identity lifecycle policy.",
      },
    },
    scf_controls: {
      data: [
        { id: "AC-01", title: "Access control policy" },
        { id: "AC-02", title: "Privileged access" },
      ],
    },
  });
  let guidanceRequest: GuidanceRequest | null = null;
  let guidanceClient: SupabaseClient | null = null;
  const handler = await createTestHandler({
    createClient: async () => client,
    getCurrentUser: async () => ({ id: "user-1" }),
    supabaseAdmin: client,
    generateGuidance: async (supabase, req) => {
      guidanceClient = supabase;
      guidanceRequest = req;
      return GUIDANCE_RESULT;
    },
  });

  const response = await handler(
    jsonRequest({ erlId: "ERL-AC-001", controlIds: ["AC-01", "AC-02"] }) as never
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), GUIDANCE_RESULT);
  assert.equal(guidanceClient, client);
  assert.deepEqual(guidanceRequest, {
    erlId: "ERL-AC-001",
    artifact: "Access Control Policy",
    artifactDescription: "Identity lifecycle policy.",
    controlIds: ["AC-01", "AC-02"],
    controlTitles: ["Access control policy", "Privileged access"],
  });
  assert.equal(queriesFor(queries, "scf_evidence_request_list").length, 1);
  assert.equal(queriesFor(queries, "scf_controls").length, 1);
});

test("gap guidance route returns sanitized errors for unexpected failures", async () => {
  const { client } = fakeSupabase({
    scf_controls: { data: [] },
  });
  const handler = await createTestHandler({
    createClient: async () => client,
    getCurrentUser: async () => ({ id: "user-1" }),
    supabaseAdmin: client,
    generateGuidance: async () => {
      throw new Error("database password leaked");
    },
  });

  const response = await handler(
    jsonRequest({
      erlId: "ERL-AC-001",
      artifact: "Provided Artifact",
      controlIds: ["AC-01"],
    }) as never
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Failed to generate guidance" });
});
