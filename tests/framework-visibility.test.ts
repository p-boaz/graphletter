import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCFParser } from "@/lib/scf-parser";
import { writeParsedSCF, type FrameworkImportScope } from "@/lib/scf/writer";
import { CATALOG_FRAMEWORK_COLUMNS } from "@/lib/scf/__generated__/framework-columns";
import { frameworkFamily } from "@/lib/frameworks/family";
import type { SCFControl, SCFImportResult } from "@/lib/scf-types";

const controlsCSV = readFileSync(join(process.cwd(), "data", "controls.csv"), "utf-8");
const parsedMappings = SCFParser.parseControlMappings(controlsCSV);

const SUPPORTED = CATALOG_FRAMEWORK_COLUMNS.filter((c) => c.visibility === "supported");

function stubControl(id: string): SCFControl {
  return {
    id,
    title: "t",
    description: "d",
    domain: "Access Control",
    principle: "p",
    controlQuestions: [],
    organizationGuidance: {},
    applicability: { people: true, process: true, technology: true, governance: true },
    riskIds: [],
    threatIds: [],
    assessmentObjectives: [],
    evidenceRequests: [],
    mappings: {},
    version: "2026.2",
    lastUpdated: new Date(0),
  };
}

function makeParseResult(): SCFImportResult {
  const controlIds = [...new Set(parsedMappings.map((m) => m.controlId))];
  return {
    success: true,
    summary: {
      totalControls: controlIds.length,
      totalDomains: 0,
      totalFrameworks: 0,
      totalMappings: 0,
      version: "2026.2",
    },
    controls: controlIds.map(stubControl),
    domains: [],
    frameworks: [],
    risks: [],
    threats: [],
    errors: [],
    warnings: [],
  };
}

interface InsertedFramework {
  framework_name: string;
  visibility: string;
  catalog_key: string | null;
  kind: string | null;
  family: string | null;
  exposure_status: string | null;
  total_mappings: number;
}

/**
 * Minimal chainable Supabase stub: records framework and mapping inserts,
 * resolves everything else as empty success.
 */
function makeRecordingSupabase() {
  const frameworks: InsertedFramework[] = [];
  let mappingRows = 0;
  const builder = (table: string): Record<string, unknown> => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ data: null, error: null }),
      in: () => Promise.resolve({ data: null, error: null }),
    }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    insert: (rows: unknown) => {
      const list = Array.isArray(rows) ? rows : [rows];
      if (table === "scf_frameworks") {
        frameworks.push(...(list as InsertedFramework[]));
      }
      if (table === "scf_control_mappings") {
        mappingRows += list.length;
      }
      return {
        select: () =>
          Promise.resolve({
            data: list.map((row, i) => ({
              ...(row as object),
              id: `fw-${frameworks.length}-${i}`,
            })),
            error: null,
          }),
        then: (resolve: (v: { data: null; error: null }) => unknown) =>
          resolve({ data: null, error: null }),
      };
    },
  });
  return {
    supabase: { from: (table: string) => builder(table) },
    frameworks,
    mappingCount: () => mappingRows,
  };
}

async function runWriter(scope: FrameworkImportScope) {
  const recorder = makeRecordingSupabase();
  await writeParsedSCF(
    // Recording stub implements exactly the query surface the writer touches.
    recorder.supabase as never,
    makeParseResult(),
    controlsCSV,
    "import-test",
    { frameworkScope: scope }
  );
  return recorder;
}

test("writer scope 'supported' persists exactly the supported tier with catalog metadata", async () => {
  const recorder = await runWriter("supported");

  assert.equal(recorder.frameworks.length, SUPPORTED.length);
  for (const fw of recorder.frameworks) {
    assert.equal(fw.visibility, "supported");
    assert.ok(fw.catalog_key, `framework "${fw.framework_name}" missing catalog_key`);
    assert.ok(fw.kind, `framework "${fw.framework_name}" missing kind`);
    assert.ok(fw.family, `framework "${fw.framework_name}" missing family`);
    assert.equal(fw.exposure_status, "public");
  }

  const supportedNames = new Set(SUPPORTED.map((c) => c.frameworkName));
  const expectedMappings = parsedMappings.filter((m) => supportedNames.has(m.frameworkName)).length;
  assert.equal(recorder.mappingCount(), expectedMappings);
  assert.equal(
    recorder.frameworks.reduce((sum, fw) => sum + fw.total_mappings, 0),
    expectedMappings
  );
});

test("writer scope 'catalog' persists the full non-excluded catalog", async () => {
  const recorder = await runWriter("catalog");

  assert.equal(recorder.frameworks.length, CATALOG_FRAMEWORK_COLUMNS.length);
  assert.equal(recorder.mappingCount(), parsedMappings.length);

  const previews = recorder.frameworks.filter((fw) => fw.visibility === "preview");
  assert.equal(previews.length, CATALOG_FRAMEWORK_COLUMNS.length - SUPPORTED.length);

  // Exposure is a per-framework licensing decision carried by the manifest
  // (docs/FRAMEWORK_EXPOSURE_REVIEW.md), not a blanket preview default.
  const expectedExposure = new Map(
    CATALOG_FRAMEWORK_COLUMNS.map((c) => [c.catalogKey, c.exposureStatus])
  );
  for (const fw of previews) {
    assert.ok(fw.catalog_key, `framework "${fw.framework_name}" missing catalog_key`);
    assert.equal(
      fw.exposure_status,
      expectedExposure.get(fw.catalog_key),
      `preview framework "${fw.framework_name}" must persist its reviewed exposure status`
    );
  }

  // The 2026-07-11 review keeps: these must stay non-public until their
  // dispositions change in data/framework-manifest.overrides.json.
  const reviewKeeps = [
    "general-cobit-2019",
    "general-cr-cmm-2026",
    "general-shared-assessments-sig-2025",
    "emea-sau-sacs-002-2022",
    "apac-jpn-ismap",
  ];
  for (const key of reviewKeeps) {
    const fw = previews.find((p) => p.catalog_key === key);
    assert.ok(fw, `review keep "${key}" missing from persisted preview tier`);
    assert.equal(
      fw.exposure_status,
      "non-public",
      `review keep "${key}" must remain non-public per exposure review`
    );
  }
});

test("family buckets are stable for the supported tier under publisher-first grouping", () => {
  // Regression net for the family.ts rework: the publisher-first path must
  // group today's 66 exactly as the name-only heuristic did.
  for (const column of SUPPORTED) {
    const withPublisher = frameworkFamily(column.frameworkName, column.family);
    const nameOnly = frameworkFamily(column.frameworkName);
    assert.equal(
      withPublisher,
      nameOnly === "Other" && withPublisher !== "Other" ? withPublisher : nameOnly,
      `family drift for "${column.frameworkName}" (${column.family})`
    );
  }

  // Publisher wins when the name alone says nothing.
  assert.equal(frameworkFamily("AICPA TSC", "AICPA"), "SOC");
  assert.equal(frameworkFamily("Trust Services Criteria", "AICPA"), "SOC");
  // Law-specific buckets still come from the name.
  assert.equal(frameworkFamily("HIPAA Security Rule", "Federal"), "HIPAA");
  assert.equal(frameworkFamily("SOX (2002)", "Federal"), "SOX");
  assert.equal(frameworkFamily("Some Unknown Framework", "Bundesamt"), "Other");
});
