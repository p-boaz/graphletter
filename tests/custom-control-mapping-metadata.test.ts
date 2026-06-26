import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import type { generateObject } from "ai";
import type { getModel } from "@/lib/ai-client";
import type { CustomControlMappingDependencies } from "@/lib/ai/custom-control-mapping-handler";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const controls = [
  {
    id: "GOV-01",
    title: "Cybersecurity Governance Program",
    description: "Mechanisms exist to govern cybersecurity policies and oversight.",
    domain_id: "GOV",
    scf_control_mappings: [],
  },
  {
    id: "IRO-01",
    title: "Incident Response Operations",
    description: "Mechanisms exist to implement incident response operations.",
    domain_id: "IRO",
    scf_control_mappings: [],
  },
];

function request(policyText = "This policy governs incident response operations and oversight.") {
  return new Request("http://localhost/api/ai/custom-control-mapping", {
    method: "POST",
    body: JSON.stringify({ policyText, includeFrameworkCoverage: false }),
  });
}

function dependencies(generateObjectImpl: typeof generateObject): CustomControlMappingDependencies {
  return {
    requireAuthenticatedUser: async () => ({ user: { id: "user-1" } }),
    enforceUserRateLimit: () => null,
    validateAIEnvironment: () => true,
    controlStore: {
      from() {
        return {
          select() {
            return {
              limit: async () => ({ data: controls, error: null }),
            };
          },
        };
      },
    },
    generateObject: generateObjectImpl,
    getModel: (() => ({})) as unknown as typeof getModel,
  };
}

test("custom control mapping AI success includes structured method metadata", async () => {
  const { createCustomControlMappingHandler } = await import(
    "@/lib/ai/custom-control-mapping-handler"
  );
  const handler = createCustomControlMappingHandler(
    dependencies((async () => ({
      object: {
        concepts: ["governance"],
        matchedControls: [
          {
            controlId: "GOV-01",
            confidence: 88,
            reasoning: "Governance policy language maps to GOV-01.",
          },
        ],
        gaps: [],
        overallAssessment: "AI analysis completed.",
      },
    })) as unknown as typeof generateObject)
  );

  const response = await handler(request() as never);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.analysis.method, "ai_model");
  assert.equal(payload.data.analysis.source, "configured_ai_provider");
  assert.equal(payload.data.mappingMetadata.method, "ai_model");
  assert.equal(payload.data.mappingMetadata.source, "configured_ai_provider");
  assert.equal(payload.data.analysis.matchedControls[0].id, "GOV-01");
});

test("custom control mapping fallback includes structured method metadata", async () => {
  const { createCustomControlMappingHandler } = await import(
    "@/lib/ai/custom-control-mapping-handler"
  );
  const handler = createCustomControlMappingHandler(
    dependencies((async () => {
      throw new Error("model unavailable");
    }) as unknown as typeof generateObject)
  );

  const response = await handler(
    request("Incident response operations policy for security incidents.") as never
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.analysis.method, "keyword_fallback");
  assert.equal(payload.data.analysis.source, "local_keyword_matcher");
  assert.equal(payload.data.mappingMetadata.method, "keyword_fallback");
  assert.equal(payload.data.mappingMetadata.source, "local_keyword_matcher");
  assert.equal(payload.data.analysis.gaps[0], "AI analysis failed - using fallback matching");
  const matchedControlIds = payload.data.analysis.matchedControls.map(
    (control: { id: string }) => control.id
  );
  assert.ok(matchedControlIds.includes("IRO-01"), "expected fallback to include IRO-01");
});

test("custom control mapping injectable handler preserves auth responses", async () => {
  const { createCustomControlMappingHandler } = await import(
    "@/lib/ai/custom-control-mapping-handler"
  );
  const handler = createCustomControlMappingHandler({
    ...dependencies((async () => ({ object: {} })) as unknown as typeof generateObject),
    requireAuthenticatedUser: async () => ({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }),
  });

  const response = await handler(request() as never);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});
